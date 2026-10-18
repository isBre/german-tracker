import { db } from './db.js';

const APP_VERSION = '1.0.0';

const DEFAULT_METHODS = [
  'Anki', 'Nicos Weg', 'Easy German', 'Serie / Film', 'Conversazione',
  'Grammatica', 'Lettura', 'Podcast', 'Scrittura',
];

const CHECK_QUESTIONS = [
  'Capisco un video di Easy German senza sottotitoli',
  'Leggo un articolo di nachrichtenleicht.de senza dizionario',
  'Seguo una conversazione tra due persone al bar',
  'Racconto la mia giornata o il weekend senza bloccarmi',
  'Seguo un episodio di una serie con sottotitoli in tedesco',
  "Scrivo un messaggio a un amico senza tradurre dall'italiano",
];

const DEFAULTS = { goalLabel: 'B1', goalHours: 350, weeklyTarget: 6, methods: DEFAULT_METHODS };
const TITLES = { today: 'Oggi', stats: 'Statistiche', history: 'Storico', settings: 'Impostazioni' };
const DAY = 86400000;

const state = { sessions: [], checkpoints: [], settings: { ...DEFAULTS }, timer: null, lastExport: null };
let editingId = null;

// ---------- utils ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const today0 = () => startOfDay(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = d => { const x = startOfDay(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const fmtDur = min => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h ${pad(m)}m` : `${m}m`; };
const fmt1 = x => x.toFixed(1).replace('.', ',');
const fmtH = min => fmt1(min / 60);
const fmtMonthYear = d => d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
const fmtDayLong = d => d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDate = d => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = d => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const fmtClock = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const toLocalInput = d => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const sumMin = arr => arr.reduce((a, s) => a + s.minutes, 0);
const inRange = (s, from, to) => { const t = new Date(s.date); return t >= from && t < to; };
const daysSince = d => Math.floor((today0() - startOfDay(d)) / DAY);
const sortSessions = () => state.sessions.sort((a, b) => b.date.localeCompare(a.date));

// ---------- data ----------
async function load() {
  const [sessions, checkpoints, settings, timer, lastExport] = await Promise.all([
    db.all('sessions'), db.all('checkpoints'),
    db.getSetting('settings'), db.getSetting('timer'), db.getSetting('lastExport'),
  ]);
  state.sessions = sessions;
  sortSessions();
  state.checkpoints = checkpoints.sort((a, b) => a.date.localeCompare(b.date));
  state.settings = { ...DEFAULTS, ...(settings || {}) };
  state.timer = timer || null;
  state.lastExport = lastExport || null;
}

async function saveSession(s) {
  await db.put('sessions', s);
  const i = state.sessions.findIndex(x => x.id === s.id);
  if (i >= 0) state.sessions[i] = s; else state.sessions.push(s);
  sortSessions();
  renderAll();
}

async function deleteSession(id) {
  await db.del('sessions', id);
  state.sessions = state.sessions.filter(s => s.id !== id);
  renderAll();
}

// ---------- calcoli ----------
function minutesByDay() {
  const m = new Map();
  for (const s of state.sessions) { const k = dayKey(s.date); m.set(k, (m.get(k) || 0) + s.minutes); }
  return m;
}

function currentStreak(byDay) {
  let d = new Date(), n = 0;
  if (!byDay.has(dayKey(d))) d = addDays(d, -1); // oggi non ancora fatto: la streak non è rotta
  while (byDay.has(dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

function bestStreak(byDay) {
  let best = 0, cur = 0, prev = null;
  for (const k of [...byDay.keys()].sort()) {
    const d = new Date(k + 'T12:00:00');
    cur = prev && Math.round((d - prev) / DAY) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

// minuti a settimana, media sulle ultime 4 settimane (o meno se hai iniziato da poco)
function weeklyPace() {
  if (!state.sessions.length) return 0;
  const from = addDays(today0(), -27);
  const first = startOfDay(state.sessions[state.sessions.length - 1].date);
  const startD = first > from ? first : from;
  const spanDays = Math.max(7, Math.round((today0() - startD) / DAY) + 1);
  const min = sumMin(state.sessions.filter(s => new Date(s.date) >= startD));
  return min / spanDays * 7;
}

function goalInfo() {
  const total = sumMin(state.sessions);
  const goalMin = state.settings.goalHours * 60;
  const remaining = Math.max(0, goalMin - total);
  const pace = weeklyPace();
  const targetMin = state.settings.weeklyTarget * 60;
  const proj = w => new Date(Date.now() + w * 7 * DAY);
  return {
    total, goalMin, remaining, pace,
    pct: Math.min(100, total / goalMin * 100),
    datePace: pace > 0 && remaining > 0 ? proj(remaining / pace) : null,
    dateTarget: targetMin > 0 && remaining > 0 ? proj(remaining / targetMin) : null,
  };
}

function methodStats() {
  const m = new Map();
  for (const s of state.sessions) {
    if (!m.has(s.method)) m.set(s.method, { method: s.method, min: 0, n: 0, enj: 0, lrn: 0, last: null });
    const o = m.get(s.method);
    o.min += s.minutes; o.n++; o.enj += s.enjoy || 0; o.lrn += s.learned || 0;
    const d = new Date(s.date);
    if (!o.last || d > o.last) o.last = d;
  }
  return [...m.values()].map(o => ({ ...o, avgEnj: o.enj / o.n, avgLrn: o.lrn / o.n })).sort((a, b) => b.min - a.min);
}

function timeOfDayStats() {
  const slots = [
    { k: 'Mattina', from: 5, to: 12 }, { k: 'Pomeriggio', from: 12, to: 18 }, { k: 'Sera', from: 18, to: 29 },
  ].map(s => ({ ...s, min: 0, n: 0, lrn: 0 }));
  for (const s of state.sessions) {
    let h = new Date(s.date).getHours(); if (h < 5) h += 24;
    const slot = slots.find(x => h >= x.from && h < x.to);
    slot.min += s.minutes; slot.n++; slot.lrn += s.learned || 0;
  }
  return slots.map(s => ({ ...s, avgLrn: s.n ? s.lrn / s.n : 0 }));
}

function insights(ms, tod) {
  const out = [];
  const total = sumMin(state.sessions);
  if (!state.sessions.length) return ['Ancora nessun dato: registra le prime sessioni.'];

  const top = ms[0];
  out.push(`Passi più tempo su <b>${esc(top.method)}</b> (${Math.round(top.min / total * 100)}% del totale).`);

  const rated = ms.filter(m => m.n >= 3);
  if (rated.length >= 2) {
    const bestL = [...rated].sort((a, b) => b.avgLrn - a.avgLrn)[0];
    const bestE = [...rated].sort((a, b) => b.avgEnj - a.avgEnj)[0];
    out.push(`Ti sembra di imparare di più con <b>${esc(bestL.method)}</b> (${fmt1(bestL.avgLrn)}/5).`);
    if (bestE.method !== bestL.method) out.push(`Ti diverti di più con <b>${esc(bestE.method)}</b> (${fmt1(bestE.avgEnj)}/5): ottimo per i giorni di poca voglia.`);
    if (rated.some(m => m.method === top.method) && top.method !== bestL.method && bestL.avgLrn - top.avgLrn >= 0.7) {
      out.push(`<b>${esc(top.method)}</b> ti prende più tempo, ma <b>${esc(bestL.method)}</b> ti rende di più: valuta di spostare ore.`);
    }
    for (const m of rated.filter(m => m.avgLrn <= 2.5 && m.avgEnj <= 2.5)) {
      out.push(`<b>${esc(m.method)}</b> non ti piace e ti rende poco (${fmt1(m.avgLrn)}/5): forse è da cambiare.`);
    }
  } else {
    out.push('Servono almeno 3 sessioni per metodo (su almeno 2 metodi) per confrontarli.');
  }

  for (const m of ms.filter(m => m.n >= 2 && daysSince(m.last) >= 14)) {
    out.push(`Non usi <b>${esc(m.method)}</b> da ${daysSince(m.last)} giorni.`);
  }

  const todRated = tod.filter(t => t.n >= 3);
  if (todRated.length >= 2) {
    const b = [...todRated].sort((a, b) => b.avgLrn - a.avgLrn)[0];
    out.push(`Rendi meglio di <b>${b.k.toLowerCase()}</b> (${fmt1(b.avgLrn)}/5 di apprendimento percepito).`);
  }

  const active28 = new Set(state.sessions.filter(s => new Date(s.date) >= addDays(today0(), -27)).map(s => dayKey(s.date))).size;
  out.push(`Negli ultimi 28 giorni hai studiato in ${active28} giorni su 28.`);
  return out;
}

// ---------- componenti ----------
const kpi = (label, value) => `<div class="kpi"><div class="kpi-v">${value}</div><div class="kpi-l">${label}</div></div>`;

function barsHTML(items, targetPerItem, valFmt) {
  const max = Math.max(targetPerItem || 0, ...items.map(i => i.min), 1);
  const tgt = targetPerItem ? `<div class="tgt" style="bottom:${targetPerItem / max * 100}%"></div>` : '';
  return `<div class="bars">${items.map(i => `
    <div class="bar-wrap">
      <div class="bar-val">${i.min ? valFmt(i.min) : ''}</div>
      <div class="bar-track">${tgt}<div class="bar ${i.cur ? 'cur' : ''} ${targetPerItem && i.min >= targetPerItem ? 'ok' : ''}" style="height:${i.min / max * 100}%"></div></div>
      <div class="bar-lbl">${i.label}</div>
    </div>`).join('')}</div>`;
}

function heatmapHTML(byDay) {
  const weeks = 16;
  const start = addDays(startOfWeek(new Date()), -7 * (weeks - 1));
  const t0 = today0();
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const min = byDay.get(dayKey(d)) || 0;
    const lvl = d > t0 ? 'x' : min === 0 ? 0 : min < 15 ? 1 : min < 30 ? 2 : min < 60 ? 3 : 4;
    cells += `<div class="hm l${lvl}" title="${dayKey(d)}: ${fmtDur(min)}"></div>`;
  }
  return `<div class="heatmap">${cells}</div>
    <div class="hm-legend">meno <span class="hm l0"></span><span class="hm l1"></span><span class="hm l2"></span><span class="hm l3"></span><span class="hm l4"></span> più</div>`;
}

function goalHTML() {
  const g = goalInfo();
  const label = esc(state.settings.goalLabel);
  let proj;
  if (g.remaining <= 0) proj = `<p><b>Obiettivo ore raggiunto!</b> Fai un checkpoint e valuta se alzare l'asticella.</p>`;
  else if (!state.sessions.length) proj = `<p class="muted">Registra qualche sessione per vedere la proiezione.</p>`;
  else proj = `
    <p>Al ritmo attuale (<b>${fmt1(g.pace / 60)} h/sett.</b>) arrivi a ${label} a <b>${g.datePace ? fmtMonthYear(g.datePace) : '—'}</b>.</p>
    ${g.dateTarget ? `<p class="muted">Con il target di ${fmt1(state.settings.weeklyTarget)} h/sett.: ${fmtMonthYear(g.dateTarget)}.</p>` : ''}`;
  return `<h2>Verso ${label}</h2>
    <div class="progress"><div style="width:${g.pct}%"></div></div>
    <p class="progress-lbl"><b>${fmtH(g.total)} h</b> di ${state.settings.goalHours} h · ${Math.floor(g.pct)}%</p>
    ${proj}`;
}

const ratingHTML = (name, value) => [1, 2, 3, 4, 5].map(n =>
  `<label class="rate"><input type="radio" name="${name}" value="${n}" ${n === value ? 'checked' : ''} required><span>${n}</span></label>`).join('');

function methodOptions(selected) {
  const list = [...state.settings.methods];
  if (selected && !list.includes(selected)) list.push(selected);
  return list.map(m => `<option ${m === selected ? 'selected' : ''}>${esc(m)}</option>`).join('');
}

// ---------- render ----------
function renderTimer() {
  const t = state.timer;
  const disp = $('#timer-display');
  disp.textContent = fmtClock(timerElapsed());
  disp.classList.toggle('running', !!t?.running);
  disp.classList.toggle('paused', !!t && !t.running);
  const b = $('#timer-buttons');
  const mode = !t ? 'idle' : t.running ? 'run' : 'pause';
  if (b.dataset.mode !== mode) {
    b.dataset.mode = mode;
    b.innerHTML = mode === 'idle'
      ? `<button class="btn primary big" data-act="start">Inizia</button>`
      : mode === 'run'
        ? `<button class="btn big" data-act="pause">Pausa</button><button class="btn primary big" data-act="stop">Termina</button>`
        : `<button class="btn big" data-act="resume">Riprendi</button><button class="btn primary big" data-act="stop">Termina</button><button class="btn ghost" data-act="discard">Scarta</button>`;
  }
}

function renderToday() {
  const byDay = minutesByDay();
  const now = new Date();
  const ws = startOfWeek(now);
  const wMin = sumMin(state.sessions.filter(s => inRange(s, ws, addDays(ws, 7))));
  const target = state.settings.weeklyTarget * 60;

  $('#timer-method').innerHTML = methodOptions(state.timer?.method || state.settings.methods[0]);
  $('#today-kpis').innerHTML =
    kpi('Oggi', fmtDur(byDay.get(dayKey(now)) || 0)) +
    kpi('Streak', `${currentStreak(byDay)} gg`) +
    kpi('Settimana', `${fmtH(wMin)}<small>/${fmt1(state.settings.weeklyTarget)} h</small>`);

  $('#goal-card').innerHTML = goalHTML();

  const days = [...Array(7)].map((_, i) => {
    const d = addDays(ws, i);
    return { label: 'LMMGVSD'[i], min: byDay.get(dayKey(d)) || 0, cur: dayKey(d) === dayKey(now) };
  });
  $('#week-card').innerHTML = `<h2>Questa settimana</h2>
    ${barsHTML(days, target / 7, m => Math.round(m) + "'")}
    <p class="muted">${wMin >= target ? 'Target settimanale raggiunto 🎉' : `Mancano ${fmtDur(target - wMin)} al target.`}</p>`;

  const banners = [];
  const lastCp = state.checkpoints.at(-1);
  if (state.sessions.length && (!lastCp || daysSince(lastCp.date) >= 30)) {
    banners.push(`<button class="banner" data-act="checkpoint"><b>È ora del checkpoint</b><span>2 minuti per misurare i progressi reali →</span></button>`);
  }
  if (state.sessions.length >= 5 && (!state.lastExport || daysSince(state.lastExport) >= 14)) {
    banners.push(`<button class="banner warn" data-act="export"><b>Fai un backup</b><span>I dati sono solo su questo telefono. Esporta →</span></button>`);
  }
  $('#banners').innerHTML = banners.join('');
  renderTimer();
}

function renderStats() {
  const el = $('#stats');
  if (!state.sessions.length) {
    el.innerHTML = `<div class="card empty">Nessuna sessione ancora.<br>Le statistiche compaiono qui appena inizi a registrare.</div>`;
    return;
  }
  const byDay = minutesByDay();
  const total = sumMin(state.sessions);
  const ms = methodStats();
  const tod = timeOfDayStats();
  const ws = startOfWeek(new Date());
  const weeks = [...Array(8)].map((_, i) => {
    const from = addDays(ws, -7 * (7 - i));
    return { label: `${from.getDate()}/${from.getMonth() + 1}`, min: sumMin(state.sessions.filter(s => inRange(s, from, addDays(from, 7)))), cur: i === 7 };
  });
  const maxM = Math.max(...ms.map(m => m.min));

  el.innerHTML = `
    <div class="kpis">
      ${kpi('Ore totali', fmtH(total))}
      ${kpi('Sessioni', state.sessions.length)}
      ${kpi('Media sess.', fmtDur(total / state.sessions.length))}
    </div>
    <div class="kpis">
      ${kpi('Streak', `${currentStreak(byDay)} gg`)}
      ${kpi('Record', `${bestStreak(byDay)} gg`)}
      ${kpi('Ritmo', `${fmt1(weeklyPace() / 60)}<small> h/sett</small>`)}
    </div>

    <div class="card"><h2>Cosa dicono i dati</h2><ul class="insights">${insights(ms, tod).map(i => `<li>${i}</li>`).join('')}</ul></div>

    <div class="card"><h2>Ultime 8 settimane</h2>${barsHTML(weeks, state.settings.weeklyTarget * 60, m => fmtH(m))}
      <p class="muted small">La linea tratteggiata è il target settimanale.</p></div>

    <div class="card"><h2>Costanza · 16 settimane</h2>${heatmapHTML(byDay)}</div>

    <div class="card"><h2>Metodi</h2>
      <div class="methods">${ms.map(m => `
        <div class="method">
          <div class="method-head"><b>${esc(m.method)}</b><span>${fmtH(m.min)} h · ${m.n} sess.</span></div>
          <div class="mbar"><div style="width:${m.min / maxM * 100}%"></div></div>
          <div class="method-scores"><span>Piacere <b>${fmt1(m.avgEnj)}</b></span><span>Apprendimento <b>${fmt1(m.avgLrn)}</b></span><span class="muted">ultima: ${daysSince(m.last) === 0 ? 'oggi' : daysSince(m.last) + ' gg fa'}</span></div>
        </div>`).join('')}</div>
    </div>

    <div class="card"><h2>Momento della giornata</h2>
      <div class="kpis inner">${tod.map(t => kpi(t.k, `${fmtH(t.min)} h<small class="sub">${t.n ? `appr. ${fmt1(t.avgLrn)}/5` : '–'}</small>`)).join('')}</div>
      <p class="muted small">Ore studiate e apprendimento percepito medio per fascia.</p>
    </div>

    ${checkpointHistoryHTML()}`;
}

function checkpointHistoryHTML() {
  const cps = state.checkpoints;
  if (!cps.length) return `<div class="card"><h2>Checkpoint</h2><p class="muted">Nessun checkpoint ancora. Fanne uno da Impostazioni o dal banner in Oggi.</p></div>`;
  const last = cps.at(-1), prev = cps.at(-2);
  const rows = CHECK_QUESTIONS.map((q, i) => {
    const v = last.answers[i], p = prev?.answers[i];
    const delta = p != null && v != null ? v - p : null;
    return `<div class="cp-row"><span>${esc(q)}</span><b>${v ?? '–'}${delta ? `<em class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : ''}${delta}</em>` : ''}</b></div>`;
  }).join('');
  const trend = cps.slice(-6).map(c => `<div class="cp-pill"><b>${fmt1(c.avg)}</b><span>${new Date(c.date).toLocaleDateString('it-IT', { month: 'short' })}</span></div>`).join('');
  return `<div class="card"><h2>Checkpoint</h2>
    <div class="cp-trend">${trend}</div>
    <p class="muted small">Ultimo: ${fmtDate(new Date(last.date))}${prev ? ' · variazioni rispetto al precedente' : ''}</p>
    ${rows}</div>`;
}

function renderHistory() {
  const el = $('#history');
  if (!state.sessions.length) { el.innerHTML = `<div class="card empty">Nessuna sessione registrata.</div>`; return; }
  const groups = new Map();
  for (const s of state.sessions) {
    const k = dayKey(s.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  el.innerHTML = [...groups.entries()].map(([k, list]) => `
    <div class="day">
      <div class="day-head"><span>${fmtDayLong(new Date(k + 'T12:00:00'))}</span><span>${fmtDur(sumMin(list))}</span></div>
      ${list.map(s => `
        <button class="sess" data-id="${s.id}">
          <div class="sess-main"><b>${esc(s.method)}</b><span>${fmtTime(new Date(s.date))} · ${fmtDur(s.minutes)}</span></div>
          <div class="sess-sub"><span>Piacere ${s.enjoy}/5 · Appr. ${s.learned}/5</span>${s.note ? `<span class="note">${esc(s.note)}</span>` : ''}</div>
        </button>`).join('')}
    </div>`).join('');
}

function renderSettings() {
  const f = $('#settings-form');
  f.goalLabel.value = state.settings.goalLabel;
  f.goalHours.value = state.settings.goalHours;
  f.weeklyTarget.value = state.settings.weeklyTarget;
  f.methods.value = state.settings.methods.join('\n');
  $('#backup-info').textContent = state.lastExport
    ? `Ultimo backup: ${fmtDate(new Date(state.lastExport))}. I dati vivono solo su questo dispositivo.`
    : 'Nessun backup ancora. I dati vivono solo su questo dispositivo: esportali ogni tanto in File o iCloud Drive.';
  $('#version').textContent = `Deutsch Tracker v${APP_VERSION} · ${state.sessions.length} sessioni`;
}

function renderAll() {
  renderToday(); renderStats(); renderHistory(); renderSettings();
}

// ---------- timer ----------
function timerElapsed() {
  const t = state.timer;
  if (!t) return 0;
  return t.acc + (t.running ? Date.now() - t.since : 0);
}

async function setTimer(t) { state.timer = t; await db.setSetting('timer', t); renderTimer(); }

async function timerAction(act) {
  const t = state.timer;
  if (act === 'start') await setTimer({ acc: 0, since: Date.now(), running: true, startedAt: Date.now(), method: $('#timer-method').value });
  if (act === 'pause' && t) await setTimer({ ...t, acc: t.acc + Date.now() - t.since, running: false });
  if (act === 'resume' && t) await setTimer({ ...t, since: Date.now(), running: true });
  if (act === 'discard' && t && confirm('Scartare questa sessione?')) await setTimer(null);
  if (act === 'stop' && t) {
    const minutes = Math.max(1, Math.round(timerElapsed() / 60000));
    const { startedAt, method } = t;
    await setTimer(null);
    openSessionDialog({ date: new Date(startedAt).toISOString(), minutes, method });
  }
}

// ---------- dialog sessione ----------
function openSessionDialog(s = {}, isEdit = false) {
  editingId = isEdit ? s.id : null;
  const f = $('#session-form');
  $('#session-title').textContent = isEdit ? 'Modifica sessione' : 'Nuova sessione';
  $('#f-method').innerHTML = methodOptions(s.method || $('#timer-method').value);
  f.date.value = toLocalInput(s.date || new Date(Date.now() - 30 * 60000));
  f.minutes.value = s.minutes || 30;
  $('#f-enjoy').innerHTML = ratingHTML('enjoy', s.enjoy || 3);
  $('#f-learned').innerHTML = ratingHTML('learned', s.learned || 3);
  f.note.value = s.note || '';
  $('#f-delete').hidden = !isEdit;
  $('#session-dialog').showModal();
}

async function submitSession(e) {
  e.preventDefault();
  const f = e.target;
  const minutes = parseInt(f.minutes.value, 10);
  if (!(minutes > 0)) return;
  await saveSession({
    id: editingId || uid(),
    method: f.method.value,
    date: new Date(f.date.value).toISOString(),
    minutes,
    enjoy: parseInt(f.enjoy.value, 10),
    learned: parseInt(f.learned.value, 10),
    note: f.note.value.trim(),
  });
  $('#session-dialog').close();
}

// ---------- checkpoint ----------
function openCheckpoint() {
  $('#cp-questions').innerHTML = CHECK_QUESTIONS.map((q, i) =>
    `<fieldset><legend>${esc(q)}</legend><div class="rating">${ratingHTML('q' + i, null)}</div></fieldset>`).join('');
  $('#checkpoint-form').note.value = '';
  $('#checkpoint-dialog').showModal();
}

async function submitCheckpoint(e) {
  e.preventDefault();
  const f = e.target;
  const answers = CHECK_QUESTIONS.map((_, i) => parseInt(f['q' + i].value, 10));
  const cp = { id: uid(), date: new Date().toISOString(), answers, avg: answers.reduce((a, b) => a + b, 0) / answers.length, note: f.note.value.trim() };
  await db.put('checkpoints', cp);
  state.checkpoints.push(cp);
  $('#checkpoint-dialog').close();
  renderAll();
  switchView('stats');
}

// ---------- backup ----------
async function exportData() {
  const data = {
    app: 'deutsch-tracker', version: 1, exportedAt: new Date().toISOString(),
    sessions: state.sessions, checkpoints: state.checkpoints, settings: state.settings,
  };
  const name = `deutsch-tracker-${dayKey(new Date())}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  let done = false;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); done = true; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  if (!done) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  state.lastExport = Date.now();
  await db.setSetting('lastExport', state.lastExport);
  renderAll();
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'deutsch-tracker' || !Array.isArray(data.sessions)) throw new Error('Formato non riconosciuto');
    if (!confirm(`Importare ${data.sessions.length} sessioni e ${data.checkpoints?.length || 0} checkpoint?\nLe voci già presenti con lo stesso id verranno sovrascritte.`)) return;
    await db.putMany('sessions', data.sessions);
    if (Array.isArray(data.checkpoints)) await db.putMany('checkpoints', data.checkpoints);
    if (data.settings) await db.setSetting('settings', { ...DEFAULTS, ...data.settings });
    await load();
    renderAll();
    alert('Import completato.');
  } catch (err) {
    alert('Import fallito: ' + err.message);
  }
}

async function wipe() {
  if (!confirm('Cancellare TUTTE le sessioni e i checkpoint?')) return;
  if (!confirm('Sicuro? Senza backup non si torna indietro.')) return;
  await Promise.all([db.clear('sessions'), db.clear('checkpoints'), db.setSetting('timer', null)]);
  await load();
  renderAll();
}

// ---------- navigazione ----------
function switchView(v) {
  $$('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#title').textContent = TITLES[v];
  window.scrollTo(0, 0);
}

// ---------- init ----------
async function init() {
  await load();
  renderAll();

  $$('.tabs button').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('#timer-buttons').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) timerAction(a.dataset.act); });
  $('#timer-method').addEventListener('change', e => { if (state.timer) setTimer({ ...state.timer, method: e.target.value }); });
  $('#btn-manual').addEventListener('click', () => openSessionDialog());
  $('#banners').addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'checkpoint') openCheckpoint();
    if (a?.dataset.act === 'export') exportData();
  });

  $('#session-form').addEventListener('submit', submitSession);
  $('#f-cancel').addEventListener('click', () => $('#session-dialog').close());
  $('#f-delete').addEventListener('click', async () => {
    if (editingId && confirm('Eliminare questa sessione?')) { await deleteSession(editingId); $('#session-dialog').close(); }
  });
  $('#history').addEventListener('click', e => {
    const b = e.target.closest('.sess');
    if (b) openSessionDialog(state.sessions.find(s => s.id === b.dataset.id), true);
  });

  $('#checkpoint-form').addEventListener('submit', submitCheckpoint);
  $('#cp-cancel').addEventListener('click', () => $('#checkpoint-dialog').close());
  $('#btn-checkpoint').addEventListener('click', openCheckpoint);

  $('#settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const methods = [...new Set(f.methods.value.split('\n').map(s => s.trim()).filter(Boolean))];
    state.settings = {
      goalLabel: f.goalLabel.value.trim() || 'B1',
      goalHours: Math.max(1, parseInt(f.goalHours.value, 10) || DEFAULTS.goalHours),
      weeklyTarget: Math.max(0.5, parseFloat(String(f.weeklyTarget.value).replace(',', '.')) || DEFAULTS.weeklyTarget),
      methods: methods.length ? methods : DEFAULT_METHODS,
    };
    await db.setSetting('settings', state.settings);
    renderAll();
    switchView('today');
  });
  $('#btn-export').addEventListener('click', exportData);
  $('#import-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; });
  $('#btn-wipe').addEventListener('click', wipe);

  setInterval(() => { if (state.timer?.running) renderTimer(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });

  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();

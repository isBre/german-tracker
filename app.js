import { db } from './db.js';

const APP_VERSION = '1.1.0';

// ---------- le 4 abilità ----------
const SKILLS = {
  ascolto:   { label: 'Ascolto',   de: 'Hören',     icon: '🎧' },
  lettura:   { label: 'Lettura',   de: 'Lesen',     icon: '📖' },
  scrittura: { label: 'Scrittura', de: 'Schreiben', icon: '✍️' },
  parlato:   { label: 'Parlato',   de: 'Sprechen',  icon: '🗣️' },
};
const SKILL_KEYS = Object.keys(SKILLS);

const DEFAULT_METHODS = [
  { name: 'Anki', skill: 'lettura' },
  { name: 'Nicos Weg', skill: 'ascolto' },
  { name: 'Easy German', skill: 'ascolto' },
  { name: 'Serie / Film', skill: 'ascolto' },
  { name: 'Podcast', skill: 'ascolto' },
  { name: 'Notizie / Lettura', skill: 'lettura' },
  { name: 'Grammatica', skill: 'scrittura' },
  { name: 'Diario / Scrittura', skill: 'scrittura' },
  { name: 'Chat con AI', skill: 'scrittura' },
  { name: 'Conversazione', skill: 'parlato' },
  { name: 'Voce con AI', skill: 'parlato' },
  { name: 'Shadowing', skill: 'parlato' },
];

const CHECK_QUESTIONS = [
  'Capisco un video di Easy German senza sottotitoli',
  'Leggo un articolo di nachrichtenleicht.de senza dizionario',
  'Seguo una conversazione tra due persone al bar',
  'Racconto la mia giornata o il weekend senza bloccarmi',
  'Seguo un episodio di una serie con sottotitoli in tedesco',
  "Scrivo un messaggio a un amico senza tradurre dall'italiano",
];

const DEFAULTS = {
  goalLabel: 'B1', goalHours: 350, weeklyTarget: 6,
  dailyGoal: 20, streakMin: 10, methods: DEFAULT_METHODS,
};
const TITLES = { today: 'Oggi', stats: 'Statistiche', history: 'Storico', settings: 'Impostazioni' };
const DAY = 86400000;
const MAX_FREEZE = 2;
const HOUR_MILESTONES = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 1000];
const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365, 500];

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

// ---------- metodi e abilità ----------
function guessSkill(name) {
  const n = String(name).toLowerCase();
  if (/(conver|parl|sprech|tandem|voce|voice|shadow|tutor|speak)/.test(n)) return 'parlato';
  if (/(scri|schreib|gramm|diario|chat|writ)/.test(n)) return 'scrittura';
  if (/(anki|lett|lesen|notiz|nachricht|libr|buch|read|news)/.test(n)) return 'lettura';
  return 'ascolto';
}

function matchSkill(str) {
  const s = String(str).trim().toLowerCase();
  if (!s) return null;
  return SKILL_KEYS.find(k => k.startsWith(s.slice(0, 4)) || SKILLS[k].de.toLowerCase().startsWith(s.slice(0, 4))) || null;
}

function normalizeMethods(list) {
  return (list || []).map(m => typeof m === 'string' ? { name: m, skill: guessSkill(m) } : m)
    .filter(m => m && m.name && SKILLS[m.skill]);
}

const methodSkill = name => state.settings.methods.find(m => m.name === name)?.skill || guessSkill(name);
const skillOf = s => (SKILLS[s.skill] ? s.skill : methodSkill(s.method));

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
  state.settings.methods = normalizeMethods(state.settings.methods);
  if (!state.settings.methods.length) state.settings.methods = DEFAULT_METHODS;
  state.timer = timer || null;
  state.lastExport = lastExport || null;
}

function snapshot() {
  const byDay = minutesByDay();
  return { hours: sumMin(state.sessions) / 60, streak: streakInfo(byDay).current, today: byDay.get(dayKey(new Date())) || 0 };
}

async function saveSession(s) {
  const before = snapshot();
  await db.put('sessions', s);
  const i = state.sessions.findIndex(x => x.id === s.id);
  if (i >= 0) state.sessions[i] = s; else state.sessions.push(s);
  sortSessions();
  renderAll();
  celebrate(before, snapshot());
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

// Streak stile Duolingo: un giorno conta se raggiungi il minimo.
// Ogni 7 giorni di streak guadagni un freeze (max 2); un giorno saltato consuma un freeze invece di azzerare.
// Tutto è ricalcolato dallo storico, quindi modificare o cancellare sessioni resta coerente.
function streakInfo(byDay) {
  const min = state.settings.streakMin;
  const t0 = today0();
  const todayMin = byDay.get(dayKey(t0)) || 0;
  const res = { current: 0, best: 0, freezes: 0, frozen: new Set(), todayDone: todayMin >= min };
  if (!state.sessions.length) return res;
  let cur = 0, freezes = 0;
  for (let d = startOfDay(state.sessions[state.sessions.length - 1].date); d <= t0; d = addDays(d, 1)) {
    const k = dayKey(d);
    const ok = (byDay.get(k) || 0) >= min;
    if (ok) {
      cur++;
      if (cur % 7 === 0) freezes = Math.min(MAX_FREEZE, freezes + 1);
    } else if (d.getTime() === t0.getTime()) {
      // oggi non ancora fatto: la giornata è ancora aperta
    } else if (cur > 0 && freezes > 0) {
      freezes--; res.frozen.add(k);
    } else {
      cur = 0;
    }
    res.best = Math.max(res.best, cur);
  }
  res.current = cur;
  res.freezes = freezes;
  return res;
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
    if (!m.has(s.method)) m.set(s.method, { method: s.method, skill: skillOf(s), min: 0, n: 0, enj: 0, lrn: 0, last: null });
    const o = m.get(s.method);
    o.min += s.minutes; o.n++; o.enj += s.enjoy || 0; o.lrn += s.learned || 0;
    const d = new Date(s.date);
    if (!o.last || d > o.last) o.last = d;
  }
  return [...m.values()].map(o => ({ ...o, avgEnj: o.enj / o.n, avgLrn: o.lrn / o.n })).sort((a, b) => b.min - a.min);
}

function skillStats(sessions = state.sessions) {
  const o = Object.fromEntries(SKILL_KEYS.map(k => [k, { k, min: 0, n: 0, lrn: 0 }]));
  for (const s of sessions) { const x = o[skillOf(s)]; x.min += s.minutes; x.n++; x.lrn += s.learned || 0; }
  const total = sumMin(sessions) || 1;
  return SKILL_KEYS.map(k => ({ ...o[k], share: o[k].min / total, avgLrn: o[k].n ? o[k].lrn / o[k].n : 0 }));
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

const SKILL_TIPS = {
  ascolto: 'prova Easy German o una serie con sottotitoli in tedesco',
  lettura: 'prova un articolo di nachrichtenleicht.de al giorno',
  scrittura: 'scrivi 5 frasi sulla tua giornata e falle correggere',
  parlato: 'prova 10 minuti di voce con l\'AI o di shadowing',
};

function insights(ms, tod) {
  const out = [];
  const total = sumMin(state.sessions);
  if (!state.sessions.length) return ['Ancora nessun dato: registra le prime sessioni.'];

  const top = ms[0];
  out.push(`Passi più tempo su <b>${esc(top.method)}</b> (${Math.round(top.min / total * 100)}% del totale).`);

  if (total >= 120) {
    const sk = skillStats();
    const weak = [...sk].sort((a, b) => a.share - b.share)[0];
    if (weak.share < 0.12) {
      out.push(`Stai trascurando <b>${SKILLS[weak.k].label.toLowerCase()}</b> (${Math.round(weak.share * 100)}% del tempo): ${SKILL_TIPS[weak.k]}.`);
    }
  }

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

function heatmapHTML(byDay, frozen) {
  const weeks = 16;
  const start = addDays(startOfWeek(new Date()), -7 * (weeks - 1));
  const t0 = today0();
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const k = dayKey(d);
    const min = byDay.get(k) || 0;
    const lvl = d > t0 ? 'x' : frozen.has(k) ? 'f' : min === 0 ? 0 : min < 15 ? 1 : min < 30 ? 2 : min < 60 ? 3 : 4;
    cells += `<div class="hm l${lvl}" title="${k}: ${fmtDur(min)}"></div>`;
  }
  return `<div class="heatmap">${cells}</div>
    <div class="hm-legend"><span class="hm lf"></span> freeze &nbsp; meno <span class="hm l0"></span><span class="hm l1"></span><span class="hm l2"></span><span class="hm l3"></span><span class="hm l4"></span> più</div>`;
}

function ringHTML(value, goal) {
  const r = 26, c = 2 * Math.PI * r, p = Math.min(1, value / goal);
  return `<svg class="ring" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="${r}" class="ring-bg"/>
    <circle cx="32" cy="32" r="${r}" class="ring-fg ${p >= 1 ? 'done' : ''}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/>
  </svg>`;
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

function skillBarsHTML(stats, showLearn) {
  const max = Math.max(...stats.map(s => s.min), 1);
  return `<div class="skills">${stats.map(s => `
    <div class="skill">
      <div class="skill-head"><span>${SKILLS[s.k].icon} <b>${SKILLS[s.k].label}</b> <span class="muted small">${SKILLS[s.k].de}</span></span>
        <span class="muted small">${fmtDur(s.min)}${showLearn ? ` · ${Math.round(s.share * 100)}%` : ''}</span></div>
      <div class="mbar sk-${s.k}"><div style="width:${s.min / max * 100}%"></div></div>
      ${showLearn && s.n ? `<div class="muted small">Apprendimento percepito ${fmt1(s.avgLrn)}/5 · ${s.n} sess.</div>` : ''}
    </div>`).join('')}</div>`;
}

const ratingHTML = (name, value) => [1, 2, 3, 4, 5].map(n =>
  `<label class="rate"><input type="radio" name="${name}" value="${n}" ${n === value ? 'checked' : ''} required><span>${n}</span></label>`).join('');

const skillPickHTML = value => SKILL_KEYS.map(k =>
  `<label class="rate"><input type="radio" name="skill" value="${k}" ${k === value ? 'checked' : ''} required><span>${SKILLS[k].icon}<br><small>${SKILLS[k].label}</small></span></label>`).join('');

function methodOptions(selected) {
  const names = state.settings.methods.map(m => m.name);
  if (selected && !names.includes(selected)) names.push(selected);
  return names.map(n => `<option ${n === selected ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

// ---------- toast / celebrazioni ----------
let toastTimer;
function toast(html) {
  const el = $('#toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}

function celebrate(before, after) {
  const hourHit = HOUR_MILESTONES.filter(x => x > before.hours && x <= after.hours).pop();
  const streakHit = STREAK_MILESTONES.filter(x => x > before.streak && x <= after.streak).pop();
  const goal = state.settings.dailyGoal;
  if (streakHit) toast(`🔥 <b>${streakHit} giorni di fila!</b><br>${streakHit % 7 === 0 ? 'Hai guadagnato un 🧊 freeze.' : 'Continua così.'}`);
  else if (hourHit) toast(`🏅 <b>${hourHit} ore di tedesco!</b><br>Traguardo raggiunto.`);
  else if (before.today < goal && after.today >= goal) toast(`✅ <b>Obiettivo di oggi raggiunto</b><br>${fmtDur(after.today)} su ${goal} min.`);
  else if (after.streak > before.streak) toast(`🔥 <b>Streak: ${after.streak}</b><br>Oggi è al sicuro.`);
}

// ---------- badge sull'icona ----------
function updateBadge(todayDone) {
  try {
    if (!('setAppBadge' in navigator) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (todayDone) navigator.clearAppBadge(); else navigator.setAppBadge(1);
  } catch { /* non supportato */ }
}

async function enableBadge() {
  if (typeof Notification === 'undefined' || !('setAppBadge' in navigator)) {
    alert("Il badge funziona solo con l'app installata sulla schermata Home (iOS 16.4+). Aprila dall'icona e riprova.");
    return;
  }
  const p = await Notification.requestPermission();
  if (p === 'granted') { renderAll(); toast('🔴 Badge attivo: lo vedi finché non fai il minimo di oggi.'); }
  else alert('Permesso negato. Puoi riattivarlo da Impostazioni iOS → Notifiche.');
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
  const weekSessions = state.sessions.filter(s => inRange(s, ws, addDays(ws, 7)));
  const wMin = sumMin(weekSessions);
  const target = state.settings.weeklyTarget * 60;
  const todayMin = byDay.get(dayKey(now)) || 0;
  const st = streakInfo(byDay);
  const { dailyGoal, streakMin } = state.settings;

  // streak + obiettivo del giorno
  let msg;
  if (st.todayDone) msg = todayMin >= dailyGoal ? 'Oggi fatto e obiettivo raggiunto. 💪' : `Streak al sicuro. Altri ${fmtDur(dailyGoal - todayMin)} per l'obiettivo del giorno.`;
  else if (st.current > 0) msg = `Fai almeno <b>${streakMin} min</b> oggi per tenere la streak${st.freezes ? ` (hai ${st.freezes} 🧊 di riserva)` : ''}.`;
  else msg = `Inizia una nuova streak: bastano <b>${streakMin} min</b>.`;
  const nextS = STREAK_MILESTONES.find(x => x > st.current);
  const nextH = HOUR_MILESTONES.find(x => x > sumMin(state.sessions) / 60);
  $('#streak-card').innerHTML = `
    <div class="streak-top">
      <div class="flame ${st.todayDone ? 'on' : ''}">🔥</div>
      <div class="streak-num"><b>${st.current}</b><span>${st.current === 1 ? 'giorno' : 'giorni'} di fila</span></div>
      <div class="freeze" title="Freeze: salvano la streak se salti un giorno">🧊 ${st.freezes}/${MAX_FREEZE}</div>
      <div class="ring-wrap">${ringHTML(todayMin, dailyGoal)}<span>${Math.round(todayMin)}<small>/${dailyGoal}'</small></span></div>
    </div>
    <p class="streak-msg">${msg}</p>
    <p class="muted small">Prossimi traguardi: 🔥 ${nextS} giorni · 🏅 ${nextH} h</p>`;

  $('#timer-method').innerHTML = methodOptions(state.timer?.method || state.settings.methods[0].name);

  // registrazione rapida: i 4 metodi più usati
  const counts = new Map();
  state.sessions.forEach(s => counts.set(s.method, (counts.get(s.method) || 0) + 1));
  const quick = [...state.settings.methods].sort((a, b) => (counts.get(b.name) || 0) - (counts.get(a.name) || 0)).slice(0, 4);
  $('#quick').innerHTML = `<div class="muted small">Registra al volo 15 min</div>
    <div class="chips">${quick.map(m => `<button class="chip" data-method="${esc(m.name)}">${SKILLS[m.skill].icon} ${esc(m.name)}</button>`).join('')}</div>`;

  $('#today-kpis').innerHTML =
    kpi('Oggi', fmtDur(todayMin)) +
    kpi('Record', `${st.best} gg`) +
    kpi('Settimana', `${fmtH(wMin)}<small>/${fmt1(state.settings.weeklyTarget)} h</small>`);

  $('#goal-card').innerHTML = goalHTML();

  const days = [...Array(7)].map((_, i) => {
    const d = addDays(ws, i);
    return { label: 'LMMGVSD'[i], min: byDay.get(dayKey(d)) || 0, cur: dayKey(d) === dayKey(now) };
  });
  $('#week-card').innerHTML = `<h2>Questa settimana</h2>
    ${barsHTML(days, target / 7, m => Math.round(m) + "'")}
    <p class="muted">${wMin >= target ? 'Target settimanale raggiunto 🎉' : `Mancano ${fmtDur(target - wMin)} al target.`}</p>
    <h2 style="margin-top:14px">Abilità della settimana</h2>
    ${skillBarsHTML(skillStats(weekSessions), false)}`;

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
  updateBadge(st.todayDone);
}

function renderStats() {
  const el = $('#stats');
  if (!state.sessions.length) {
    el.innerHTML = `<div class="card empty">Nessuna sessione ancora.<br>Le statistiche compaiono qui appena inizi a registrare.</div>`;
    return;
  }
  const byDay = minutesByDay();
  const st = streakInfo(byDay);
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
      ${kpi('Streak', `${st.current} gg`)}
      ${kpi('Record', `${st.best} gg`)}
      ${kpi('Ritmo', `${fmt1(weeklyPace() / 60)}<small> h/sett</small>`)}
    </div>

    <div class="card"><h2>Cosa dicono i dati</h2><ul class="insights">${insights(ms, tod).map(i => `<li>${i}</li>`).join('')}</ul></div>

    <div class="card"><h2>Le 4 abilità</h2>${skillBarsHTML(skillStats(), true)}
      <p class="muted small">Per conversare servono tutte e quattro: se una resta sotto il 10–15% del tempo, è lì che si crea il buco.</p></div>

    <div class="card"><h2>Ultime 8 settimane</h2>${barsHTML(weeks, state.settings.weeklyTarget * 60, m => fmtH(m))}
      <p class="muted small">La linea tratteggiata è il target settimanale.</p></div>

    <div class="card"><h2>Costanza · 16 settimane</h2>${heatmapHTML(byDay, st.frozen)}</div>

    <div class="card"><h2>Metodi</h2>
      <div class="methods">${ms.map(m => `
        <div class="method">
          <div class="method-head"><b>${SKILLS[m.skill].icon} ${esc(m.method)}</b><span>${fmtH(m.min)} h · ${m.n} sess.</span></div>
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
          <div class="sess-main"><b>${SKILLS[skillOf(s)].icon} ${esc(s.method)}</b><span>${fmtTime(new Date(s.date))} · ${fmtDur(s.minutes)}</span></div>
          <div class="sess-sub"><span>Piacere ${s.enjoy}/5 · Appr. ${s.learned}/5</span>${s.note ? `<span class="note">${esc(s.note)}</span>` : ''}</div>
        </button>`).join('')}
    </div>`).join('');
}

function renderSettings() {
  const f = $('#settings-form');
  f.goalLabel.value = state.settings.goalLabel;
  f.goalHours.value = state.settings.goalHours;
  f.weeklyTarget.value = state.settings.weeklyTarget;
  f.dailyGoal.value = state.settings.dailyGoal;
  f.streakMin.value = state.settings.streakMin;
  f.methods.value = state.settings.methods.map(m => `${m.name} = ${SKILLS[m.skill].label.toLowerCase()}`).join('\n');
  $('#backup-info').textContent = state.lastExport
    ? `Ultimo backup: ${fmtDate(new Date(state.lastExport))}. I dati vivono solo su questo dispositivo.`
    : 'Nessun backup ancora. I dati vivono solo su questo dispositivo: esportali ogni tanto in File o iCloud Drive.';
  const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  $('#btn-badge').textContent = granted ? 'Badge attivo ✓' : "Attiva badge sull'icona";
  $('#btn-badge').disabled = granted;
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
  const method = s.method || $('#timer-method').value;
  $('#session-title').textContent = isEdit ? 'Modifica sessione' : 'Nuova sessione';
  $('#f-method').innerHTML = methodOptions(method);
  $('#f-skill').innerHTML = skillPickHTML(isEdit ? skillOf(s) : methodSkill(method));
  const minutes = s.minutes || 30;
  f.date.value = toLocalInput(s.date || new Date(Date.now() - minutes * 60000));
  f.minutes.value = minutes;
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
    skill: f.skill.value,
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
  $('#quick').addEventListener('click', e => {
    const c = e.target.closest('[data-method]');
    if (c) openSessionDialog({ method: c.dataset.method, minutes: 15 });
  });
  $('#banners').addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'checkpoint') openCheckpoint();
    if (a?.dataset.act === 'export') exportData();
  });

  $('#session-form').addEventListener('submit', submitSession);
  $('#f-method').addEventListener('change', e => { $('#f-skill').innerHTML = skillPickHTML(methodSkill(e.target.value)); });
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
  $('#btn-badge').addEventListener('click', enableBadge);

  $('#settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const seen = new Set();
    const methods = f.methods.value.split('\n').map(line => {
      const [name, skill] = line.split('=');
      const n = (name || '').trim();
      if (!n || seen.has(n)) return null;
      seen.add(n);
      return { name: n, skill: matchSkill(skill || '') || guessSkill(n) };
    }).filter(Boolean);
    const num = (v, d) => { const x = parseFloat(String(v).replace(',', '.')); return x > 0 ? x : d; };
    state.settings = {
      goalLabel: f.goalLabel.value.trim() || 'B1',
      goalHours: Math.round(num(f.goalHours.value, DEFAULTS.goalHours)),
      weeklyTarget: num(f.weeklyTarget.value, DEFAULTS.weeklyTarget),
      dailyGoal: Math.round(num(f.dailyGoal.value, DEFAULTS.dailyGoal)),
      streakMin: Math.round(num(f.streakMin.value, DEFAULTS.streakMin)),
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

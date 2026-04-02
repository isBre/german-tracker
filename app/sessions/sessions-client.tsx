"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Topic } from "@/lib/schema";
import Select from "@/components/select";

type SessionRow = {
  id: number;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  createdAt: string;
  topicId: number | null;
  topicName: string | null;
  issueId: number | null;
  issueTitle: string | null;
};

type IssueOption = { id: number; title: string; status: string };

function fmt(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}Std`;
  return `${h}Std ${m}min`;
}

function fmtMinutes(minutes: number) { return fmt(minutes / 60); }

function fmtDate(str: string) {
  return new Date(str).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const TIMER_KEY = "gt_timer_start";

type LinkType = "topic" | "problem";

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function SessionsClient({
  initialSessions,
  topics,
  issues,
}: {
  initialSessions: SessionRow[];
  topics: Topic[];
  issues: IssueOption[];
}) {
  const [sessions, setSessions] = useState(initialSessions);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [timerLinkType, setTimerLinkType] = useState<LinkType>("topic");
  const [timerTopicId, setTimerTopicId] = useState("");
  const [timerIssueId, setTimerIssueId] = useState("");
  const [timerNotes, setTimerNotes] = useState("");

  // Manual form state
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualLinkType, setManualLinkType] = useState<LinkType>("topic");
  const [manualTopicId, setManualTopicId] = useState("");
  const [manualIssueId, setManualIssueId] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editingSession, setEditingSession] = useState<SessionRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editLinkType, setEditLinkType] = useState<LinkType>("topic");
  const [editTopicId, setEditTopicId] = useState("");
  const [editIssueId, setEditIssueId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(TIMER_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      setTimerStart(data.start);
      setTimerRunning(true);
      setTimerLinkType(data.linkType ?? "topic");
      setTimerTopicId(data.topicId ?? "");
      setTimerIssueId(data.issueId ?? "");
      setTimerNotes(data.notes ?? "");
      setActiveSessionId(data.sessionId ?? null);
    }
  }, []);

  useEffect(() => {
    if (timerRunning && timerStart) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - timerStart) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, timerStart]);

  const startTimer = useCallback(async () => {
    const start = Date.now();
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: new Date(start).toISOString(),
        topicId: timerLinkType === "topic" && timerTopicId ? parseInt(timerTopicId) : null,
        issueId: timerLinkType === "problem" && timerIssueId ? parseInt(timerIssueId) : null,
        notes: timerNotes || null,
      }),
    });
    const session = await res.json();
    setTimerStart(start);
    setTimerRunning(true);
    setActiveSessionId(session.id);
    localStorage.setItem(TIMER_KEY, JSON.stringify({
      start, linkType: timerLinkType,
      topicId: timerTopicId, issueId: timerIssueId,
      notes: timerNotes, sessionId: session.id,
    }));
  }, [timerLinkType, timerTopicId, timerIssueId, timerNotes]);

  const stopTimer = useCallback(async () => {
    if (!timerStart || !activeSessionId) return;
    const endTime = new Date().toISOString();
    const durationMinutes = (Date.now() - timerStart) / 1000 / 60;
    await fetch(`/api/sessions/${activeSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endTime, durationMinutes,
        topicId: timerLinkType === "topic" && timerTopicId ? parseInt(timerTopicId) : null,
        issueId: timerLinkType === "problem" && timerIssueId ? parseInt(timerIssueId) : null,
        notes: timerNotes || null,
      }),
    });
    localStorage.removeItem(TIMER_KEY);
    setTimerRunning(false);
    setTimerStart(null);
    setElapsed(0);
    setActiveSessionId(null);
    setSessions(await (await fetch("/api/sessions")).json());
  }, [timerStart, activeSessionId, timerLinkType, timerTopicId, timerIssueId, timerNotes]);

  const logManual = async () => {
    const h = parseFloat(manualHours || "0");
    const m = parseFloat(manualMinutes || "0");
    const totalMinutes = h * 60 + m;
    if (totalMinutes <= 0) return;
    setSaving(true);
    const startTime = new Date(manualDate + "T09:00:00").toISOString();
    const endTime = new Date(new Date(startTime).getTime() + totalMinutes * 60 * 1000).toISOString();
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime, endTime, durationMinutes: totalMinutes,
        topicId: manualLinkType === "topic" && manualTopicId ? parseInt(manualTopicId) : null,
        issueId: manualLinkType === "problem" && manualIssueId ? parseInt(manualIssueId) : null,
        notes: manualNotes || null,
      }),
    });
    setSessions(await (await fetch("/api/sessions")).json());
    setSaving(false);
    setShowManual(false);
    setManualHours(""); setManualMinutes(""); setManualNotes("");
  };

  const deleteSession = async (id: number) => {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const openEdit = (s: SessionRow) => {
    const date = new Date(s.startTime).toISOString().split("T")[0];
    const totalMins = s.durationMinutes ?? 0;
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    setEditingSession(s);
    setEditDate(date);
    setEditHours(h > 0 ? String(h) : "");
    setEditMinutes(m > 0 ? String(m) : "");
    setEditLinkType(s.issueId ? "problem" : "topic");
    setEditTopicId(s.topicId ? String(s.topicId) : "");
    setEditIssueId(s.issueId ? String(s.issueId) : "");
    setEditNotes(s.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editingSession) return;
    const h = parseFloat(editHours || "0");
    const m = parseFloat(editMinutes || "0");
    const totalMinutes = h * 60 + m;
    if (totalMinutes <= 0) return;
    setEditSaving(true);
    const startTime = new Date(editDate + "T09:00:00").toISOString();
    const endTime = new Date(new Date(startTime).getTime() + totalMinutes * 60 * 1000).toISOString();
    await fetch(`/api/sessions/${editingSession.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime,
        endTime,
        durationMinutes: totalMinutes,
        topicId: editLinkType === "topic" && editTopicId ? parseInt(editTopicId) : null,
        issueId: editLinkType === "problem" && editIssueId ? parseInt(editIssueId) : null,
        notes: editNotes || null,
      }),
    });
    setSessions(await (await fetch("/api/sessions")).json());
    setEditSaving(false);
    setEditingSession(null);
  };

  const completed = sessions.filter((s) => s.endTime && s.durationMinutes);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Lerneinheiten</h1>
        <p className="text-slate-500 mt-1">Lernzeit per Timer erfassen oder manuell eintragen.</p>
      </div>

      {/* Timer */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Live-Timer</h2>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 flex-wrap items-end">
            {/* Toggle */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Verknüpfen mit</label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
                <button
                  onClick={() => setTimerLinkType("topic")}
                  disabled={timerRunning}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${timerLinkType === "topic" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-900"}`}
                >
                  Thema
                </button>
                <button
                  onClick={() => setTimerLinkType("problem")}
                  disabled={timerRunning}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${timerLinkType === "problem" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-900"}`}
                >
                  Problem
                </button>
              </div>
            </div>

            {/* Conditional dropdown */}
            <div className="flex-1 min-w-48">
              <label className="text-xs text-slate-500 mb-1.5 block">
                {timerLinkType === "topic" ? "Thema (optional)" : "Problem (optional)"}
              </label>
              {timerLinkType === "topic" ? (
                <Select value={timerTopicId} onChange={(e) => setTimerTopicId(e.target.value)} disabled={timerRunning}>
                  <option value="">Kein Thema</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              ) : (
                <Select value={timerIssueId} onChange={(e) => setTimerIssueId(e.target.value)} disabled={timerRunning}>
                  <option value="">Kein Problem</option>
                  {issues.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
                </Select>
              )}
            </div>

            <div className="flex-1 min-w-48">
              <label className="text-xs text-slate-500 mb-1.5 block">Notiz (optional)</label>
              <input
                type="text"
                placeholder="Was lernst du gerade?"
                value={timerNotes}
                onChange={(e) => setTimerNotes(e.target.value)}
                disabled={timerRunning}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-4">
              {timerRunning && (
                <span className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">
                  {fmtElapsed(elapsed)}
                </span>
              )}
              <button
                onClick={timerRunning ? stopTimer : startTimer}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${timerRunning ? "bg-red-500 hover:bg-red-600 text-white" : "bg-slate-900 hover:bg-slate-700 text-white"}`}
              >
                {timerRunning ? "Stopp" : "Starten"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual */}
      <div className="bg-white rounded-xl border border-slate-100 mb-6">
        <button
          onClick={() => setShowManual(!showManual)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
        >
          Einheit manuell eintragen
          <span className="text-slate-400">{showManual ? "−" : "+"}</span>
        </button>
        {showManual && (
          <div className="px-6 pb-6 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Datum</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Verknüpfen mit</label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
                  <button
                    onClick={() => setManualLinkType("topic")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${manualLinkType === "topic" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-900"}`}
                  >
                    Thema
                  </button>
                  <button
                    onClick={() => setManualLinkType("problem")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${manualLinkType === "problem" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-900"}`}
                  >
                    Problem
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Stunden</label>
                <input
                  type="number" min="0" placeholder="0" value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Minuten</label>
                <input
                  type="number" min="0" max="59" placeholder="0" value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1.5 block">
                  {manualLinkType === "topic" ? "Thema (optional)" : "Problem (optional)"}
                </label>
                {manualLinkType === "topic" ? (
                  <Select value={manualTopicId} onChange={(e) => setManualTopicId(e.target.value)}>
                    <option value="">Kein Thema</option>
                    {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                ) : (
                  <Select value={manualIssueId} onChange={(e) => setManualIssueId(e.target.value)}>
                    <option value="">Kein Problem</option>
                    {issues.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
                  </Select>
                )}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1.5 block">Notiz (optional)</label>
              <input
                type="text" placeholder="Was hast du gelernt?" value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <button
              onClick={logManual}
              disabled={saving || (!manualHours && !manualMinutes)}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40"
            >
              {saving ? "Wird gespeichert…" : "Einheit speichern"}
            </button>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Einheit bearbeiten</h2>
              <button onClick={() => setEditingSession(null)} className="text-slate-400 hover:text-slate-600">
                <XIcon />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Datum</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Verknüpfen mit</label>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
                    <button
                      onClick={() => setEditLinkType("topic")}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${editLinkType === "topic" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-900"}`}
                    >
                      Thema
                    </button>
                    <button
                      onClick={() => setEditLinkType("problem")}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${editLinkType === "problem" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-900"}`}
                    >
                      Problem
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Stunden</label>
                  <input
                    type="number" min="0" placeholder="0" value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Minuten</label>
                  <input
                    type="number" min="0" max="59" placeholder="0" value={editMinutes}
                    onChange={(e) => setEditMinutes(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    {editLinkType === "topic" ? "Thema (optional)" : "Problem (optional)"}
                  </label>
                  {editLinkType === "topic" ? (
                    <Select value={editTopicId} onChange={(e) => setEditTopicId(e.target.value)}>
                      <option value="">Kein Thema</option>
                      {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  ) : (
                    <Select value={editIssueId} onChange={(e) => setEditIssueId(e.target.value)}>
                      <option value="">Kein Problem</option>
                      {issues.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
                    </Select>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Notiz (optional)</label>
                <input
                  type="text" placeholder="Was hast du gelernt?" value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveEdit}
                  disabled={editSaving || (!editHours && !editMinutes)}
                  className="flex-1 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  {editSaving ? "Wird gespeichert…" : "Speichern"}
                </button>
                <button
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Verlauf</h2>
          <p className="text-xs text-slate-400 mt-0.5">{completed.length} Einheiten</p>
        </div>
        {completed.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">Noch keine Einheiten. Timer starten oder manuell eintragen.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {completed.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between group">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-slate-900">{fmtDate(s.startTime)}</p>
                    {s.topicName && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                        {s.topicName}
                      </span>
                    )}
                    {s.issueTitle && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                        {s.issueTitle}
                      </span>
                    )}
                  </div>
                  {s.notes && <p className="text-xs text-slate-400 mt-0.5">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-slate-900">{fmtMinutes(s.durationMinutes ?? 0)}</span>
                  <button
                    onClick={() => openEdit(s)}
                    className="text-slate-300 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Bearbeiten"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Löschen"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

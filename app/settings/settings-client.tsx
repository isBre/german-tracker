"use client";

import { useState } from "react";
import type { Settings } from "@/lib/schema";

function fmt(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}Std`;
  return `${h}Std ${m}min`;
}

export default function SettingsClient({ initialSettings }: { initialSettings: Settings }) {
  const [goalHours, setGoalHours] = useState(String(initialSettings.goalHours));
  const [goalDate, setGoalDate] = useState(initialSettings.goalDate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalHours: parseFloat(goalHours), goalDate }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hoursNum = parseFloat(goalHours) || 0;
  const daysUntil = Math.max(0, Math.ceil((new Date(goalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const hoursPerDay = daysUntil > 0 ? hoursNum / daysUntil : 0;
  const hoursPerWeek = hoursPerDay * 7;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Einstellungen</h1>
        <p className="text-slate-500 mt-1">Jahresziel konfigurieren.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-5">Jahresziel</h2>
        <div className="grid grid-cols-2 gap-5 mb-6">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Zielstunden</label>
            <input
              type="number"
              min="1"
              step="10"
              value={goalHours}
              onChange={(e) => setGoalHours(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-xs text-slate-400 mt-1">Gesamte Lernstunden</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Deadline</label>
            <input
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-xs text-slate-400 mt-1">Noch {daysUntil} Tage</p>
          </div>
        </div>

        {hoursNum > 0 && daysUntil > 0 && (
          <div className="bg-slate-50 rounded-lg p-4 mb-5">
            <p className="text-xs font-medium text-slate-500 mb-2">Benötigtes Lerntempo</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xl font-semibold text-slate-900">{fmt(hoursPerDay)}</p>
                <p className="text-xs text-slate-400">pro Tag</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-slate-900">{fmt(hoursPerWeek)}</p>
                <p className="text-xs text-slate-400">pro Woche</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          {saving ? "Wird gespeichert…" : saved ? "✓ Gespeichert" : "Änderungen speichern"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Info</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Alle Daten werden lokal in einer SQLite-Datenbank (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">german-tracker.db</code>) gespeichert. Kein Account, keine Cloud.
        </p>
      </div>
    </div>
  );
}

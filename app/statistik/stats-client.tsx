"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart, ReferenceLine,
} from "recharts";

type StatsData = {
  summary: {
    totalHours: number;
    goalHours: number;
    goalDate: string;
    totalSessions: number;
    avgSessionMinutes: number;
    longestSessionMinutes: number;
    activeDays: number;
  };
  dailyActivity: { date: string; hours: number }[];
  monthlyActivity: { month: string; label: string; hours: number }[];
  topicDistribution: { name: string; color: string; hours: number }[];
  categoryDistribution: { name: string; category: string; color: string; hours: number }[];
  weekdayPattern: { day: string; totalHours: number; avgHours: number }[];
  projection: {
    avgHoursPerDay: number;
    projectedCompletionDate: string | null;
    hoursRemaining: number;
    isOnTrack: boolean;
    requiredHoursPerDay: number;
  };
  projectionChart: { date: string; actual?: number; target?: number; projected?: number }[];
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}min`;
  if (mins === 0) return `${hrs}Std`;
  return `${hrs}Std ${mins}min`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-sm">
      <p className="text-slate-500 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmtHours(p.value)}
        </p>
      ))}
    </div>
  );
};

const ProjectionTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-sm">
      <p className="text-slate-500 mb-1">{fmtDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: {fmtHours(p.value)}
        </p>
      ))}
    </div>
  );
};

const CHART_PALETTE = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#14b8a6",
  "#3b82f6", "#a855f7", "#eab308", "#22d3ee", "#f43f5e",
];

export default function StatsClient() {
  const [data, setData] = useState<StatsData | null>(null);
  const [activityView, setActivityView] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">
        Lade Statistiken…
      </div>
    );
  }

  const { summary, dailyActivity, monthlyActivity, topicDistribution, categoryDistribution, weekdayPattern, projection, projectionChart } = data;

  const goalProgress = Math.min(100, (summary.totalHours / summary.goalHours) * 100);

  // Last 30 days for daily chart
  const last30 = dailyActivity.slice(-30).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
  }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Statistiken</h1>
          <p className="text-sm text-slate-500 mt-1">Detaillierte Auswertung deines Lernfortschritts.</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Gesamtstunden", value: fmtHours(summary.totalHours) },
            { label: "Einheiten", value: summary.totalSessions },
            { label: "Aktive Tage", value: summary.activeDays },
            { label: "Ø Einheit", value: `${summary.avgSessionMinutes}min` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-slate-100 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-2xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Goal progress */}
        <div className="bg-white border border-slate-100 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-700">Zielfortschritt</h2>
            <span className="text-sm text-slate-500">
              {fmtHours(summary.totalHours)} / {summary.goalHours}Std
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-slate-900 rounded-full transition-all"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{Math.round(goalProgress * 10) / 10}% erreicht</span>
            <span>Zieldatum: {fmtDate(summary.goalDate)}</span>
          </div>
        </div>

        {/* Projection */}
        <div className="bg-white border border-slate-100 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-700">Projektion</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                projection.isOnTrack
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {projection.isOnTrack ? "Im Zeitplan" : "Hinter Zeitplan"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-5 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Dein Tempo</p>
              <p className="font-semibold text-slate-900">{fmtHours(projection.avgHoursPerDay)}<span className="text-slate-400 font-normal">/Tag</span></p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Zieltempo</p>
              <p className="font-semibold text-slate-900">{fmtHours(projection.requiredHoursPerDay)}<span className="text-slate-400 font-normal">/Tag</span></p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-0.5">Voraussichtlich fertig</p>
              <p className="font-semibold text-slate-900">
                {projection.projectedCompletionDate ? fmtDate(projection.projectedCompletionDate) : "—"}
              </p>
            </div>
          </div>
          <div className={`rounded-lg px-4 py-3 text-sm ${projection.isOnTrack ? "bg-emerald-50" : "bg-amber-50"}`}>
            {projection.isOnTrack ? (
              <p className="text-emerald-700">
                Du liegst <strong>{fmtHours(Math.abs(projection.hoursBehind))}</strong> vor dem Zielrhythmus.
              </p>
            ) : (
              <p className="text-amber-700">
                Du liegst <strong>{fmtHours(Math.abs(projection.hoursBehind))}</strong> hinter dem Zielrhythmus — du müsstest <strong>{fmtHours(projection.requiredHoursPerDay)}</strong>/Tag lernen, lernst aber nur <strong>{fmtHours(projection.avgHoursPerDay)}</strong>/Tag.
              </p>
            )}
          </div>
        </div>

        {/* Activity chart */}
        <div className="bg-white border border-slate-100 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-slate-700">Aktivitätsverlauf</h2>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              {(["daily", "monthly"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setActivityView(v)}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    activityView === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {v === "daily" ? "30 Tage" : "Monatlich"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={activityView === "daily" ? last30 : monthlyActivity}
              margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey={activityView === "daily" ? "label" : "label"}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                interval={activityView === "daily" ? 6 : 0}
                angle={activityView === "monthly" ? -30 : 0}
                textAnchor={activityView === "monthly" ? "end" : "middle"}
                height={activityView === "monthly" ? 40 : 20}
              />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${v}h`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="hours" name="Stunden" fill="#0f172a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category distribution */}
        {categoryDistribution.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-xl p-6 mb-6">
            <h2 className="text-sm font-medium text-slate-700 mb-5">Kategorien</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {(["sprechen", "schreiben", "hören", "lesen"] as const).map((cat) => {
                const entry = categoryDistribution.find((c) => c.category === cat);
                const totalCatHours = categoryDistribution.reduce((acc, c) => acc + c.hours, 0);
                const pct = entry && totalCatHours > 0 ? Math.round((entry.hours / totalCatHours) * 100) : 0;
                const COLORS: Record<string, string> = { sprechen: "#f97316", schreiben: "#ec4899", hören: "#22c55e", lesen: "#14b8a6" };
                const LABELS: Record<string, string> = { sprechen: "Sprechen", schreiben: "Schreiben", hören: "Hören", lesen: "Lesen" };
                return (
                  <div key={cat} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">{LABELS[cat]}</span>
                      <span className="text-xs text-slate-400">{entry ? fmtHours(entry.hours) : "—"}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[cat] }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Topic distribution */}
          <div className="bg-white border border-slate-100 rounded-xl p-6">
            <h2 className="text-sm font-medium text-slate-700 mb-5">Themenverteilung</h2>
            {topicDistribution.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Keine Daten</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={topicDistribution}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {topicDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtHours(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {topicDistribution.map((t, i) => (
                    <div key={t.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                        <span className="text-slate-700 truncate max-w-[140px]">{t.name}</span>
                      </div>
                      <span className="text-slate-500 tabular-nums">{fmtHours(t.hours)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Weekday pattern */}
          <div className="bg-white border border-slate-100 rounded-xl p-6">
            <h2 className="text-sm font-medium text-slate-700 mb-5">Wochentag-Muster</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekdayPattern} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${v}h`} />
                <YAxis type="category" dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} width={25} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtHours(v), name === "avgHours" ? "Ø Stunden" : "Gesamt"]}
                  labelFormatter={(l) => `${l}`}
                />
                <Bar dataKey="avgHours" name="Ø Stunden" fill="#0f172a" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-400 mt-3 text-center">Durchschnittliche Stunden pro Wochentag</p>
          </div>
        </div>
      </div>
    </div>
  );
}

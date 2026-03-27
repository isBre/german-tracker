import { db } from "@/lib/db";
import { sessions, issues, settings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

async function getDashboardData() {
  const config = await db.select().from(settings).where(eq(settings.id, 1));
  const goal = config[0] ?? { goalHours: 500, goalDate: "2026-12-31" };

  const allSessions = await db.select().from(sessions);
  const completedSessions = allSessions.filter((s) => s.endTime && s.durationMinutes);
  const totalMinutes = completedSessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);
  const totalHours = totalMinutes / 60;

  const today = new Date().toISOString().split("T")[0];
  const todaySessions = completedSessions.filter((s) => s.startTime.startsWith(today));
  const todayMinutes = todaySessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const weekSessions = completedSessions.filter((s) => s.startTime.split("T")[0] >= weekAgoStr);
  const weekMinutes = weekSessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);

  const allIssues = await db.select().from(issues);
  const openIssues = allIssues.filter((i) => i.status === "open").length;
  const inProgressIssues = allIssues.filter((i) => i.status === "in_progress").length;

  const goalDate = new Date(goal.goalDate);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((goalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const goalProgress = Math.min(100, (totalHours / goal.goalHours) * 100);

  // Streak
  const sessionDays = [...new Set(completedSessions.map((s) => s.startTime.split("T")[0]))].sort().reverse();
  let streak = 0;
  const checkDate = new Date();
  for (const day of sessionDays) {
    const checkStr = checkDate.toISOString().split("T")[0];
    if (day === checkStr) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const chartData = last7Days.map((day) => {
    const daySessions = completedSessions.filter((s) => s.startTime.startsWith(day));
    const minutes = daySessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);
    return { day, hours: Math.round((minutes / 60) * 10) / 10 };
  });

  const recentSessions = completedSessions
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 5);

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    todayHours: Math.round((todayMinutes / 60) * 10) / 10,
    weekHours: Math.round((weekMinutes / 60) * 10) / 10,
    goalHours: goal.goalHours,
    goalDate: goal.goalDate,
    goalProgress: Math.round(goalProgress * 10) / 10,
    daysRemaining,
    streak,
    openIssues,
    inProgressIssues,
    chartData,
    recentSessions,
  };
}

function fmt(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function Dashboard() {
  const data = await getDashboardData();
  const maxChartHours = Math.max(...data.chartData.map((d) => d.hours), 1);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Heute</p>
          <p className="text-2xl font-semibold text-slate-900">{fmt(data.todayHours)}</p>
          <p className="text-xs text-slate-400 mt-1">Lernzeit</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Diese Woche</p>
          <p className="text-2xl font-semibold text-slate-900">{fmt(data.weekHours)}</p>
          <p className="text-xs text-slate-400 mt-1">letzte 7 Tage</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Serie</p>
          <p className="text-2xl font-semibold text-slate-900">{data.streak}</p>
          <p className="text-xs text-slate-400 mt-1">{data.streak === 1 ? "Tag" : "Tage"} am Stück</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Offene Probleme</p>
          <p className="text-2xl font-semibold text-slate-900">{data.openIssues + data.inProgressIssues}</p>
          <p className="text-xs text-slate-400 mt-1">{data.inProgressIssues} in Bearbeitung</p>
        </div>
      </div>

      {/* Goal progress */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Jahresziel</h2>
            <p className="text-xs text-slate-400 mt-0.5">Noch {data.daysRemaining} Tage · bis {fmtDate(data.goalDate)}</p>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-slate-900">{fmt(data.totalHours)}</span>
            <span className="text-sm text-slate-400"> / {fmt(data.goalHours)}</span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="bg-slate-900 h-2 rounded-full transition-all"
            style={{ width: `${data.goalProgress}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">{data.goalProgress}% abgeschlossen</p>
      </div>

      {/* Chart + Recent sessions */}
      <div className="grid grid-cols-2 gap-6">
        {/* 7-day chart */}
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Letzte 7 Tage</h2>
          <div className="flex items-end gap-2 h-28">
            {data.chartData.map(({ day, hours }) => {
              const heightPct = maxChartHours > 0 ? (hours / maxChartHours) * 100 : 0;
              const dayLabel = new Date(day + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short" });
              const isToday = day === new Date().toISOString().split("T")[0];
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end" style={{ height: "80px" }}>
                    <div
                      className={`w-full rounded-t-md transition-all ${isToday ? "bg-slate-900" : "bg-slate-200"}`}
                      style={{ height: `${Math.max(heightPct, hours > 0 ? 4 : 0)}%` }}
                      title={`${hours}h`}
                    />
                  </div>
                  <span className={`text-xs ${isToday ? "text-slate-900 font-medium" : "text-slate-400"}`}>
                    {dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent sessions */}
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Letzte Einheiten</h2>
            <Link href="/sessions" className="text-xs text-slate-400 hover:text-slate-900 transition-colors">
              Alle anzeigen →
            </Link>
          </div>
          {data.recentSessions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400">Noch keine Einheiten.</p>
              <Link href="/sessions" className="text-xs text-slate-900 underline mt-1 inline-block">
                Erste Einheit eintragen
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.recentSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-700">{fmtDate(s.startTime)}</p>
                    {s.notes && <p className="text-xs text-slate-400 truncate max-w-36">{s.notes}</p>}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{fmt((s.durationMinutes ?? 0) / 60)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mt-6">
        <Link
          href="/sessions"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Einheit starten
        </Link>
        <Link
          href="/issues"
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Problem erfassen
        </Link>
      </div>
    </div>
  );
}

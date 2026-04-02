import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, topics, settings } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const [allSessions, allTopics, config] = await Promise.all([
    db.select().from(sessions),
    db.select().from(topics),
    db.select().from(settings).where(eq(settings.id, 1)),
  ]);

  const goal = config[0] ?? { goalHours: 500, goalDate: "2026-12-31" };
  const completed = allSessions.filter((s) => s.endTime && s.durationMinutes);

  const totalMinutes = completed.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);
  const totalHours = totalMinutes / 60;

  // --- Daily activity (last 90 days) ---
  const dailyMap = new Map<string, number>();
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const s of completed) {
    const day = s.startTime.split("T")[0];
    if (dailyMap.has(day)) {
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + (s.durationMinutes ?? 0));
    }
  }
  const dailyActivity = Array.from(dailyMap.entries()).map(([date, mins]) => ({
    date,
    hours: Math.round((mins / 60) * 100) / 100,
  }));

  // --- Monthly activity (all time) ---
  const monthlyMap = new Map<string, number>();
  for (const s of completed) {
    const month = s.startTime.substring(0, 7); // "YYYY-MM"
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + (s.durationMinutes ?? 0));
  }
  const monthlyActivity = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, mins]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("de-DE", { month: "short", year: "numeric" }),
      hours: Math.round((mins / 60) * 100) / 100,
    }));

  // --- Topic distribution ---
  const topicMap = new Map<number, number>();
  for (const s of completed) {
    if (s.topicId) {
      topicMap.set(s.topicId, (topicMap.get(s.topicId) ?? 0) + (s.durationMinutes ?? 0));
    }
  }
  const topicDistribution = allTopics
    .map((t) => ({
      name: t.name,
      color: t.color,
      hours: Math.round(((topicMap.get(t.id) ?? 0) / 60) * 100) / 100,
    }))
    .filter((t) => t.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  // --- Category distribution ---
  const CATEGORY_COLORS: Record<string, string> = {
    sprechen: "#f97316",
    schreiben: "#ec4899",
    hören: "#22c55e",
    lesen: "#14b8a6",
  };
  const categoryMap = new Map<string, number>();
  for (const s of completed) {
    if (s.topicId) {
      const topic = allTopics.find((t) => t.id === s.topicId);
      const cats: string[] = topic?.categories ? (() => { try { return JSON.parse(topic.categories); } catch { return []; } })() : [];
      for (const cat of cats) {
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + (s.durationMinutes ?? 0));
      }
    }
  }
  const categoryDistribution = ["sprechen", "schreiben", "hören", "lesen"]
    .map((cat) => ({
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      category: cat,
      color: CATEGORY_COLORS[cat],
      hours: Math.round(((categoryMap.get(cat) ?? 0) / 60) * 100) / 100,
    }))
    .filter((c) => c.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  // --- Weekday pattern ---
  const weekdayMins = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const s of completed) {
    const dow = new Date(s.startTime).getDay();
    weekdayMins[dow] += s.durationMinutes ?? 0;
    weekdayCounts[dow]++;
  }
  const weekdayLabels = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const weekdayPattern = weekdayLabels.map((day, i) => ({
    day,
    totalHours: Math.round((weekdayMins[i] / 60) * 100) / 100,
    avgHours: weekdayCounts[i] > 0
      ? Math.round((weekdayMins[i] / weekdayCounts[i] / 60) * 100) / 100
      : 0,
  }));

  // --- Projection chart ---
  // Three series sharing the same x-axis (first session → goal date):
  //   actual    = cumulative hours logged day by day
  //   target    = ideal required pace (diagonal from 0 → goalHours over the full span)
  //   projected = where you'll be at goal date if you keep your recent avg pace
  const sessionsByDay = new Map<string, number>();
  for (const s of completed) {
    const day = s.startTime.split("T")[0];
    sessionsByDay.set(day, (sessionsByDay.get(day) ?? 0) + (s.durationMinutes ?? 0));
  }
  const sortedDays = Array.from(sessionsByDay.keys()).sort();

  // --- Projection ---
  const firstSessionDate = sortedDays.length > 0 ? new Date(sortedDays[0]) : now;
  const daysSinceFirst = Math.max(1, Math.ceil((now.getTime() - firstSessionDate.getTime()) / (1000 * 60 * 60 * 24)));
  const windowDays = Math.min(30, daysSinceFirst);
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartStr = windowStart.toISOString().split("T")[0];
  const recentSessions = completed.filter((s) => s.startTime.split("T")[0] >= windowStartStr);
  const recentMinutes = recentSessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);
  const avgHoursPerDay = recentMinutes / 60 / windowDays;

  const hoursRemaining = Math.max(0, goal.goalHours - totalHours);
  let projectedCompletionDate: string | null = null;
  if (avgHoursPerDay > 0) {
    const daysNeeded = hoursRemaining / avgHoursPerDay;
    const projDate = new Date(now);
    projDate.setDate(projDate.getDate() + Math.ceil(daysNeeded));
    projectedCompletionDate = projDate.toISOString().split("T")[0];
  }

  const goalDate = new Date(goal.goalDate);
  const daysRemaining = Math.max(0, Math.ceil((goalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const requiredHoursPerDay = daysRemaining > 0 ? hoursRemaining / daysRemaining : 0;
  const isOnTrack = avgHoursPerDay >= requiredHoursPerDay;
  const todayStr = now.toISOString().split("T")[0];
  const firstDay = sortedDays[0] ?? todayStr;
  const firstDate = new Date(firstDay);
  const totalSpanDays = Math.max(1, Math.ceil((goalDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
  const targetRatePerDay = goal.goalHours / totalSpanDays;

  type ProjPoint = { date: string; actual?: number; target?: number; projected?: number };
  const pointMap = new Map<string, ProjPoint>();

  const getOrCreate = (date: string) => {
    if (!pointMap.has(date)) pointMap.set(date, { date });
    return pointMap.get(date)!;
  };

  // Actual: cumulative per session day
  let cumulative = 0;
  for (const day of sortedDays) {
    cumulative += (sessionsByDay.get(day) ?? 0) / 60;
    getOrCreate(day).actual = Math.round(cumulative * 10) / 10;
  }
  // Ensure today is included in actual (even if no session today)
  getOrCreate(todayStr).actual = Math.round(cumulative * 10) / 10;

  // Generate monthly anchor points (1st of each month) from firstDay to goalDate
  // Build date strings directly to avoid timezone offset issues
  let mYear = firstDate.getFullYear();
  let mMonth = firstDate.getMonth(); // 0-based
  while (true) {
    const d = `${mYear}-${String(mMonth + 1).padStart(2, "0")}-01`;
    if (d > goal.goalDate) break;
    const anchorMs = new Date(d).getTime();
    const daysSinceStart = (anchorMs - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysFromToday = (anchorMs - now.getTime()) / (1000 * 60 * 60 * 24);
    const p = getOrCreate(d);
    p.target = Math.max(0, Math.round(targetRatePerDay * daysSinceStart * 10) / 10);
    if (daysFromToday >= 0) {
      p.projected = Math.round((cumulative + avgHoursPerDay * daysFromToday) * 10) / 10;
    }
    mMonth++;
    if (mMonth > 11) { mMonth = 0; mYear++; }
  }
  // Always include goal date
  {
    const d = goal.goalDate;
    const daysSinceStart = (goalDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysFromToday = (goalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const p = getOrCreate(d);
    p.target = goal.goalHours;
    if (daysFromToday >= 0) {
      p.projected = Math.round((cumulative + avgHoursPerDay * daysFromToday) * 10) / 10;
    }
  }

  const projectionChart = Array.from(pointMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // How many hours ahead/behind the ideal target pace right now
  const todayPoint = pointMap.get(todayStr);
  const targetHoursToday = todayPoint?.target ?? 0;
  const hoursBehind = Math.round((targetHoursToday - cumulative) * 10) / 10;

  return NextResponse.json({
    summary: {
      totalHours: Math.round(totalHours * 10) / 10,
      goalHours: goal.goalHours,
      goalDate: goal.goalDate,
      totalSessions: completed.length,
      avgSessionMinutes: completed.length > 0
        ? Math.round(totalMinutes / completed.length)
        : 0,
      longestSessionMinutes: completed.length > 0
        ? Math.round(Math.max(...completed.map((s) => s.durationMinutes ?? 0)))
        : 0,
      activeDays: sessionsByDay.size,
    },
    dailyActivity,
    monthlyActivity,
    topicDistribution,
    weekdayPattern,
    projection: {
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      projectedCompletionDate,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      isOnTrack,
      requiredHoursPerDay: Math.round(requiredHoursPerDay * 100) / 100,
      hoursBehind,
    },
    projectionChart,
    categoryDistribution,
  });
}

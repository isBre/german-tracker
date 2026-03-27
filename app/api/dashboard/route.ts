import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, issues, settings } from "@/lib/schema";
import { eq, gte, sum } from "drizzle-orm";

export async function GET() {
  const config = await db.select().from(settings).where(eq(settings.id, 1));
  const goal = config[0] ?? { goalHours: 500, goalDate: "2026-12-31" };

  // Total study hours (completed sessions)
  const totalMinutesResult = await db
    .select({ total: sum(sessions.durationMinutes) })
    .from(sessions)
    .where(eq(sessions.endTime, sessions.endTime)); // only completed sessions

  // Actually get all completed sessions
  const allSessions = await db.select().from(sessions);
  const completedSessions = allSessions.filter((s) => s.endTime && s.durationMinutes);
  const totalMinutes = completedSessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);
  const totalHours = totalMinutes / 60;

  // Today's sessions
  const today = new Date().toISOString().split("T")[0];
  const todaySessions = completedSessions.filter((s) => s.startTime.startsWith(today));
  const todayMinutes = todaySessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);

  // This week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const weekSessions = completedSessions.filter((s) => s.startTime.split("T")[0] >= weekAgoStr);
  const weekMinutes = weekSessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0);

  // Issues stats
  const allIssues = await db.select().from(issues);
  const openIssues = allIssues.filter((i) => i.status === "open").length;
  const inProgressIssues = allIssues.filter((i) => i.status === "in_progress").length;

  // Goal progress
  const goalDate = new Date(goal.goalDate);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((goalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const goalProgress = Math.min(100, (totalHours / goal.goalHours) * 100);

  // Streak: consecutive days with sessions
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

  // Last 7 days chart data
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

  return NextResponse.json({
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
    recentSessions: completedSessions.slice(-5).reverse(),
  });
}

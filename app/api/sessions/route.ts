import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, topics, issues } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const result = await db
    .select({
      id: sessions.id,
      startTime: sessions.startTime,
      endTime: sessions.endTime,
      durationMinutes: sessions.durationMinutes,
      notes: sessions.notes,
      createdAt: sessions.createdAt,
      topicId: sessions.topicId,
      topicName: topics.name,
      issueId: sessions.issueId,
      issueTitle: issues.title,
    })
    .from(sessions)
    .leftJoin(topics, eq(sessions.topicId, topics.id))
    .leftJoin(issues, eq(sessions.issueId, issues.id))
    .orderBy(desc(sessions.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { startTime, endTime, durationMinutes, topicId, issueId, notes } = body;

  if (!startTime) {
    return NextResponse.json({ error: "startTime is required" }, { status: 400 });
  }

  const result = await db.insert(sessions).values({
    startTime,
    endTime: endTime ?? null,
    durationMinutes: durationMinutes ?? null,
    topicId: topicId ?? null,
    issueId: issueId ?? null,
    notes: notes ?? null,
    createdAt: new Date().toISOString(),
  }).returning();

  return NextResponse.json(result[0], { status: 201 });
}

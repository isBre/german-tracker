import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { endTime, durationMinutes, topicId, issueId, notes } = body;

  await db.update(sessions).set({
    endTime: endTime ?? null,
    durationMinutes: durationMinutes ?? null,
    topicId: topicId ?? null,
    issueId: issueId ?? null,
    notes: notes ?? null,
  }).where(eq(sessions.id, parseInt(id)));

  const updated = await db.select().from(sessions).where(eq(sessions.id, parseInt(id)));
  return NextResponse.json(updated[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(sessions).where(eq(sessions.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

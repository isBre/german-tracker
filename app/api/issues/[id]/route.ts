import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issues } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { title, description, topicId, status, priority } = body;

  const updateData: Partial<typeof issues.$inferInsert> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (topicId !== undefined) updateData.topicId = topicId;
  if (status !== undefined) {
    updateData.status = status;
    if (status === "resolved") {
      updateData.resolvedAt = new Date().toISOString();
    } else {
      updateData.resolvedAt = undefined;
    }
  }
  if (priority !== undefined) updateData.priority = priority;

  await db.update(issues).set(updateData).where(eq(issues.id, parseInt(id)));
  const updated = await db.select().from(issues).where(eq(issues.id, parseInt(id)));
  return NextResponse.json(updated[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(issues).where(eq(issues.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

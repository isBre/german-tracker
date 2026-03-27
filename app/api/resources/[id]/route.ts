import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { title, url, description, type, topicId } = body;

  await db.update(resources).set({
    title: title?.trim(),
    url: url?.trim() || null,
    description: description?.trim() || null,
    type: type ?? "link",
    topicId: topicId ?? null,
  }).where(eq(resources.id, parseInt(id)));

  const updated = await db.select().from(resources).where(eq(resources.id, parseInt(id)));
  return NextResponse.json(updated[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(resources).where(eq(resources.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

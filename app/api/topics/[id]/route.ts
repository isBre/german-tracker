import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { topics } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, color } = body;

  await db.update(topics).set({ name, color }).where(eq(topics.id, parseInt(id)));
  const updated = await db.select().from(topics).where(eq(topics.id, parseInt(id)));
  return NextResponse.json(updated[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(topics).where(eq(topics.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

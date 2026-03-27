import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const result = await db.select().from(settings).where(eq(settings.id, 1));
  return NextResponse.json(result[0] ?? { id: 1, goalHours: 500, goalDate: "2026-12-31" });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { goalHours, goalDate } = body;

  await db.update(settings).set({ goalHours, goalDate }).where(eq(settings.id, 1));
  const updated = await db.select().from(settings).where(eq(settings.id, 1));
  return NextResponse.json(updated[0]);
}

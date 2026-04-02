import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { topics } from "@/lib/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const result = await db.select().from(topics).orderBy(desc(topics.createdAt));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, color, categories } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await db.insert(topics).values({
    name: name.trim(),
    color: color ?? "#3b82f6",
    categories: categories?.length ? JSON.stringify(categories) : null,
    createdAt: new Date().toISOString(),
  }).returning();

  return NextResponse.json(result[0], { status: 201 });
}

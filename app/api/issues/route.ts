import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issues, topics } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const result = await db
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      status: issues.status,
      priority: issues.priority,
      createdAt: issues.createdAt,
      resolvedAt: issues.resolvedAt,
      topicId: issues.topicId,
      topicName: topics.name,
      topicColor: topics.color,
    })
    .from(issues)
    .leftJoin(topics, eq(issues.topicId, topics.id))
    .orderBy(desc(issues.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, description, topicId, status, priority } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const result = await db.insert(issues).values({
    title: title.trim(),
    description: description ?? null,
    topicId: topicId ?? null,
    status: status ?? "open",
    priority: priority ?? "medium",
    createdAt: new Date().toISOString(),
  }).returning();

  return NextResponse.json(result[0], { status: 201 });
}

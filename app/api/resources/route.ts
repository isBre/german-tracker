import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resources, topics } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const result = await db
    .select({
      id: resources.id,
      title: resources.title,
      url: resources.url,
      description: resources.description,
      type: resources.type,
      createdAt: resources.createdAt,
      topicId: resources.topicId,
      topicName: topics.name,
    })
    .from(resources)
    .leftJoin(topics, eq(resources.topicId, topics.id))
    .orderBy(desc(resources.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, url, description, type, topicId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const result = await db.insert(resources).values({
    title: title.trim(),
    url: url?.trim() || null,
    description: description?.trim() || null,
    type: type ?? "link",
    topicId: topicId ?? null,
    createdAt: new Date().toISOString(),
  }).returning();

  return NextResponse.json(result[0], { status: 201 });
}

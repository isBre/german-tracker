import { db } from "@/lib/db";
import { topics } from "@/lib/schema";
import { desc } from "drizzle-orm";
import TopicsClient from "./topics-client";

export default async function TopicsPage() {
  const allTopics = await db.select().from(topics).orderBy(desc(topics.createdAt));
  return <TopicsClient initialTopics={allTopics} />;
}

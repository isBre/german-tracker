import { db } from "@/lib/db";
import { issues, topics } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import IssuesClient from "./issues-client";

export default async function IssuesPage() {
  const allIssues = await db
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

  const allTopics = await db.select().from(topics).orderBy(desc(topics.createdAt));

  return <IssuesClient initialIssues={allIssues} topics={allTopics} />;
}

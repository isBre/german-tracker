import { db } from "@/lib/db";
import { sessions, topics, issues } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import SessionsClient from "./sessions-client";

export default async function SessionsPage() {
  const allSessions = await db
    .select({
      id: sessions.id,
      startTime: sessions.startTime,
      endTime: sessions.endTime,
      durationMinutes: sessions.durationMinutes,
      notes: sessions.notes,
      createdAt: sessions.createdAt,
      topicId: sessions.topicId,
      topicName: topics.name,
      issueId: sessions.issueId,
      issueTitle: issues.title,
    })
    .from(sessions)
    .leftJoin(topics, eq(sessions.topicId, topics.id))
    .leftJoin(issues, eq(sessions.issueId, issues.id))
    .orderBy(desc(sessions.createdAt));

  const allTopics = await db.select().from(topics).orderBy(desc(topics.createdAt));
  const allIssues = await db
    .select({ id: issues.id, title: issues.title, status: issues.status })
    .from(issues)
    .orderBy(desc(issues.createdAt));

  return <SessionsClient initialSessions={allSessions} topics={allTopics} issues={allIssues} />;
}

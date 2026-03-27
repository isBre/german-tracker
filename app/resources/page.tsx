import { db } from "@/lib/db";
import { resources, topics } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import ResourcesClient from "./resources-client";

export default async function ResourcesPage() {
  const allResources = await db
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

  const allTopics = await db.select().from(topics).orderBy(desc(topics.createdAt));

  return <ResourcesClient initialResources={allResources} topics={allTopics} />;
}

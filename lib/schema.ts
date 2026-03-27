import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey().$defaultFn(() => 1),
  goalHours: real("goal_hours").notNull().default(500),
  goalDate: text("goal_date").notNull().default("2026-12-31"),
});

export const topics = sqliteTable("topics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  durationMinutes: real("duration_minutes"),
  topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  issueId: integer("issue_id").references(() => issues.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const issues = sqliteTable("issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  status: text("status", { enum: ["open", "in_progress", "resolved"] }).notNull().default("open"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  resolvedAt: text("resolved_at"),
});

export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  url: text("url"),
  description: text("description"),
  type: text("type", { enum: ["link", "kurs", "buch", "video", "sonstiges"] }).notNull().default("link"),
  topicId: integer("topic_id").references(() => topics.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Settings = typeof settings.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type NewIssue = typeof issues.$inferInsert;
export type NewTopic = typeof topics.$inferInsert;
export type NewResource = typeof resources.$inferInsert;

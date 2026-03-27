import { db } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const result = await db.select().from(settings).where(eq(settings.id, 1));
  const config = result[0] ?? { id: 1, goalHours: 500, goalDate: "2026-12-31" };
  return <SettingsClient initialSettings={config} />;
}

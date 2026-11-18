import { eq } from "drizzle-orm";
import { caregivers } from "@careshift/db";
import type { Db } from "../db";

export async function getCaregiverForUser(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(caregivers)
    .where(eq(caregivers.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

import { auditLogs } from "@careshift/db";
import type { Db } from "../db";

export async function logAudit(
  db: Db,
  entry: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
  },
) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: entry.userId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    createdAt: Date.now(),
  });
}

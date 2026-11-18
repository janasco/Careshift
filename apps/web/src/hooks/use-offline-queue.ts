import { useEffect, useState } from "react";
import { flushQueue, readQueue, type QueueItem } from "@/lib/offline";

/**
 * Offline-aware action queue for the caregiver checklist.
 * Queued completions/notes/issues survive reloads, flush automatically when
 * connectivity returns, and never double-submit.
 */
export function useOfflineQueue(run: (item: QueueItem) => Promise<unknown>) {
  const [pending, setPending] = useState<QueueItem[]>(() => readQueue());

  useEffect(() => {
    const refresh = () => setPending(readQueue());
    window.addEventListener("shiftaid-queue", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("shiftaid-queue", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);

  useEffect(() => {
    async function tryFlush() {
      if (!navigator.onLine) return;
      if (readQueue().length === 0) return;
      await flushQueue(run);
      setPending(readQueue());
    }
    tryFlush();
    const t = setInterval(tryFlush, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pendingCount: pending.length, pending };
}

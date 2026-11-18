import { CaregiverSchema, IssueSchema } from "./schemas";

export type QueueItem = {
  id: string;
  kind: "complete" | "note" | "issue";
  taskId: string;
  payload: Record<string, string>;
  attempts: number;
  addedAt: number;
};

const KEY = "shiftaid.queue.v1";
const MAX_ATTEMPTS = 5;

export function readQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("shiftaid-queue"));
  } catch {
    /* storage full/unavailable */
  }
}

export function pushQueue(item: Omit<QueueItem, "id" | "attempts" | "addedAt">) {
  const items = readQueue();
  if (items.some((q) => q.taskId === item.taskId && q.kind === item.kind)) return;
  items.push({ ...item, id: crypto.randomUUID(), attempts: 0, addedAt: Date.now() });
  writeQueue(items);
}

export function removeQueueItem(id: string) {
  writeQueue(readQueue().filter((q) => q.id !== id));
}

function bumpAttempts(id: string) {
  const items = readQueue();
  const item = items.find((q) => q.id === id);
  if (!item) return;
  item.attempts += 1;
  if (item.attempts >= MAX_ATTEMPTS) {
    removeQueueItem(id);
    window.dispatchEvent(new Event("shiftaid-queue-dropped"));
  } else {
    writeQueue(items);
  }
}

let flushing = false;
export async function flushQueue(run: (item: QueueItem) => Promise<unknown>) {
  if (flushing) return;
  flushing = true;
  try {
    const items = readQueue();
    for (const item of items) {
      try {
        await run(item);
        removeQueueItem(item.id);
      } catch {
        bumpAttempts(item.id);
      }
    }
  } finally {
    flushing = false;
  }
}

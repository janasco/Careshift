/** Computes a scheduled task's live status from its fields (client-safe). */
export type StatusChipVariant =
  | "complete"
  | "progress"
  | "pending"
  | "issue"
  | "upcoming"
  | "muted";

export const chipClasses: Record<StatusChipVariant, string> = {
  complete: "text-complete bg-complete-bg",
  progress: "text-progress bg-progress-bg",
  pending: "text-pending bg-pending-bg",
  issue: "text-issue bg-issue-bg",
  upcoming: "text-upcoming bg-upcoming-bg",
  muted: "text-muted-foreground bg-muted",
};

export const chipClassesWithOverdue: Record<StatusChipVariant | "overdue", string> = {
  ...chipClasses,
  overdue: chipClasses.issue,
};

export function computeStatus(opts: {
  status: string;
  completedAt?: number | null;
  reported: boolean;
  dueMs: number;
  nowMs: number;
  shiftStartMs: number;
}): StatusChipVariant | "overdue" {
  if (opts.status === "completed") return "complete";
  if (opts.status === "completed_with_issue") return "issue";
  if (opts.status === "reported" || opts.reported) return "issue";
  if (opts.nowMs > opts.shiftStartMs && opts.nowMs <= opts.dueMs) return "progress";
  if (opts.nowMs > opts.dueMs) return "overdue";
  return "upcoming";
}

export function statusChip(variant: string): string {
  const map: Record<string, string> = {
    completed: chipClasses.complete,
    complete: chipClasses.complete,
    progress: chipClasses.progress,
    in_progress: chipClasses.progress,
    working: chipClasses.progress,
    pending: chipClasses.pending,
    overdue: chipClasses.issue,
    "overdue-pending": chipClasses.issue,
    reported: chipClasses.issue,
    issue: chipClasses.issue,
    completed_with_issue: chipClasses.issue,
    upcoming: chipClasses.upcoming,
    active: chipClasses.complete,
    inactive: chipClasses.muted,
    scheduled: chipClasses.upcoming,
    open: chipClasses.issue,
    resolved: chipClasses.complete,
  };
  return map[variant] ?? chipClasses.muted;
}

export const STATUS_LABELS: Record<string, string> = {
  completed: "Complete",
  completed_with_issue: "Completed w/ issue",
  in_progress: "In progress",
  working: "Working",
  pending: "Pending",
  overdue: "Overdue",
  reported: "Issue",
  upcoming: "Upcoming",
  active: "Active",
  inactive: "Inactive",
  open: "Open",
  resolved: "Resolved",
  scheduled: "Scheduled",
};

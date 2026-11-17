import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useSlowClock, useProfile, useToday } from "@/hooks/use-profile";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { useMaterializeDay } from "@/hooks/use-materialize-day";
import { pushQueue, type QueueItem } from "@/lib/offline";
import { computeStatus, chipClasses } from "@/lib/status";
import { Check as CheckIcon } from "lucide-react";
import { formatDateLong, formatTime, shiftRangeLabel } from "@/lib/time";
import { ISSUE_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  CloudOff,
  Loader2,
  LogOut,
  StickyNote,
  PenLine,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

type Task = {
  _id: Id<"scheduledTasks">;
  taskName: string;
  taskDescription?: string;
  category: string;
  priority: string;
  required: boolean;
  scheduledTime: string;
  dueMs: number;
  status: string;
  completedAt?: number | null;
  note?: string | null;
  issue?: { issueType: string; description: string; status: string } | null;
};

export default function CaregiverChecklist() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const today = useToday();
  const now = useSlowClock();
  const navigate = useNavigate();

  const tasks = useQuery(api.checklist.myTasksForDate, { date: today });

  // Ensure today's recurring assignments exist for this date (idempotent).
  useMaterializeDay(today);
  const completeTask = useMutation(api.checklist.completeTask);
  const addNote = useMutation(api.checklist.addTaskNote);
  const reportIssue = useMutation(api.checklist.reportIssue);
  const touchLogin = useMutation(api.profiles.touchLastLogin);

  // Record last login on load (audit-lite)
  useEffect(() => {
    void touchLogin().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runQueued = async (item: QueueItem) => {
    if (item.kind === "complete") {
      await completeTask({
        taskId: item.taskId as Id<"scheduledTasks">,
        note: item.payload.note || undefined,
      });
    } else if (item.kind === "note") {
      await addNote({
        taskId: item.taskId as Id<"scheduledTasks">,
        note: item.payload.note ?? "",
      });
    } else if (item.kind === "issue") {
      await reportIssue({
        taskId: item.taskId as Id<"scheduledTasks">,
        issueType: item.payload.issueType,
        description: item.payload.description,
      });
    }
  };
  const { pendingCount } = useOfflineQueue(runQueued);

  const [confirmTask, setConfirmTask] = useState<Task | null>(null);
  const [noteTask, setNoteTask] = useState<Task | null>(null);
  const [noteText, setNoteText] = useState("");
  const [issueTask, setIssueTask] = useState<Task | null>(null);
  const [issueType, setIssueType] = useState<string>(ISSUE_TYPES[0]);
  const [issueDesc, setIssueDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<Id<"scheduledTasks">[]>([]);

  const myShift = profile?.shiftId;
  const shift = useQuery(api.shifts.listShifts);
  const myShiftDoc = shift?.find((s) => s._id === myShift);

  const done = (tasks ?? []).filter(
    (t) => t.status === "completed" || optimistic.includes(t._id),
  ).length;
  const total = tasks?.length ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const handleConfirmComplete = async () => {
    if (!confirmTask) return;
    setBusy(true);
    // Optimistic: react instantly, reconcile when the server replies.
    setOptimistic((ids) => [...ids, confirmTask._id]);
    setConfirmTask(null);
    try {
      await completeTask({ taskId: confirmTask._id });
      toast.success(`"${confirmTask.taskName}" marked complete`, {
        description: `Recorded ${formatTime(Date.now())}`,
      });
    } catch {
      pushQueue({
        kind: "complete",
        taskId: confirmTask._id,
        payload: {},
      });
      toast.info("Saved offline — will sync automatically", {
        description: "Your check-in is queued and safe.",
      });
    } finally {
      setBusy(false);
      setOptimistic((ids) => ids.filter((id) => id !== confirmTask._id));
    }
  };

  const handleSaveNote = async () => {
    if (!noteTask) return;
    const trimmed = noteText.trim();
    if (trimmed.length === 0) {
      toast.error("Note cannot be empty");
      return;
    }
    setBusy(true);
    try {
      // Store the note without implicitly completing the task.
      try {
        await addNote({ taskId: noteTask._id, note: trimmed });
        toast.success("Note saved");
      } catch {
        pushQueue({ kind: "note", taskId: noteTask._id, payload: { note: trimmed } });
        toast.info("Note saved offline — will sync automatically");
      }
    } finally {
      setBusy(false);
      setNoteTask(null);
      setNoteText("");
    }
  };

  const handleReportIssue = async () => {
    if (!issueTask || issueDesc.trim().length < 3) {
      toast.error("Please describe the issue");
      return;
    }
    setBusy(true);
    try {
      await reportIssue({ taskId: issueTask._id, issueType, description: issueDesc.trim() });
      toast.success("Issue reported — the supervisor has been notified");
    } catch {
      pushQueue({
        kind: "issue",
        taskId: issueTask._id,
        payload: { issueType, description: issueDesc.trim() },
      });
      toast.info("Issue saved offline — will sync automatically");
    } finally {
      setBusy(false);
      setIssueTask(null);
      setIssueDesc("");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const sorted = [...(tasks ?? [])].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Check className="size-4" />
            </div>
            <div>
              <div className="text-sm font-bold leading-none tracking-tight">My Shift</div>
              <div className="text-[11px] text-muted-foreground">{profile?.fullName ?? user?.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-pending-bg px-2 py-1 text-[11px] font-semibold text-pending">
                <CloudOff className="size-3" /> {pendingCount} queued
              </span>
            )}
            <Button variant="ghost" size="icon" className="size-9 cursor-pointer" onClick={handleSignOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pt-4">
        {/* Shift card */}
        <Card className="card-layer mb-4 border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-bold tracking-tight">
                  {myShiftDoc?.name ?? "No shift assigned"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {myShiftDoc ? shiftRangeLabel(myShiftDoc.startTime, myShiftDoc.endTime) : "Ask your supervisor"}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold tabular-nums">{formatTime(now)}</div>
                <div className="text-[11px] text-muted-foreground">Today</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Progress</span>
                <span className="tabular-nums">{done}/{total} · {pct}%</span>
              </div>
              <Progress value={pct} className="h-3" />
            </div>
          </CardContent>
        </Card>

        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-bold tracking-tight">Today's Checklist</h2>
          <span className="text-xs text-muted-foreground">{formatDateLong(now)}</span>
        </div>

        {!tasks && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {tasks && sorted.length === 0 && (
          <Card className="card-layer border-dashed border-border/70">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No tasks assigned today. Enjoy the calm. 🌤️
            </CardContent>
          </Card>
        )}

        {/* Task list */}
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {sorted.map((t) => {
              const variant = computeStatus({
                status: t.status,
                reported: !!t.issue,
                dueMs: t.dueMs,
                nowMs: now,
                shiftStartMs: t.dueMs - 3600_000,
              });
              const isDone = t.status === "completed" || optimistic.includes(t._id);
              const isOverdue = variant === "overdue";
              return (
                <motion.div
                  key={t._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card
                    className={cn(
                      "card-layer border-border/70 transition-colors",
                      isDone && "bg-complete-bg/40",
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Big tap target */}
                        <button
                          disabled={isDone || t.status === "completed_with_issue"}
                          onClick={() => setConfirmTask(t)}
                          aria-label={isDone ? "Completed" : "Mark complete"}
                          className={cn(
                            "mt-0.5 flex size-12 shrink-0 items-center justify-center rounded-xl border-2 transition-all active:scale-95 cursor-pointer",
                            isDone
                              ? "border-complete bg-complete text-white"
                              : "border-border bg-background hover:border-primary",
                            isOverdue && !isDone && "border-issue/50",
                          )}
                        >
                          {isDone ? (
                            <Check className="size-6" strokeWidth={3} />
                          ) : (
                            <CircleDashed className={cn("size-6", isOverdue ? "text-issue" : "text-muted-foreground")} />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className={cn("text-sm font-semibold leading-snug", isDone && "text-muted-foreground line-through decoration-complete/60")}>
                              {t.taskName}
                            </span>
                            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", chipClasses[t.priority === "high" ? "issue" : t.priority === "medium" ? "pending" : "muted"])}>
                              {t.priority}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {isDone && t.completedAt ? (
                              <>Completed {formatTime(t.completedAt)}</>
                            ) : (
                              <>Due {formatTime(t.dueMs)}</>
                            )}
                            {t.required && !isDone && <span className="ml-1.5 font-semibold text-issue">Required</span>}
                          </div>
                          {t.note && (
                            <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs">
                              <StickyNote className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                              {t.note}
                            </div>
                          )}
                          {t.issue && (
                            <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-issue-bg px-2 py-1.5 text-xs text-issue">
                              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                              <span>
                                <span className="font-semibold">{t.issue.issueType}</span> — {t.issue.description}
                              </span>
                            </div>
                          )}
                          {!isDone && (
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 cursor-pointer text-xs"
                                onClick={() => {
                                  setNoteText(t.note ?? "");
                                  setNoteTask(t);
                                }}
                              >
                                <PenLine className="mr-1 size-3.5" /> Note
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 cursor-pointer text-xs text-issue hover:text-issue"
                                onClick={() => setIssueTask(t)}
                              >
                                <AlertTriangle className="mr-1 size-3.5" /> Report issue
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Completed tasks sync in real time to your supervisor's dashboard.
          {pendingCount > 0 && " Queued actions will upload when you're back online."}
        </p>
      </main>

      {/* Confirm completion */}
      <Dialog open={!!confirmTask} onOpenChange={(o) => !o && setConfirmTask(null)}>
        <DialogContent className="max-w-xs rounded-2xl text-center">
          <DialogHeader className="items-center text-center sm:text-center">
            <DialogTitle>Complete "{confirmTask?.taskName}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your name and the exact time will be recorded.
          </p>
          <DialogFooter className="flex-row justify-center gap-2">
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={() => setConfirmTask(null)}>
              Cancel
            </Button>
            <Button className="flex-1 cursor-pointer" disabled={busy} onClick={handleConfirmComplete}>
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Check className="mr-1 size-4" />}
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add note */}
      <Dialog open={!!noteTask} onOpenChange={(o) => !o && setNoteTask(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Note — {noteTask?.taskName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>Note for the record</Label>
            <Textarea
              rows={3}
              autoFocus
              placeholder="e.g. Client requested oatmeal instead of bread."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveNote} disabled={busy} className="cursor-pointer">
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report issue */}
      <Dialog open={!!issueTask} onOpenChange={(o) => !o && setIssueTask(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report issue — {issueTask?.taskName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Issue type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>What happened?</Label>
              <Textarea
                rows={3}
                placeholder="Describe the problem…"
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleReportIssue}
              disabled={busy || issueDesc.trim().length < 3}
              className="cursor-pointer"
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <AlertTriangle className="mr-2 size-4" />}
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

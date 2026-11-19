import { AppShell, StatusChip } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "@/lib/cf-api";
import { Link } from "react-router";
import { api } from "@/lib/cf-api";
import { useSlowClock, useToday } from "@/hooks/use-profile";
import { formatTime, shiftRangeLabel } from "@/lib/time";
import { computeStatus } from "@/lib/status";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export default function TodaySchedule() {
  const today = useToday();
  const now = useSlowClock();

  const tasks = useQuery(api.checklist.adminTasksForDate, { date: today });
  const shifts = useQuery(api.shifts.listShifts);
  const caregivers = useQuery(api.admin.caregiverDirectory);
  const templates = useQuery(api.tasks.listTemplates);
  const createOneOff = useMutation(api.checklist.createOneOffTask);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ caregiverId: "", templateId: "", scheduledTime: "09:00" });
  const [saving, setSaving] = useState(false);

  const activeCaregivers = (caregivers ?? []).filter((c) => c.status === "active");
  const activeTemplates = (templates ?? []).filter((t) => t.active);

  const byShift = useMemo(() => {
    if (!tasks) return [];
    const groups = new Map<string, typeof tasks>();
    for (const t of tasks) {
      const list = groups.get(t.shiftName) ?? [];
      list.push(t);
      groups.set(t.shiftName, list);
    }
    return [...groups.entries()].map(([shiftName, list]) => ({
      shiftName,
      list: list.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
      meta: list[0],
    }));
  }, [tasks]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createOneOff({
        templateId: form.templateId as never,
        caregiverId: form.caregiverId as never,
        date: today,
        scheduledTime: form.scheduledTime,
      });
      toast.success("Task added to today's schedule");
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      role="admin"
      title="Today's Schedule"
      subtitle={`Live view — updates automatically as caregivers complete tasks`}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer">
              <Plus className="mr-1 size-4" /> Add task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add one-off task today</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Caregiver</Label>
                <Select
                  value={form.caregiverId}
                  onValueChange={(v) => setForm((f) => ({ ...f, caregiverId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Pick caregiver" /></SelectTrigger>
                  <SelectContent>
                    {activeCaregivers.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {caregivers && activeCaregivers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No active caregivers — add one under <Link to="/caregivers" className="text-primary underline">Caregivers</Link> first.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Task</Label>
                <Select
                  value={form.templateId}
                  onValueChange={(v) => setForm((f) => ({ ...f, templateId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Pick task" /></SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name} · {t.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates && activeTemplates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No task templates yet — create one under <Link to="/tasks" className="text-primary underline">Task Templates</Link> first.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Scheduled time</Label>
                <Input
                  type="time"
                  value={form.scheduledTime}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !form.caregiverId || !form.templateId} className="cursor-pointer">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CalendarPlus className="mr-2 size-4" />}
                Add task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {!tasks && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {tasks && tasks.length === 0 && (
        <Card className="card-layer border-border/70">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No tasks scheduled today. Create recurring assignments or add a one-off task.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {byShift.map(({ shiftName, list, meta }, gi) => (
          <motion.div
            key={shiftName}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.06 }}
          >
            <Card className="card-layer border-border/70">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">{shiftName}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {meta.caregiverName}
                    {meta && ` · ${list.length} tasks`}
                  </p>
                </div>
                <Badge variant="secondary">
                  {list.filter((t) => t.status === "completed").length}/{list.length} done
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {list.map((t) => {
                  const variant = computeStatus({
                    status: t.status,
                    reported: !!t.issue,
                    dueMs: t.dueMs,
                    nowMs: now,
                    shiftStartMs: t.dueMs - 3600_000,
                  });
                  return (
                    <div key={t._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="w-14 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
                        {t.scheduledTime}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.taskName}</div>
                        <div className="text-xs text-muted-foreground">
                          Due {formatTime(t.dueMs)} · {t.patientName ?? "Unspecified"}
                          {t.note && ` · 📝 ${t.note}`}
                        </div>
                      </div>
                      {t.issue && <Badge variant="destructive">{t.issue.issueType}</Badge>}
                      <StatusChip
                        variant={variant === "overdue" ? "overdue" : variant}
                        label={
                          t.status === "completed"
                            ? `Done ${t.completedAt ? formatTime(t.completedAt) : ""}`
                            : variant === "overdue"
                              ? "Overdue"
                              : variant === "progress"
                                ? "In progress"
                                : "Upcoming"
                        }
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}

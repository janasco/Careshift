import { AppShell, StatusChip } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/cf-api";
import { AssignmentSchema } from "@/lib/schemas";
import { formatHhmmLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "react-router";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@/lib/cf-api";
import type { Id } from "@/lib/cf-types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Assignments() {
  const assignments = useQuery(api.assignments.listAssignments);
  const templates = useQuery(api.tasks.listTemplates);
  const shifts = useQuery(api.shifts.listShifts);
  const caregivers = useQuery(api.admin.caregiverDirectory);
  const patients = useQuery(api.patients.listPatients);
  const save = useMutation(api.assignments.saveAssignment);
  const setActive = useMutation(api.assignments.setAssignmentActive);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    taskTemplateId: "",
    shiftId: "",
    caregiverId: "any",
    patientId: "any",
    scheduledTime: "08:00",
    dueTime: "09:00",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0] as number[],
    active: true,
  });

  const tplName = (id: Id<"taskTemplates">) =>
    templates?.find((t) => t._id === id)?.name ?? "Task";
  const activeTemplates = (templates ?? []).filter((t) => t.active);
  const activeShifts = (shifts ?? []).filter((s) => s.active);
  const shiftName = (id: Id<"shifts">) => shifts?.find((s) => s._id === id)?.name ?? "Shift";
  const cgName = (id?: Id<"caregivers">) =>
    id ? caregivers?.find((c) => c._id === id)?.fullName ?? "Caregiver" : "Any on shift";
  const patientName = (id?: Id<"patients">) =>
    id ? patients?.find((p) => p._id === id)?.fullName ?? "Patient" : "All patients";

  const handleSave = async () => {
    const parsed = AssignmentSchema.safeParse({
      ...form,
      caregiverId: form.caregiverId === "any" ? undefined : form.caregiverId,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await save({
        taskTemplateId: form.taskTemplateId as Id<"taskTemplates">,
        shiftId: form.shiftId as Id<"shifts">,
        caregiverId: form.caregiverId === "any" ? undefined : (form.caregiverId as Id<"caregivers">),
        patientId: form.patientId === "any" ? undefined : (form.patientId as Id<"patients">),
        scheduledTime: form.scheduledTime,
        dueTime: form.dueTime,
        daysOfWeek: form.daysOfWeek,
        active: form.active,
      });
      toast.success("Assignment saved — it will appear on future schedules automatically");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d)
        ? f.daysOfWeek.filter((x) => x !== d)
        : [...f.daysOfWeek, d],
    }));
  };

  return (
    <AppShell
      role="admin"
      title="Task Assignments"
      subtitle="Recurring schedules — assigned by shift, caregiver, day, and time"
      actions={
        <Button
          className="cursor-pointer"
          onClick={() => {
            setForm({
              taskTemplateId: "",
              shiftId: "",
              caregiverId: "any",
              patientId: "any",
              scheduledTime: "08:00",
              dueTime: "09:00",
              daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
              active: true,
            });
            setErrors({});
            setOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> New assignment
        </Button>
      }
    >
      {!assignments && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {assignments && (
        <Card className="card-layer border-border/70">
          <CardContent className="p-0">
            <div className="flex flex-col divide-y">
              {assignments.map((a) => (
                <div key={a._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <CalendarClock className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {tplName(a.taskTemplateId)}
                      <span className="font-mono text-xs font-medium text-muted-foreground">
                        {formatHhmmLabel(a.scheduledTime)} – {formatHhmmLabel(a.dueTime)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{shiftName(a.shiftId)}</span>·<span>{cgName(a.caregiverId)}</span>·
                      <span>{patientName(a.patientId)}</span>·
                      <span className="flex gap-0.5">
                        {DAY_LABELS.map((d, i) => (
                          <span
                            key={d}
                            className={cn(
                              "rounded px-1 font-mono text-[10px]",
                              a.daysOfWeek.includes(i)
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground/40",
                            )}
                          >
                            {d[0]}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                  <StatusChip variant={a.active ? "active" : "inactive"} />
                  <Switch
                    checked={a.active}
                    onCheckedChange={async (v) => {
                      await setActive({ id: a._id, active: v });
                      toast.success(v ? "Assignment activated" : "Assignment paused");
                    }}
                  />
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No recurring assignments yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New recurring assignment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Task</Label>
              <Select
                value={form.taskTemplateId}
                onValueChange={(v) => setForm((f) => ({ ...f, taskTemplateId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Pick a task" /></SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name} · {t.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.taskTemplateId && <p className="text-xs text-destructive">{errors.taskTemplateId}</p>}
              {templates && activeTemplates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No task templates yet — create one under <Link to="/tasks" className="text-primary underline">Task Templates</Link> first.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Shift</Label>
              <Select value={form.shiftId} onValueChange={(v) => setForm((f) => ({ ...f, shiftId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick a shift" /></SelectTrigger>
                <SelectContent>
                  {activeShifts.map((s) => (
                    <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.shiftId && <p className="text-xs text-destructive">{errors.shiftId}</p>}
              {shifts && activeShifts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active shifts — create one under <Link to="/shifts" className="text-primary underline">Shifts</Link> first.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Caregiver</Label>
              <Select
                value={form.caregiverId}
                onValueChange={(v) => setForm((f) => ({ ...f, caregiverId: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any caregiver on this shift</SelectItem>
                  {(caregivers ?? [])
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <SelectItem key={c._id} value={c._id}>{c.fullName}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Patient</Label>
              <Select
                value={form.patientId}
                onValueChange={(v) => setForm((f) => ({ ...f, patientId: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All patients</SelectItem>
                  {(patients ?? [])
                    .filter((p) => p.status === "active")
                    .map((p) => (
                      <SelectItem key={p._id} value={p._id}>{p.fullName}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Scheduled time</Label>
                <Input
                  type="time"
                  value={form.scheduledTime}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                />
                {errors.scheduledTime && <p className="text-xs text-destructive">{errors.scheduledTime}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Due time</Label>
                <Input
                  type="time"
                  value={form.dueTime}
                  onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
                />
                {errors.dueTime && <p className="text-xs text-destructive">{errors.dueTime}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Days of week</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "size-9 rounded-md border text-xs font-semibold transition-colors cursor-pointer",
                      form.daysOfWeek.includes(i)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {d[0]}
                  </button>
                ))}
              </div>
              {errors.daysOfWeek && <p className="text-xs text-destructive">{errors.daysOfWeek}</p>}
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <Label htmlFor="asg-active">Active</Label>
              <Switch
                id="asg-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tasks appear on the caregiver's checklist the next time the day is generated.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

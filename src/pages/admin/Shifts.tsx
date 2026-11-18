import { AppShell, StatusChip } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { formatHhmmLabel, shiftRangeLabel } from "@/lib/time";
import { SHIFT_PRESETS } from "@/lib/constants";
import { ShiftSchema } from "@/lib/schemas";
import { toast } from "sonner";
import { Clock, Loader2, MoonStar, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";

type Shift = {
  _id: Id<"shifts">;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
};

export default function Shifts() {
  const shifts = useQuery(api.shifts.listShifts);
  const caregivers = useQuery(api.admin.caregiverDirectory);
  const upsert = useMutation(api.shifts.upsertShift);
  const setActive = useMutation(api.shifts.setShiftActive);
  const deleteShift = useMutation(api.shifts.deleteShift);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState({ name: "", startTime: "06:00", endTime: "14:00", active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", startTime: "06:00", endTime: "14:00", active: true });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (s: Shift) => {
    setEditing(s);
    setForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, active: s.active });
    setErrors({});
    setOpen(true);
  };

  const handleSave = async () => {
    const parsed = ShiftSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await upsert({
        id: editing?._id,
        ...parsed.data,
        active: form.active,
      });
      toast.success(editing ? "Shift updated" : "Shift created");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: Shift) => {
    try {
      await setActive({ id: s._id, active: !s.active });
      toast.success(`${s.name} ${s.active ? "deactivated" : "activated"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteShift({ id: deleteTarget._id });
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const caregiverCount = (shiftId: Id<"shifts">) =>
    (caregivers ?? []).filter((c) => c.shiftId === shiftId && c.status === "active").length;

  return (
    <AppShell
      role="admin"
      title="Shifts"
      subtitle="Define working windows — overnight shifts are supported"
      actions={
        <Button onClick={openNew} className="cursor-pointer">
          <Plus className="mr-1 size-4" /> New shift
        </Button>
      }
    >
      {!shifts && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {shifts && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shifts.map((s) => {
            const overnight = s.endTime <= s.startTime;
            return (
              <Card key={s._id} className="card-layer border-border/70">
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <StatusChip variant={s.active ? "active" : "inactive"} />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4" />
                    {shiftRangeLabel(s.startTime, s.endTime)}
                  </div>
                  {overnight && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-progress">
                      <MoonStar className="size-3.5" /> Crosses midnight
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {caregiverCount(s._id)} active caregiver{caregiverCount(s._id) === 1 ? "" : "s"}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={s.active} onCheckedChange={() => handleToggle(s)} />
                      {s.active ? "Active" : "Inactive"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => openEdit(s)}>
                        <Pencil className="mr-1 size-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 cursor-pointer text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => setDeleteTarget(s)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {shifts.length === 0 && (
            <Card className="card-layer border-dashed border-border/70 sm:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-sm text-muted-foreground">No shifts yet.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SHIFT_PRESETS.map((p) => (
                    <Button
                      key={p.name}
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={async () => {
                        await upsert({ name: p.name, startTime: p.start, endTime: p.end, active: true });
                        toast.success(`${p.name} created`);
                      }}
                    >
                      <Plus className="mr-1 size-3.5" /> {p.name} ({formatHhmmLabel(p.start)})
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit shift" : "New shift"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Shift name</Label>
              <Input
                value={form.name}
                placeholder="Morning Shift"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
                {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>End time</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
                {errors.endTime && <p className="text-xs text-destructive">{errors.endTime}</p>}
              </div>
            </div>
            {form.endTime <= form.startTime && (
              <p className="flex items-center gap-1.5 rounded-md bg-progress-bg px-2.5 py-1.5 text-xs text-progress">
                <MoonStar className="size-3.5" /> End time before start — this shift crosses midnight.
              </p>
            )}
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <Label htmlFor="shift-active">Active</Label>
              <Switch
                id="shift-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete shift?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
            This cannot be undone. If caregivers, assignments, scheduled tasks, or visits
            reference this shift, deletion will be blocked — deactivate it instead.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Delete shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

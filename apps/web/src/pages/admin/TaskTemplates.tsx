import { AppShell, StatusChip } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/cf-api";
import { CATEGORIES, PRIORITIES } from "@/lib/constants";
import { TaskSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@/lib/cf-api";
import type { Doc, Id } from "@/lib/cf-types";

type Template = Doc<"taskTemplates">;

export default function TaskTemplates() {
  const templates = useQuery(api.tasks.listTemplates);
  const save = useMutation(api.tasks.saveTemplate);
  const deactivate = useMutation(api.tasks.deactivateTemplate);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: CATEGORIES[0] as string,
    priority: "medium",
    estimatedDuration: 30,
    required: true,
    recurring: true,
    active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      category: CATEGORIES[0],
      priority: "medium",
      estimatedDuration: 30,
      required: true,
      recurring: true,
      active: true,
    });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      category: t.category,
      priority: t.priority,
      estimatedDuration: t.estimatedDuration,
      required: t.required,
      recurring: t.recurring,
      active: t.active,
    });
    setErrors({});
    setOpen(true);
  };

  const handleSave = async () => {
    const parsed = TaskSchema.safeParse({ ...form, estimatedDuration: Number(form.estimatedDuration) });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await save({
        id: editing?._id,
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        priority: form.priority as "high" | "medium" | "low",
        estimatedDuration: Number(form.estimatedDuration),
        required: form.required,
        recurring: form.recurring,
        active: form.active,
      });
      toast.success(editing ? "Task updated" : "Task created");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (t: Template) => {
    try {
      await deactivate({ id: t._id });
      toast.success(`${t.name} deactivated (history preserved)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <AppShell
      role="admin"
      title="Task Templates"
      subtitle="Reusable checklist tasks — fully customizable"
      actions={
        <Button onClick={openNew} className="cursor-pointer">
          <Plus className="mr-1 size-4" /> New task
        </Button>
      }
    >
      {!templates && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {templates && (
        <div className="flex flex-col gap-6">
          {CATEGORIES.map((cat) => {
            const inCat = templates.filter((t) => t.category === cat);
            if (inCat.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="mb-2 text-sm font-bold tracking-tight text-muted-foreground">{cat}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inCat.map((t) => (
                    <Card key={t._id} className={cn("card-layer border-border/70", !t.active && "opacity-60")}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{t.name}</div>
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {t.description ?? ""}
                            </div>
                          </div>
                          <StatusChip variant={t.active ? "active" : "inactive"} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Badge
                            variant="secondary"
                            className={cn(
                              t.priority === "high" && "bg-issue-bg text-issue",
                              t.priority === "medium" && "bg-pending-bg text-pending",
                              t.priority === "low" && "bg-muted text-muted-foreground",
                            )}
                          >
                            {t.priority}
                          </Badge>
                          <Badge variant="secondary">{t.estimatedDuration} min</Badge>
                          {t.required && <Badge variant="secondary">Required</Badge>}
                          {t.recurring && <Badge variant="secondary">Recurring</Badge>}
                        </div>
                        <div className="mt-3 flex justify-end gap-1 border-t pt-3">
                          <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => openEdit(t)}>
                            <Pencil className="mr-1 size-3.5" /> Edit
                          </Button>
                          {t.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer text-destructive focus:text-destructive"
                              onClick={() => handleDeactivate(t)}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
          {templates.length === 0 && (
            <Card className="card-layer border-dashed border-border/70">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No task templates yet — create your first checklist task.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Task name</Label>
              <Input
                value={form.name}
                placeholder="Assist with bathing"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                placeholder="Optional details for the caregiver"
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Estimated duration (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={480}
                value={form.estimatedDuration}
                onChange={(e) => setForm((f) => ({ ...f, estimatedDuration: Number(e.target.value) }))}
              />
              {errors.estimatedDuration && (
                <p className="text-xs text-destructive">{errors.estimatedDuration}</p>
              )}
            </div>
            {(
              [
                ["required", "Required task", "Must be completed each shift"],
                ["recurring", "Recurring", "Repeats on assigned days"],
                ["active", "Active", "Available for assignment"],
              ] as const
            ).map(([key, label, hint]) => (
              <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2.5">
                <div>
                  <Label htmlFor={key}>{label}</Label>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <Switch
                  id={key}
                  checked={form[key]}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

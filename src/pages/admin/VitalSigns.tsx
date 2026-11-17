import { AppShell } from "@/components/AppShell";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { HeartPulse, Loader2, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";

type VitalRow = {
  _id: Id<"vitalSigns">;
  patientName?: string;
  caregiverId?: Id<"caregivers">;
  caregiverName?: string;
  timeLabel?: string;
  bp?: string;
  spo2?: number;
  pulse?: number;
  respiration?: number;
  temperature?: string;
  notes: string;
  recordedAt?: number;
  createdAt: number;
};

type Caregiver = {
  _id: Id<"caregivers">;
  fullName: string;
  status: string;
};

type Form = {
  patientName: string;
  caregiverId: string;
  timeLabel: string;
  bp: string;
  spo2: string;
  pulse: string;
  respiration: string;
  temperature: string;
  notes: string;
};

const emptyForm: Form = {
  patientName: "",
  caregiverId: "",
  timeLabel: "",
  bp: "",
  spo2: "",
  pulse: "",
  respiration: "",
  temperature: "",
  notes: "",
};

const PATIENTS = ["All patients", "John Smith", "Sir Shannon", "Unspecified"];

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function reportedLabel(row: VitalRow) {
  if (row.recordedAt) return new Date(row.recordedAt).toLocaleString();
  return row.timeLabel || "Time not provided";
}

export default function VitalSigns() {
  const rows = useQuery(api.vitals.listVitalSigns) as VitalRow[] | undefined;
  const caregivers = useQuery(api.admin.caregiverDirectory) as Caregiver[] | undefined;
  const createVitalSign = useMutation(api.vitals.createVitalSign);
  const updateVitalSign = useMutation(api.vitals.updateVitalSign);

  const [patientFilter, setPatientFilter] = useState("All patients");
  const [caregiverFilter, setCaregiverFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VitalRow | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return (rows ?? []).filter((row) => {
      const patient = row.patientName ?? "Unspecified";
      if (patientFilter !== "All patients" && patient !== patientFilter) return false;
      if (caregiverFilter === "unassigned" && row.caregiverId) return false;
      if (caregiverFilter !== "all" && caregiverFilter !== "unassigned" && row.caregiverId !== caregiverFilter) {
        return false;
      }
      return true;
    });
  }, [rows, patientFilter, caregiverFilter]);

  const patients = new Set((rows ?? []).map((row) => row.patientName ?? "Unspecified"));
  const unassigned = (rows ?? []).filter((row) => !row.caregiverId).length;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: VitalRow) => {
    setEditing(row);
    setForm({
      patientName: row.patientName ?? "",
      caregiverId: row.caregiverId ?? "",
      timeLabel: row.timeLabel ?? "",
      bp: row.bp ?? "",
      spo2: row.spo2 != null ? String(row.spo2) : "",
      pulse: row.pulse != null ? String(row.pulse) : "",
      respiration: row.respiration != null ? String(row.respiration) : "",
      temperature: row.temperature ?? "",
      notes: row.notes,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.notes.trim()) {
      toast.error("Notes are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        patientName: form.patientName.trim() || undefined,
        caregiverId: form.caregiverId
          ? (form.caregiverId as Id<"caregivers">)
          : undefined,
        timeLabel: form.timeLabel.trim() || undefined,
        bp: form.bp.trim() || undefined,
        spo2: numberOrUndefined(form.spo2),
        pulse: numberOrUndefined(form.pulse),
        respiration: numberOrUndefined(form.respiration),
        temperature: form.temperature.trim() || undefined,
        notes: form.notes,
      };
      if (editing) {
        await updateVitalSign({ id: editing._id, ...payload });
        toast.success("Reading updated");
      } else {
        await createVitalSign(payload);
        toast.success("Reading added");
      }
      setOpen(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save reading");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      role="admin"
      title="Vital Signs"
      subtitle="Manual readings and shift observations reported by caregivers"
      actions={
        <Button onClick={openAdd} className="cursor-pointer">
          <Plus className="mr-2 size-4" /> Add reading
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total readings</p>
            <p className="mt-1 text-2xl font-semibold">{rows?.length ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Patients tracked</p>
            <p className="mt-1 text-2xl font-semibold">{patients.size}</p>
          </CardContent>
        </Card>
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unassigned reports</p>
            <p className="mt-1 text-2xl font-semibold">{unassigned}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-layer border-border/70">
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={patientFilter} onValueChange={setPatientFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Patient" />
              </SelectTrigger>
              <SelectContent>
                {PATIENTS.map((patient) => (
                  <SelectItem key={patient} value={patient}>
                    {patient}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={caregiverFilter} onValueChange={setCaregiverFilter}>
              <SelectTrigger className="w-[210px]">
                <SelectValue placeholder="Caregiver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All caregivers</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(caregivers ?? []).map((caregiver) => (
                  <SelectItem key={caregiver._id} value={caregiver._id}>
                    {caregiver.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length} of {rows?.length ?? 0}
            </span>
          </div>

          {rows === undefined ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading readings…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <HeartPulse className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No vital signs match the current filters.
              </p>
              <Button variant="outline" onClick={openAdd} className="cursor-pointer">
                <Plus className="mr-2 size-4" /> Add the first reading
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Reported</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Caregiver</TableHead>
                    <TableHead>BP</TableHead>
                    <TableHead>SpO₂</TableHead>
                    <TableHead>PR</TableHead>
                    <TableHead>RR</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead className="min-w-[280px]">Notes</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell className="align-top text-xs">
                        <div className="font-medium">{reportedLabel(row)}</div>
                        {!row.recordedAt && (
                          <div className="text-muted-foreground">date not provided</div>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs font-medium">
                        {row.patientName ?? "Unspecified"}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        {row.caregiverName ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="align-top text-xs">{row.bp ?? "—"}</TableCell>
                      <TableCell className="align-top text-xs">
                        {row.spo2 != null ? `${row.spo2}%` : "—"}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        {row.pulse != null ? `${row.pulse} bpm` : "—"}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        {row.respiration != null ? `${row.respiration} cpm` : "—"}
                      </TableCell>
                      <TableCell className="align-top text-xs">{row.temperature ?? "—"}</TableCell>
                      <TableCell className="align-top">
                        <p className="line-clamp-3 max-w-md whitespace-pre-wrap text-xs text-muted-foreground">
                          {row.notes}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          className="size-7 cursor-pointer"
                          aria-label="Edit reading"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit vital signs reading" : "Add vital signs reading"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="patientName">Patient</Label>
              <Input
                id="patientName"
                value={form.patientName}
                onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Caregiver</Label>
              <Select
                value={form.caregiverId || "unassigned"}
                onValueChange={(value) =>
                  setForm({ ...form, caregiverId: value === "unassigned" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(caregivers ?? []).map((caregiver) => (
                    <SelectItem key={caregiver._id} value={caregiver._id}>
                      {caregiver.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timeLabel">Reported time</Label>
              <Input
                id="timeLabel"
                value={form.timeLabel}
                onChange={(e) => setForm({ ...form, timeLabel: e.target.value })}
                placeholder="e.g. 8:00 PM (or leave blank for now)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp">Blood pressure</Label>
              <Input
                id="bp"
                value={form.bp}
                onChange={(e) => setForm({ ...form, bp: e.target.value })}
                placeholder="e.g. 120/80 mmHg"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <div className="space-y-1.5">
                <Label htmlFor="spo2">SpO₂ (%)</Label>
                <Input
                  id="spo2"
                  type="number"
                  value={form.spo2}
                  onChange={(e) => setForm({ ...form, spo2: e.target.value })}
                  placeholder="97"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pulse">PR (bpm)</Label>
                <Input
                  id="pulse"
                  type="number"
                  value={form.pulse}
                  onChange={(e) => setForm({ ...form, pulse: e.target.value })}
                  placeholder="80"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="respiration">RR (cpm)</Label>
                <Input
                  id="respiration"
                  type="number"
                  value={form.respiration}
                  onChange={(e) => setForm({ ...form, respiration: e.target.value })}
                  placeholder="18"
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                placeholder="e.g. 36.8 °C"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes / observations</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Shift observations, interventions, urine output, concerns…"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? "Save changes" : "Add reading"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

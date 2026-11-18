import { AppShell } from "@/components/AppShell";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useToday } from "@/hooks/use-profile";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";

type MedicationRow = {
  _id: Id<"medications">;
  patientId?: Id<"patients">;
  patientName: string;
  name: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  times: string[];
  startDate?: string;
  endDate?: string;
  instructions?: string;
  stock?: number;
  refillThreshold?: number;
  active: boolean;
  lowStock: boolean;
};

type DoseLog = {
  _id: Id<"medicationLogs">;
  status: "taken" | "skipped" | "missed";
  takenAt?: number;
  skipReason?: string;
  notes?: string;
  caregiverName?: string;
};

type MedicationWithDoses = MedicationRow & {
  doses: Array<{ time: string; log: DoseLog | null }>;
};

type Patient = { _id: Id<"patients">; fullName: string; status: string };

type MedForm = {
  patientId: string;
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  times: string;
  startDate: string;
  endDate: string;
  instructions: string;
  stock: string;
  refillThreshold: string;
  active: boolean;
};

const emptyForm: MedForm = {
  patientId: "",
  name: "",
  dosage: "",
  route: "Oral",
  frequency: "Daily",
  times: "08:00",
  startDate: "",
  endDate: "",
  instructions: "",
  stock: "",
  refillThreshold: "",
  active: true,
};

const SKIP_REASONS = [
  "Doctor advised pause",
  "Adverse reaction",
  "Fasting",
  "Illness",
  "Ran out of medicine",
  "Client refused",
  "Other",
];

function daysAgoStr(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function nowTimeStr() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatTimeLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function Medications() {
  const today = useToday();
  const medications = useQuery(api.medications.listMedications) as
    | MedicationRow[]
    | undefined;
  const schedule = useQuery(api.medications.listMedicationDoses, { date: today }) as
    | MedicationWithDoses[]
    | undefined;
  const patients = useQuery(api.patients.listPatients) as Patient[] | undefined;
  const adherence = useQuery(api.medications.medicationAdherence, {
    fromDate: daysAgoStr(6),
    toDate: today,
    nowDate: today,
    nowTime: nowTimeStr(),
  }) as
    | {
        expected: number;
        taken: number;
        skipped: number;
        missed: number;
        rate: number;
        medications: Array<{
          medicationId: Id<"medications">;
          name: string;
          patientName: string;
          expected: number;
          taken: number;
          rate: number;
          lowStock: boolean;
        }>;
      }
    | undefined;

  const createMedication = useMutation(api.medications.createMedication);
  const updateMedication = useMutation(api.medications.updateMedication);
  const logDose = useMutation(api.medications.logDose);
  const clearDoseLog = useMutation(api.medications.clearDoseLog);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MedicationRow | null>(null);
  const [form, setForm] = useState<MedForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [skipTarget, setSkipTarget] = useState<{
    medicationId: Id<"medications">;
    time: string;
    name: string;
  } | null>(null);
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0]);
  const [busyDose, setBusyDose] = useState<string | null>(null);

  const activeMeds = (medications ?? []).filter((medication) => medication.active);
  const lowStock = activeMeds.filter((medication) => medication.lowStock);

  const doseRows = useMemo(() => {
    return (schedule ?? [])
      .flatMap((medication) =>
        medication.doses.map((dose) => ({ medication, dose })),
      )
      .sort((a, b) => a.dose.time.localeCompare(b.dose.time));
  }, [schedule]);

  const takenToday = doseRows.filter((row) => row.dose.log?.status === "taken").length;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (medication: MedicationRow) => {
    setEditing(medication);
    setForm({
      patientId: medication.patientId ?? "",
      name: medication.name,
      dosage: medication.dosage ?? "",
      route: medication.route ?? "",
      frequency: medication.frequency ?? "",
      times: medication.times.join(", "),
      startDate: medication.startDate ?? "",
      endDate: medication.endDate ?? "",
      instructions: medication.instructions ?? "",
      stock: medication.stock != null ? String(medication.stock) : "",
      refillThreshold:
        medication.refillThreshold != null ? String(medication.refillThreshold) : "",
      active: medication.active,
    });
    setOpen(true);
  };

  const saveMedication = async () => {
    if (!form.name.trim()) {
      toast.error("Medication name is required");
      return;
    }
    const times = form.times
      .split(",")
      .map((time) => time.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const payload = {
        patientId: form.patientId ? (form.patientId as Id<"patients">) : undefined,
        name: form.name,
        dosage: form.dosage || undefined,
        route: form.route || undefined,
        frequency: form.frequency || undefined,
        times,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        instructions: form.instructions || undefined,
        stock: numberOrUndefined(form.stock),
        refillThreshold: numberOrUndefined(form.refillThreshold),
      };
      if (editing) {
        await updateMedication({
          medicationId: editing._id,
          ...payload,
          active: form.active,
        });
        toast.success("Medication updated");
      } else {
        await createMedication(payload);
        toast.success("Medication added");
      }
      setOpen(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save medication");
    } finally {
      setSaving(false);
    }
  };

  const markTaken = async (
    medicationId: Id<"medications">,
    time: string,
  ) => {
    setBusyDose(`${medicationId}-${time}`);
    try {
      await logDose({ medicationId, date: today, scheduledTime: time, status: "taken" });
      toast.success("Dose marked as given");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log dose");
    } finally {
      setBusyDose(null);
    }
  };

  const confirmSkip = async () => {
    if (!skipTarget) return;
    setBusyDose(`${skipTarget.medicationId}-${skipTarget.time}`);
    try {
      await logDose({
        medicationId: skipTarget.medicationId,
        date: today,
        scheduledTime: skipTarget.time,
        status: "skipped",
        skipReason,
      });
      toast.success("Dose marked as skipped");
      setSkipTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log dose");
    } finally {
      setBusyDose(null);
    }
  };

  const resetDose = async (medicationId: Id<"medications">, time: string) => {
    setBusyDose(`${medicationId}-${time}`);
    try {
      await clearDoseLog({ medicationId, date: today, scheduledTime: time });
      toast.success("Dose reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset dose");
    } finally {
      setBusyDose(null);
    }
  };

  return (
    <AppShell
      role="admin"
      title="Medications"
      subtitle="Schedules, dose confirmation, adherence, and stock alerts"
      actions={
        <Button onClick={openAdd} className="cursor-pointer">
          <Plus className="mr-2 size-4" /> Add medication
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active medications</p>
            <p className="mt-1 text-2xl font-semibold">{activeMeds.length}</p>
          </CardContent>
        </Card>
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Doses today</p>
            <p className="mt-1 text-2xl font-semibold">
              {takenToday}/{doseRows.length}
            </p>
            <Progress
              value={doseRows.length ? (takenToday / doseRows.length) * 100 : 0}
              className="mt-2 h-1.5"
            />
          </CardContent>
        </Card>
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">7-day adherence</p>
            <p className="mt-1 text-2xl font-semibold">
              {adherence ? `${adherence.rate}%` : "—"}
            </p>
            <Progress value={adherence?.rate ?? 0} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card className={lowStock.length > 0 ? "border-destructive/50" : "card-layer border-border/70"}>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Low stock</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              {lowStock.length}
              {lowStock.length > 0 && <AlertTriangle className="size-4 text-destructive" />}
            </p>
          </CardContent>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <span className="font-medium text-destructive">Refill needed:</span>{" "}
          {lowStock.map((medication) => medication.name).join(", ")}
        </div>
      )}

      <Tabs defaultValue="today">
        <TabsList className="mb-4">
          <TabsTrigger value="today">Today's doses</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="adherence">Adherence</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card className="card-layer border-border/70">
            <CardContent className="pt-5">
              {schedule === undefined ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Loading doses…
                </div>
              ) : doseRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <Pill className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No scheduled doses for today. Add a medication with scheduled times.
                  </p>
                  <Button variant="outline" onClick={openAdd} className="cursor-pointer">
                    <Plus className="mr-2 size-4" /> Add medication
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {doseRows.map(({ medication, dose }) => {
                    const key = `${medication._id}-${dose.time}`;
                    const log = dose.log;
                    const isPast = dose.time <= nowTimeStr();
                    const overdue = !log && isPast;
                    return (
                      <div
                        key={key}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                      >
                        <div className="w-20 text-sm font-semibold">
                          {formatTimeLabel(dose.time)}
                        </div>
                        <div className="min-w-[160px] flex-1">
                          <p className="text-sm font-medium">
                            {medication.name}
                            {medication.dosage ? (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {medication.dosage}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {medication.patientName}
                            {medication.route ? ` · ${medication.route}` : ""}
                            {medication.instructions ? ` · ${medication.instructions}` : ""}
                          </p>
                        </div>
                        <div>
                          {log?.status === "taken" ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="size-3" /> Taken
                              {log.takenAt
                                ? ` ${new Date(log.takenAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}`
                                : ""}
                            </Badge>
                          ) : log?.status === "skipped" ? (
                            <Badge variant="outline" className="gap-1" title={log.skipReason}>
                              <SkipForward className="size-3" /> Skipped
                              {log.skipReason ? `: ${log.skipReason}` : ""}
                            </Badge>
                          ) : overdue ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge variant="outline">Due</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!log ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => markTaken(medication._id, dose.time)}
                                disabled={busyDose === key}
                                className="cursor-pointer"
                              >
                                {busyDose === key ? (
                                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-1 size-3.5" />
                                )}
                                Given
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setSkipTarget({
                                    medicationId: medication._id,
                                    time: dose.time,
                                    name: medication.name,
                                  })
                                }
                                disabled={busyDose === key}
                                className="cursor-pointer"
                              >
                                <SkipForward className="mr-1 size-3.5" /> Skip
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resetDose(medication._id, dose.time)}
                              disabled={busyDose === key}
                              className="cursor-pointer"
                            >
                              <RotateCcw className="mr-1 size-3.5" /> Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications">
          <Card className="card-layer border-border/70">
            <CardContent className="pt-5">
              {medications === undefined ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Loading medications…
                </div>
              ) : medications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <Pill className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No medications yet.</p>
                  <Button variant="outline" onClick={openAdd} className="cursor-pointer">
                    <Plus className="mr-2 size-4" /> Add the first medication
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medication</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Dosage / route</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medications.map((medication) => (
                        <TableRow key={medication._id}>
                          <TableCell className="align-top">
                            <p className="text-sm font-medium">{medication.name}</p>
                            {medication.instructions && (
                              <p className="max-w-xs text-xs text-muted-foreground">
                                {medication.instructions}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            {medication.patientName}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            {[medication.dosage, medication.route].filter(Boolean).join(" · ") || "—"}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            <p>{medication.frequency || "Scheduled"}</p>
                            <p className="text-muted-foreground">
                              {medication.times.length > 0
                                ? medication.times.map(formatTimeLabel).join(", ")
                                : "PRN / no fixed times"}
                            </p>
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            {medication.stock != null ? (
                              <span className={medication.lowStock ? "font-medium text-destructive" : ""}>
                                {medication.stock}
                                {medication.lowStock ? " (low)" : ""}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant={medication.active ? "secondary" : "outline"}>
                              {medication.active ? "active" : "inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(medication)}
                              className="size-7 cursor-pointer"
                              aria-label="Edit medication"
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
        </TabsContent>

        <TabsContent value="adherence">
          <Card className="card-layer border-border/70">
            <CardContent className="pt-5">
              {adherence === undefined ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Loading adherence…
                </div>
              ) : adherence.expected === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No scheduled doses in the last 7 days.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Overall 7-day adherence</span>
                      <span className="text-2xl font-semibold">{adherence.rate}%</span>
                    </div>
                    <Progress value={adherence.rate} className="mt-2 h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {adherence.taken} taken · {adherence.skipped} skipped · {adherence.missed} missed ·{" "}
                      {adherence.expected} expected
                    </p>
                  </div>
                  <div className="space-y-2">
                    {adherence.medications.map((medication) => (
                      <div
                        key={medication.medicationId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{medication.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {medication.patientName}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span>
                            {medication.taken}/{medication.expected} taken
                          </span>
                          <span className="font-semibold">{medication.rate}%</span>
                          {medication.lowStock && (
                            <Badge variant="destructive">Low stock</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit medication" : "Add medication"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Patient</Label>
              <Select
                value={form.patientId || "unspecified"}
                onValueChange={(value) =>
                  setForm({ ...form, patientId: value === "unspecified" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unspecified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">Unspecified</SelectItem>
                  {(patients ?? []).map((patient) => (
                    <SelectItem key={patient._id} value={patient._id}>
                      {patient.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="medName">Medication name</Label>
              <Input
                id="medName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Lactulose"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                placeholder="e.g. 15 mL"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="route">Route</Label>
              <Input
                id="route"
                value={form.route}
                onChange={(e) => setForm({ ...form, route: e.target.value })}
                placeholder="e.g. Oral, PEG tube"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency">Frequency</Label>
              <Input
                id="frequency"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                placeholder="e.g. Daily, BID, PRN"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="times">Scheduled times</Label>
              <Input
                id="times"
                value={form.times}
                onChange={(e) => setForm({ ...form, times: e.target.value })}
                placeholder="24-hour, comma separated: 08:00, 20:00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock">Stock on hand</Label>
              <Input
                id="stock"
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="e.g. 30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refill">Low-stock threshold</Label>
              <Input
                id="refill"
                type="number"
                value={form.refillThreshold}
                onChange={(e) => setForm({ ...form, refillThreshold: e.target.value })}
                placeholder="e.g. 7"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="With food, hold if BP low, flush PEG tube after dose…"
                rows={3}
              />
            </div>
            {editing && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  id="active"
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                />
                <Label htmlFor="active">Active medication</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={saveMedication} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? "Save changes" : "Add medication"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(skipTarget)} onOpenChange={(value) => !value && setSkipTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Skip dose — {skipTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={skipReason} onValueChange={setSkipReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {SKIP_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipTarget(null)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={confirmSkip} className="cursor-pointer">
              Mark skipped
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

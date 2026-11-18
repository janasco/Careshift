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
import { api } from "@convex/_generated/api";
import { CARE_EVENT_SEVERITIES, CARE_EVENT_TYPES } from "@/lib/care-events";
import { toast } from "sonner";
import { Loader2, NotebookPen, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import type { Id } from "@convex/_generated/dataModel";

type CareEventRow = {
  _id: Id<"careEvents">;
  patientId?: Id<"patients">;
  patientName?: string;
  caregiverId?: Id<"caregivers">;
  caregiverName?: string;
  eventType: string;
  severity?: "low" | "medium" | "high";
  occurredAt?: number;
  timeLabel?: string;
  notes: string;
  createdAt: number;
};

type Patient = { _id: Id<"patients">; fullName: string; status: string };
type Caregiver = { _id: Id<"caregivers">; fullName: string; status: string };

type Form = {
  patientId: string;
  caregiverId: string;
  eventType: string;
  severity: string;
  timeLabel: string;
  notes: string;
};

const emptyForm: Form = {
  patientId: "",
  caregiverId: "",
  eventType: CARE_EVENT_TYPES[0],
  severity: "",
  timeLabel: "",
  notes: "",
};

function reportedLabel(row: CareEventRow) {
  if (row.occurredAt) return new Date(row.occurredAt).toLocaleString();
  return row.timeLabel || "Time not provided";
}

function severityVariant(severity?: string) {
  if (severity === "high") return "destructive" as const;
  if (severity === "medium") return "secondary" as const;
  return "outline" as const;
}

export default function CareLog() {
  const [searchParams] = useSearchParams();
  const events = useQuery(api.careEvents.listCareEvents) as CareEventRow[] | undefined;
  const patients = useQuery(api.patients.listPatients) as Patient[] | undefined;
  const caregivers = useQuery(api.admin.caregiverDirectory) as Caregiver[] | undefined;
  const createCareEvent = useMutation(api.careEvents.createCareEvent);
  const updateCareEvent = useMutation(api.careEvents.updateCareEvent);

  const [patientFilter, setPatientFilter] = useState(
    () => searchParams.get("patient") ?? "all",
  );
  const [caregiverFilter, setCaregiverFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CareEventRow | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const eventTypes = useMemo(() => {
    const values = new Set<string>(CARE_EVENT_TYPES);
    (events ?? []).forEach((event) => values.add(event.eventType));
    return Array.from(values).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return (events ?? []).filter((event) => {
      if (patientFilter === "unassigned" && event.patientId) return false;
      if (
        patientFilter !== "all" &&
        patientFilter !== "unassigned" &&
        event.patientId !== patientFilter
      ) {
        return false;
      }
      if (caregiverFilter === "unassigned" && event.caregiverId) return false;
      if (
        caregiverFilter !== "all" &&
        caregiverFilter !== "unassigned" &&
        event.caregiverId !== caregiverFilter
      ) {
        return false;
      }
      if (typeFilter !== "all" && event.eventType !== typeFilter) return false;
      return true;
    });
  }, [events, patientFilter, caregiverFilter, typeFilter]);

  const highSeverity = (events ?? []).filter((event) => event.severity === "high").length;
  const unassigned = (events ?? []).filter((event) => !event.caregiverId).length;

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      patientId: patientFilter !== "all" && patientFilter !== "unassigned" ? patientFilter : "",
    });
    setOpen(true);
  };

  const openEdit = (event: CareEventRow) => {
    setEditing(event);
    setForm({
      patientId: event.patientId ?? "",
      caregiverId: event.caregiverId ?? "",
      eventType: event.eventType,
      severity: event.severity ?? "",
      timeLabel: event.timeLabel ?? "",
      notes: event.notes,
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
        patientId: form.patientId ? (form.patientId as Id<"patients">) : undefined,
        caregiverId: form.caregiverId
          ? (form.caregiverId as Id<"caregivers">)
          : undefined,
        eventType: form.eventType,
        severity: form.severity
          ? (form.severity as "low" | "medium" | "high")
          : undefined,
        timeLabel: form.timeLabel.trim() || undefined,
        notes: form.notes,
      };
      if (editing) {
        await updateCareEvent({ eventId: editing._id, ...payload });
        toast.success("Care event updated");
      } else {
        await createCareEvent({ ...payload, occurredAt: Date.now() });
        toast.success("Care event added");
      }
      setOpen(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save care event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      role="admin"
      title="Care Log"
      subtitle="Everyday observations: toileting, medication, stoma care, pain, intake, and more"
      actions={
        <Button onClick={openAdd} className="cursor-pointer">
          <Plus className="mr-2 size-4" /> Add event
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total events</p>
            <p className="mt-1 text-2xl font-semibold">{events?.length ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">High severity</p>
            <p className="mt-1 text-2xl font-semibold">{highSeverity}</p>
          </CardContent>
        </Card>
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unassigned</p>
            <p className="mt-1 text-2xl font-semibold">{unassigned}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-layer border-border/70">
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={patientFilter} onValueChange={setPatientFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All patients</SelectItem>
                <SelectItem value="unassigned">Unspecified</SelectItem>
                {(patients ?? []).map((patient) => (
                  <SelectItem key={patient._id} value={patient._id}>
                    {patient.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={caregiverFilter} onValueChange={setCaregiverFilter}>
              <SelectTrigger className="w-[200px]">
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[210px]">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Showing {filtered.length} of {events?.length ?? 0}
            </span>
          </div>

          {events === undefined ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading care events…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <NotebookPen className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No care events match the current filters.
              </p>
              <Button variant="outline" onClick={openAdd} className="cursor-pointer">
                <Plus className="mr-2 size-4" /> Add the first event
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Reported</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Caregiver</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="min-w-[300px]">Notes</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell className="align-top text-xs">
                        <div className="font-medium">{reportedLabel(event)}</div>
                        {!event.occurredAt && (
                          <div className="text-muted-foreground">date not provided</div>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs font-medium">
                        {event.patientName ?? "Unspecified"}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        {event.caregiverName ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="align-top text-xs">{event.eventType}</TableCell>
                      <TableCell className="align-top">
                        {event.severity ? (
                          <Badge variant={severityVariant(event.severity)}>
                            {event.severity}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="line-clamp-3 max-w-md whitespace-pre-wrap text-xs text-muted-foreground">
                          {event.notes}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(event)}
                          className="size-7 cursor-pointer"
                          aria-label="Edit care event"
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
            <DialogTitle>{editing ? "Edit care event" : "Add care event"}</DialogTitle>
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
              <Label>Event type</Label>
              <Select
                value={form.eventType}
                onValueChange={(value) => setForm({ ...form, eventType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select
                value={form.severity || "none"}
                onValueChange={(value) =>
                  setForm({ ...form, severity: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {CARE_EVENT_SEVERITIES.map((severity) => (
                    <SelectItem key={severity.value} value={severity.value}>
                      {severity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="timeLabel">Reported time</Label>
              <Input
                id="timeLabel"
                value={form.timeLabel}
                onChange={(e) => setForm({ ...form, timeLabel: e.target.value })}
                placeholder="e.g. 8:00 PM (leave blank for now)"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes / observation</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="What happened, what was given, output, concerns…"
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
              {editing ? "Save changes" : "Add event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

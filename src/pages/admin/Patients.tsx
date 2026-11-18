import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { HeartPulse, Loader2, NotebookPen, Pencil, Plus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

type PatientSummary = {
  _id: Id<"patients">;
  fullName: string;
  preferredName?: string;
  dateOfBirth?: string;
  room?: string;
  address?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  notes?: string;
  status: "active" | "inactive";
  vitalsCount: number;
  careEventCount: number;
  latestVitals?: {
    bp?: string;
    spo2?: number;
    pulse?: number;
    temperature?: string;
    timeLabel?: string;
  } | null;
  latestEvent?: {
    eventType: string;
    notes: string;
    timeLabel?: string;
  } | null;
};

type Form = {
  fullName: string;
  preferredName: string;
  dateOfBirth: string;
  room: string;
  address: string;
  primaryContactName: string;
  primaryContactPhone: string;
  notes: string;
  status: "active" | "inactive";
};

const emptyForm: Form = {
  fullName: "",
  preferredName: "",
  dateOfBirth: "",
  room: "",
  address: "",
  primaryContactName: "",
  primaryContactPhone: "",
  notes: "",
  status: "active",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function Patients() {
  const patients = useQuery(api.patients.patientSummaries) as PatientSummary[] | undefined;
  const createPatient = useMutation(api.patients.createPatient);
  const updatePatient = useMutation(api.patients.updatePatient);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PatientSummary | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(
    () => (patients ?? []).filter((patient) => patient.status === "active").length,
    [patients],
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (patient: PatientSummary) => {
    setEditing(patient);
    setForm({
      fullName: patient.fullName,
      preferredName: patient.preferredName ?? "",
      dateOfBirth: patient.dateOfBirth ?? "",
      room: patient.room ?? "",
      address: patient.address ?? "",
      primaryContactName: patient.primaryContactName ?? "",
      primaryContactPhone: patient.primaryContactPhone ?? "",
      notes: patient.notes ?? "",
      status: patient.status,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.fullName.trim()) {
      toast.error("Patient name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        preferredName: form.preferredName || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        room: form.room || undefined,
        address: form.address || undefined,
        primaryContactName: form.primaryContactName || undefined,
        primaryContactPhone: form.primaryContactPhone || undefined,
        notes: form.notes || undefined,
      };
      if (editing) {
        await updatePatient({ patientId: editing._id, ...payload, status: form.status });
        toast.success("Patient updated");
      } else {
        await createPatient(payload);
        toast.success("Patient added");
      }
      setOpen(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      role="admin"
      title="Patients"
      subtitle={`${activeCount} active ${activeCount === 1 ? "patient" : "patients"}`}
      actions={
        <Button onClick={openAdd} className="cursor-pointer">
          <Plus className="mr-2 size-4" /> Add patient
        </Button>
      }
    >
      {patients === undefined ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="mr-2 size-5 animate-spin text-muted-foreground" />
        </div>
      ) : patients.length === 0 ? (
        <Card className="card-layer border-border/70">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <UserRound className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No patients yet. Add the people receiving care to link vitals and care events.
            </p>
            <Button onClick={openAdd} className="cursor-pointer">
              <Plus className="mr-2 size-4" /> Add the first patient
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {patients.map((patient) => (
            <Card key={patient._id} className="card-layer border-border/70">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {initials(patient.fullName)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{patient.fullName}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {patient.preferredName ? `Prefers ${patient.preferredName}` : "Patient"}
                    </p>
                  </div>
                </div>
                <Badge variant={patient.status === "active" ? "secondary" : "outline"}>
                  {patient.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border/60 p-2">
                    <p className="text-muted-foreground">Room</p>
                    <p className="font-medium">{patient.room || "—"}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-2">
                    <p className="text-muted-foreground">Contact</p>
                    <p className="truncate font-medium">
                      {patient.primaryContactName || patient.primaryContactPhone || "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-muted-foreground">Vitals</p>
                    <p className="text-lg font-semibold">{patient.vitalsCount}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-muted-foreground">Care events</p>
                    <p className="text-lg font-semibold">{patient.careEventCount}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 p-2 text-xs">
                  <p className="text-muted-foreground">Latest vitals</p>
                  {patient.latestVitals ? (
                    <p className="mt-0.5 font-medium">
                      {[
                        patient.latestVitals.bp ? `BP ${patient.latestVitals.bp}` : null,
                        patient.latestVitals.spo2 != null
                          ? `SpO₂ ${patient.latestVitals.spo2}%`
                          : null,
                        patient.latestVitals.pulse != null
                          ? `PR ${patient.latestVitals.pulse}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Recorded"}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-muted-foreground">No readings yet</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm" className="cursor-pointer">
                    <Link to={`/vitals?patient=${patient._id}`}>
                      <HeartPulse className="mr-1.5 size-3.5" /> Vitals
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="cursor-pointer">
                    <Link to={`/care-log?patient=${patient._id}`}>
                      <NotebookPen className="mr-1.5 size-3.5" /> Care log
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(patient)}
                    className="ml-auto cursor-pointer"
                  >
                    <Pencil className="mr-1.5 size-3.5" /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit patient" : "Add patient"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Sir Shelly"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferredName">Preferred name</Label>
              <Input
                id="preferredName"
                value={form.preferredName}
                onChange={(e) => setForm({ ...form, preferredName: e.target.value })}
                placeholder="e.g. Shelly"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room">Room / location</Label>
              <Input
                id="room"
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                placeholder="e.g. Room 2"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Service address"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primaryContactName">Primary contact</Label>
              <Input
                id="primaryContactName"
                value={form.primaryContactName}
                onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}
                placeholder="Family member / guardian"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primaryContactPhone">Contact phone</Label>
              <Input
                id="primaryContactPhone"
                value={form.primaryContactPhone}
                onChange={(e) => setForm({ ...form, primaryContactPhone: e.target.value })}
                placeholder="+63…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Care notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Diagnosis, allergies, mobility, preferences…"
                rows={4}
              />
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as "active" | "inactive" })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? "Save changes" : "Add patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

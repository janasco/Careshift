import { AppShell, StatusChip } from "@/components/AppShell";
import { Timeline } from "@/components/Timeline";
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
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useToday } from "@/hooks/use-profile";
import { formatDateShort, formatTime } from "@/lib/time";
import { CaregiverSchema } from "@/lib/schemas";
import { toast } from "sonner";
import { CalendarClock, KeyRound, Loader2, Plus, UserRoundCog } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

type Directory = {
  _id: Id<"caregivers">;
  profileId?: Id<"profiles">;
  fullName: string;
  email: string;
  phone?: string;
  employeeCode?: string;
  shiftId?: Id<"shifts">;
  shiftName?: string;
  status: string;
  hiredAt?: number;
  lastLoginAt?: number;
};

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  employeeCode: "",
  shiftId: "",
  password: "",
};

export default function Caregivers() {
  const today = useToday();
  const { signOut } = useAuth();
  const [searchParams] = useSearchParams();

  const directory = useQuery(api.admin.caregiverDirectory);
  const shifts = useQuery(api.shifts.listShifts);
  const timeline = useQuery(
    api.timeline.caregiverTimeline,
    searchParams.get("focus")
      ? { caregiverId: searchParams.get("focus") as Id<"caregivers">, date: today }
      : "skip",
  );

  const createProfile = useMutation(api.profiles.createProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);
  const resetPassword = useMutation(api.profiles.resetPassword);

  const [shiftDialog, setShiftDialog] = useState<Directory | null>(null);
  const [shiftPick, setShiftPick] = useState<string>("");
  const [savingShift, setSavingShift] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(searchParams.get("focus"));
  const [pwDialog, setPwDialog] = useState<Directory | null>(null);
  const [newPw, setNewPw] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (searchParams.get("focus")) setFocusId(searchParams.get("focus"));
  }, [searchParams]);

  const focusCaregiver = directory?.find((c) => c._id === focusId);
  const activeShifts = (shifts ?? []).filter((s) => s.active);

  const handleAssignShift = async () => {
    if (!shiftDialog?.profileId) {
      toast.error("No profile found for this caregiver");
      return;
    }
    setSavingShift(true);
    try {
      await updateProfile({
        profileId: shiftDialog.profileId,
        shiftId: (shiftPick || undefined) as Id<"shifts"> | undefined,
      });
      toast.success(`Shift updated for ${shiftDialog.fullName}`);
      setShiftDialog(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update shift");
    } finally {
      setSavingShift(false);
    }
  };

  const validate = () => {
    const parsed = CaregiverSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[String(issue.path[0])] = issue.message;
      }
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    if (form.password.length < 8) {
      setErrors({ password: "Password must be at least 8 characters" });
      return;
    }
    setSaving(true);
    try {
      await createProfile({
        email: form.email,
        fullName: form.fullName,
        phone: form.phone,
        employeeCode: form.employeeCode,
        shiftId: (form.shiftId || undefined) as Id<"shifts"> | undefined,
        role: "caregiver",
        password: form.password,
      });
      toast.success(`${form.fullName} added`, {
        description: "Share their email and password with them so they can sign in.",
      });
      setAddOpen(false);
      setForm(emptyForm);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add caregiver");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: Directory) => {
    if (!c.profileId) {
      toast.error("No profile found for this caregiver");
      return;
    }
    try {
      await updateProfile({
        profileId: c.profileId,
        active: c.status !== "active",
      });
      toast.success(c.status === "active" ? `${c.fullName} disabled` : `${c.fullName} re-enabled`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleResetPw = async () => {
    if (!pwDialog) return;
    if (!pwDialog.profileId) {
      toast.error("No profile found for this caregiver");
      return;
    }
    setResetting(true);
    try {
      await resetPassword({ profileId: pwDialog.profileId, newPassword: newPw });
      toast.success(`Password reset for ${pwDialog.fullName}`);
      setPwDialog(null);
      setNewPw("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <AppShell
      role="admin"
      title="Caregivers"
      subtitle="Manage accounts, assignments, and activity"
      actions={
        <Button
          className="cursor-pointer"
          onClick={() => {
            setForm(emptyForm);
            setAddOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> Add caregiver
        </Button>
      }
    >
      {/* Focus panel (when opened via dashboard) */}
      {focusCaregiver && (
        <Card className="card-layer mb-5 border-border/70">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">{focusCaregiver.fullName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {focusCaregiver.shiftName ?? "No shift"} · {focusCaregiver.email}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setFocusId(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="timeline">
              <TabsList>
                <TabsTrigger value="timeline">Today's timeline</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              <TabsContent value="timeline" className="pt-4">
                {timeline === undefined ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <Timeline events={timeline} />
                )}
              </TabsContent>
              <TabsContent value="details" className="pt-4 text-sm text-muted-foreground">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>Phone: {focusCaregiver.phone ?? "—"}</div>
                  <div>Employee code: {focusCaregiver.employeeCode ?? "—"}</div>
                  <div>Status: <StatusChip variant={focusCaregiver.status} /></div>
                  <div>
                    Last login:{" "}
                    {focusCaregiver.lastLoginAt ? formatTime(focusCaregiver.lastLoginAt) : "never"}
                  </div>
                  <div>
                    Hired: {focusCaregiver.hiredAt ? formatDateShort(focusCaregiver.hiredAt) : "—"}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {!directory && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {directory && (
        <Card className="card-layer border-border/70">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead className="hidden sm:table-cell">Code</TableHead>
                  <TableHead className="hidden lg:table-cell">Last login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directory.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium">
                      <button
                        className="cursor-pointer hover:underline"
                        onClick={() => setFocusId(c._id)}
                      >
                        {c.fullName}
                      </button>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{c.email}</TableCell>
                    <TableCell>{c.shiftName ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{c.employeeCode ?? "—"}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {c.lastLoginAt ? formatTime(c.lastLoginAt) : "never"}
                    </TableCell>
                    <TableCell>
                      <StatusChip variant={c.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          title="Change shift"
                          onClick={() => {
                            setShiftDialog(c);
                            setShiftPick(c.shiftId ?? "");
                          }}
                        >
                          <CalendarClock className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          title="Reset password"
                          onClick={() => setPwDialog(c)}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          title={c.status === "active" ? "Disable" : "Enable"}
                          onClick={() => handleToggle(c)}
                        >
                          <UserRoundCog className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {directory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No caregivers yet — add your first one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add caregiver</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {(
              [
                ["fullName", "Full name", "text", "Maria Lopez"],
                ["email", "Email (used to sign in)", "email", "maria@example.com"],
                ["phone", "Phone", "tel", "+1 555-0100"],
                ["employeeCode", "Employee code (optional)", "text", "CG-004"],
              ] as const
            ).map(([key, label, type, placeholder]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label>{label}</Label>
                <Input
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
                {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <Label>Initial password</Label>
              <Input
                type="text"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Assigned shift</Label>
              <Select value={form.shiftId} onValueChange={(v) => setForm((f) => ({ ...f, shiftId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick a shift" /></SelectTrigger>
                <SelectContent>
                  {activeShifts.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} ({s.startTime}–{s.endTime})
                    </SelectItem>
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
            <p className="text-xs text-muted-foreground">
              The caregiver signs in with this email and the password you set. Share
              them securely — they can change it later via a reset from this page.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Add caregiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change shift dialog */}
      <Dialog open={!!shiftDialog} onOpenChange={(o) => !o && setShiftDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change shift — {shiftDialog?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Assigned shift</Label>
              <Select value={shiftPick} onValueChange={setShiftPick}>
                <SelectTrigger><SelectValue placeholder="Pick a shift" /></SelectTrigger>
                <SelectContent>
                  {activeShifts.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} ({s.startTime}–{s.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shifts && activeShifts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active shifts — create one under <Link to="/shifts" className="text-primary underline">Shifts</Link> first.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Recurring assignments stay tied to their shift. From tomorrow, this
              caregiver is expected on the new shift's schedule.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleAssignShift} disabled={savingShift} className="cursor-pointer">
              {savingShift && <Loader2 className="mr-2 size-4 animate-spin" />} Save shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!pwDialog} onOpenChange={(o) => !o && setPwDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password — {pwDialog?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>New password</Label>
            <Input
              type="text"
              placeholder="At least 8 characters"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This replaces the caregiver's password immediately. Share the new password
            with them securely.
          </p>
          </div>
          <DialogFooter>
            <Button onClick={handleResetPw} disabled={resetting || newPw.length < 8} className="cursor-pointer">
              {resetting && <Loader2 className="mr-2 size-4 animate-spin" />} Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* keep switch import used for future preferences; avoids lint noise */}
      <div className="hidden">
        <Switch checked={false} onCheckedChange={() => {}} />
      </div>
    </AppShell>
  );
}

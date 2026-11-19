import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, useMutation } from "@/lib/cf-api";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, DatabaseZap, KeyRound, ListChecks, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Settings() {
  const reset = useMutation(api.bootstrap.resetWorkspace);
  const seedTemplates = useMutation(api.bootstrap.seedStarterTemplates);
  const setupWorkspace = useMutation(api.bootstrap.starterWorkspace);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const changePassword = async () => {
    if (passwordForm.next.length < 8) {
      toast.error("The new password must be at least 8 characters.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error("The new passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
        revokeOtherSessions: true,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Could not change password");
      }
      toast.success("Password changed");
      setPasswordForm({ current: "", next: "", confirm: "" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change password",
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const runSeedTemplates = async () => {
    setBusy(true);
    try {
      const r = await seedTemplates({});
      toast.success(
        r.added > 0
          ? `Added ${r.added} starter task templates`
          : "All starter templates already exist",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add templates");
    } finally {
      setBusy(false);
    }
  };

  const runStarterWorkspace = async () => {
    setBusy(true);
    try {
      const result = await setupWorkspace({});
      toast.success("Starter workspace ready", {
        description: `${result.shifts} shifts · ${result.templates?.added ?? 0} new tasks · ${result.assignmentsCreated} assignments · ${result.caregiversAssigned} caregivers assigned`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set up workspace");
    } finally {
      setBusy(false);
    }
  };

  const runReset = async () => {
    setBusy(true);
    try {
      await reset({});
      await signOut();
      toast.success("Workspace reset", {
        description: "All data cleared. You'll be asked to set up the admin account again.",
      });
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
      setBusy(false);
    }
  };

  return (
    <AppShell role="admin" title="Settings" subtitle="Configure your workspace">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-layer border-border/70 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-muted-foreground" /> Change your password
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordForm.current}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, current: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.next}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, next: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirm: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-3">
              <Button
                onClick={changePassword}
                disabled={passwordBusy}
                className="cursor-pointer"
              >
                {passwordBusy && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Update password
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-layer border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseZap className="size-4 text-muted-foreground" /> Quick-start workspace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Creates the three standard shifts, adds the starter task library,
              assigns any caregivers without a shift, and creates patient-linked
              recurring tasks for each shift. Safe to run more than once.
            </p>
            <Button
              onClick={runStarterWorkspace}
              disabled={busy}
              className="mt-4 cursor-pointer"
            >
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <DatabaseZap className="mr-2 size-4" />
              )}
              Set up starter workspace
            </Button>
          </CardContent>
        </Card>

        <Card className="card-layer border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="size-4 text-muted-foreground" /> Starter task library
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Adds the standard set of 19 care tasks across Personal Care, Medication, Meals,
              Housekeeping, and Monitoring — ready to assign to shifts and caregivers. Tasks
              you already created are never duplicated or overwritten.
            </p>
            <Button onClick={runSeedTemplates} disabled={busy} className="mt-4 cursor-pointer">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ListChecks className="mr-2 size-4" />}
              Add starter task templates
            </Button>
          </CardContent>
        </Card>

        <Card className="card-layer border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-muted-foreground" /> How accounts work
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc space-y-1.5 pl-4">
              <li>
                You (the administrator) create caregiver accounts under{" "}
                <span className="font-medium text-foreground">Caregivers → Add caregiver</span>,
                choosing their email, initial password, and shift.
              </li>
              <li>Share the credentials securely; caregivers sign in at /auth and see only their own tasks.</li>
              <li>
                If a caregiver forgets their password, reset it from the key icon on their row —
                the change takes effect immediately.
              </li>
              <li>Every account change is recorded in the audit log.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="card-layer border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" /> Reset workspace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Permanently clears all caregivers, tasks, schedules, history, issues, and audit
              logs, and restores the three standard shifts. Your admin account is removed and
              you'll set it up again on the sign-in page. Use this to start fresh after
              evaluating the system with sample data.
            </p>
            {confirming ? (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="destructive"
                  onClick={runReset}
                  disabled={busy}
                  className="cursor-pointer"
                >
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <DatabaseZap className="mr-2 size-4" />}
                  Yes, erase everything
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy} className="cursor-pointer">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirming(true)}
                className="mt-4 cursor-pointer border-destructive/40 text-destructive hover:text-destructive"
              >
                <DatabaseZap className="mr-2 size-4" />
                Reset workspace…
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

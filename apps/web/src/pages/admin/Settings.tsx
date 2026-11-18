import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { AlertTriangle, DatabaseZap, ListChecks, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Settings() {
  const reset = useMutation(api.bootstrap.resetWorkspace);
  const seedTemplates = useMutation(api.bootstrap.seedStarterTemplates);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

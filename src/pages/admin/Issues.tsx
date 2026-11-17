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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { formatTime } from "@/lib/time";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import type { Id } from "@/convex/_generated/dataModel";

export default function Issues() {
  const openIssues = useQuery(api.admin.allIssues, { status: "open" });
  const resolvedIssues = useQuery(api.admin.allIssues, { status: "resolved" });
  const resolve = useMutation(api.issues.resolveIssue);

  const [resolving, setResolving] = useState<{ _id: Id<"issues">; taskName: string } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleResolve = async () => {
    if (!resolving) return;
    setSaving(true);
    try {
      await resolve({ issueId: resolving._id, note: note || undefined });
      toast.success("Issue marked resolved");
      setResolving(null);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve");
    } finally {
      setSaving(false);
    }
  };

  const IssueCard = ({
    issue,
    actions,
  }: {
    issue: {
      _id: Id<"issues">;
      issueType: string;
      description: string;
      createdAt: number;
      resolvedAt?: number;
      caregiverName: string;
      taskName: string;
      shiftName: string;
      taskDate?: string;
    };
    actions?: React.ReactNode;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="card-layer border-border/70">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-issue-bg text-issue">
              <AlertTriangle className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{issue.issueType}</span>
                <StatusChip variant={issue.resolvedAt ? "resolved" : "open"} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{issue.caregiverName}</span>
                <span>{issue.taskName}</span>
                <span>{issue.shiftName}</span>
                <span>{issue.taskDate}</span>
                <span>{formatTime(issue.createdAt)}</span>
              </div>
            </div>
            {actions}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <AppShell
      role="admin"
      title="Issues"
      subtitle="Reported by caregivers — resolve after review"
    >
      <Tabs defaultValue="open" className="gap-4">
        <TabsList>
          <TabsTrigger value="open" className="gap-1.5">
            <ShieldAlert className="size-4" /> Open
            {openIssues && openIssues.length > 0 && (
              <span className="ml-1 rounded-full bg-issue px-1.5 text-[10px] font-bold text-white">
                {openIssues.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1.5">
            <CheckCircle2 className="size-4" /> Resolved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="flex flex-col gap-3">
          {!openIssues && <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />}
          {openIssues && openIssues.length === 0 && (
            <Card className="card-layer border-dashed border-border/70">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <CheckCircle2 className="size-8 text-complete" />
                <p className="text-sm text-muted-foreground">No open issues — all clear.</p>
              </CardContent>
            </Card>
          )}
          {openIssues?.map((i) => (
            <IssueCard
              key={i._id}
              issue={i}
              actions={
                <Button
                  size="sm"
                  className="shrink-0 cursor-pointer"
                  onClick={() => setResolving({ _id: i._id, taskName: i.taskName })}
                >
                  Resolve
                </Button>
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="resolved" className="flex flex-col gap-3">
          {!resolvedIssues && <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />}
          {resolvedIssues && resolvedIssues.length === 0 && (
            <Card className="card-layer border-dashed border-border/70">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nothing resolved yet.
              </CardContent>
            </Card>
          )}
          {resolvedIssues?.map((i) => <IssueCard key={i._id} issue={i} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resolve issue — {resolving?.taskName}</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Optional resolution note (recorded in audit log)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleResolve} disabled={saving} className="cursor-pointer">
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Mark resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

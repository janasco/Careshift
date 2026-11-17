import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { formatTime } from "@/lib/time";
import { downloadCsv } from "@/lib/export";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Download, FileClock, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";

const ACTION_FILTERS = [
  { value: "", label: "All" },
  { value: "task.", label: "Tasks" },
  { value: "issue.", label: "Issues" },
  { value: "caregiver.", label: "Caregivers" },
  { value: "shift.", label: "Shifts" },
  { value: "assignment.", label: "Assignments" },
  { value: "system.", label: "System" },
];

function toneFor(action: string) {
  if (action.includes("completed")) return "bg-complete-bg text-complete";
  if (action.includes("issue") || action.includes("deactivated")) return "bg-issue-bg text-issue";
  if (action.includes("created") || action.includes("activated")) return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
}

export default function AuditLog() {
  const [action, setAction] = useState("");
  const logs = useQuery(api.audit.listAuditLogs, { action: action || undefined, limit: 300 });

  return (
    <AppShell
      role="admin"
      title="Audit Log"
      subtitle="Every important action, recorded with before/after values"
      actions={
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={() => {
            if (!logs || logs.length === 0) {
              toast.info("Nothing to export");
              return;
            }
            downloadCsv("audit-log.csv", [
              ["Time", "User", "Action", "Entity", "Old value", "New value"],
              ...logs.map((l) => [
                new Date(l.createdAt).toISOString(),
                l.actor,
                l.action,
                `${l.entityType} ${l.entityId ?? ""}`,
                l.oldValue ?? "",
                l.newValue ?? "",
              ]),
            ]);
            toast.success("Audit log exported");
          }}
        >
          <Download className="mr-1 size-4" /> Export CSV
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ACTION_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setAction(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
              action === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!logs && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {logs && (
        <Card className="card-layer border-border/70">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden lg:table-cell">Entity</TableHead>
                  <TableHead className="hidden xl:table-cell">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l._id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatTime(l.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{l.actor}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          toneFor(l.action),
                        )}
                      >
                        <FileClock className="size-3" />
                        {l.action}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-32 truncate text-muted-foreground lg:table-cell">
                      {l.entityType}
                    </TableCell>
                    <TableCell className="hidden max-w-72 truncate text-xs text-muted-foreground xl:table-cell">
                      {l.oldValue && <span className="line-through">{l.oldValue}</span>}
                      {l.oldValue && " → "}
                      {l.newValue}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      No audit entries for this filter yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

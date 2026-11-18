import { AppShell, StatusChip } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { api } from "@/lib/cf-api";
import { formatDateShort, formatTime } from "@/lib/time";
import { downloadCsv, printTable } from "@/lib/export";
import { toast } from "sonner";
import { Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@/lib/cf-api";
import type { Id } from "@/lib/cf-types";

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function History() {
  const [filters, setFilters] = useState({
    fromDate: daysAgoStr(30),
    toDate: daysAgoStr(0),
    caregiverId: "all",
    shiftId: "all",
    templateId: "all",
    status: "all",
  });

  const rows = useQuery(api.admin.historySearch, {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    caregiverId: filters.caregiverId === "all" ? undefined : (filters.caregiverId as Id<"caregivers">),
    shiftId: filters.shiftId === "all" ? undefined : (filters.shiftId as Id<"shifts">),
    templateId: filters.templateId === "all" ? undefined : (filters.templateId as Id<"taskTemplates">),
    status: filters.status === "all" ? undefined : filters.status,
  });

  const caregivers = useQuery(api.admin.caregiverDirectory);
  const shifts = useQuery(api.shifts.listShifts);
  const templates = useQuery(api.tasks.listTemplates);

  const statusVariant = (r: { status: string; overdue: boolean }) =>
    r.status === "completed" ? "completed" : r.overdue ? "overdue" : r.status === "completed_with_issue" ? "issue" : "pending";

  const exportRows = () =>
    (rows ?? []).map((r) => [
      r.date,
      r.caregiverName,
      r.shiftName,
      r.taskName,
      r.category,
      r.overdue ? "Overdue" : r.status,
      r.completedAt ? formatTime(r.completedAt) : "",
      r.scheduledTime,
      r.note ?? "",
    ]);

  const handleCsv = () => {
    if (!rows || rows.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    downloadCsv(
      `caregiver-history-${filters.fromDate}-to-${filters.toDate}.csv`,
      [
        ["Date", "Caregiver", "Shift", "Task", "Category", "Status", "Completed", "Scheduled", "Note"],
        ...exportRows(),
      ],
    );
    toast.success("CSV exported");
  };

  const handlePrint = () => {
    if (!rows || rows.length === 0) {
      toast.info("Nothing to print");
      return;
    }
    printTable(
      "Task History",
      `${filters.fromDate} to ${filters.toDate} · ${rows.length} records`,
      ["Date", "Caregiver", "Shift", "Task", "Status", "Completed"],
      exportRows().map((r) => [String(r[0]), String(r[1]), String(r[2]), String(r[3]), String(r[5]), String(r[6] ?? "—")]),
    );
  };

  return (
    <AppShell
      role="admin"
      title="History & Records"
      subtitle="Searchable, filterable task history — records are never deleted"
    >
      <Card className="card-layer mb-4 border-border/70">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
          <div className="flex flex-col gap-1.5">
            <Label>From</Label>
            <Input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>To</Label>
            <Input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Caregiver</Label>
            <Select value={filters.caregiverId} onValueChange={(v) => setFilters((f) => ({ ...f, caregiverId: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(caregivers ?? []).map((c) => (
                  <SelectItem key={c._id} value={c._id}>{c.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Shift</Label>
            <Select value={filters.shiftId} onValueChange={(v) => setFilters((f) => ({ ...f, shiftId: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(shifts ?? []).map((s) => (
                  <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Task</Label>
            <Select value={filters.templateId} onValueChange={(v) => setFilters((f) => ({ ...f, templateId: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {(templates ?? []).map((t) => (
                  <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="issue">With issue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={handleCsv}>
              <Download className="mr-1 size-4" /> CSV
            </Button>
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={handlePrint}>
              <Printer className="mr-1 size-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {!rows && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {rows && (
        <Card className="card-layer border-border/70">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Caregiver</TableHead>
                  <TableHead className="hidden md:table-cell">Shift</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="whitespace-nowrap">{formatDateShort(new Date(r.date + "T00:00:00").getTime())}</TableCell>
                    <TableCell className="font-medium">{r.caregiverName}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{r.shiftName}</TableCell>
                    <TableCell>{r.taskName}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{r.category}</TableCell>
                    <TableCell>
                      <StatusChip
                        variant={statusVariant(r)}
                        label={r.overdue ? "Overdue" : r.status === "completed" ? "Complete" : r.status === "completed_with_issue" ? "Issue" : "Pending"}
                      />
                      {r.note && <div className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">📝 {r.note}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.completedAt ? formatTime(r.completedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No records match these filters.
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

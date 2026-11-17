import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import { downloadCsv, printTable } from "@/lib/export";
import { formatDateShort } from "@/lib/time";
import { toast } from "sonner";
import { Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function RateBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <Progress value={rate} className="h-2" />
      <span className="w-10 text-right text-xs font-semibold tabular-nums">{rate}%</span>
    </div>
  );
}

export default function Reports() {
  const [fromDate, setFromDate] = useState(daysAgoStr(29));
  const [toDate, setToDate] = useState(daysAgoStr(0));
  const [caregiverId, setCaregiverId] = useState<string>("");

  const caregivers = useQuery(api.admin.caregiverDirectory);
  const daily = useQuery(api.reports.dailyReport, { date: toDate });
  const cgReport = useQuery(
    api.reports.caregiverReport,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caregiverId ? ({ caregiverId: caregiverId as Id<"caregivers">, fromDate, toDate } as any) : "skip" as any,
  );
  const shiftRep = useQuery(api.reports.shiftReport, { fromDate, toDate });

  const exportRangeCsv = () => {
    if (!shiftRep) return;
    downloadCsv(`shift-report-${fromDate}-to-${toDate}.csv`, [
      ["Shift", "Window", "Total", "Completed", "Pending", "Issues", "Completion %"],
      ...shiftRep.map((s) => [s.name, `${s.startTime}–${s.endTime}`, s.total, s.completed, s.pending, s.issues, s.rate]),
    ]);
    toast.success("Shift report exported");
  };

  return (
    <AppShell
      role="admin"
      title="Reports"
      subtitle="Daily, caregiver, and shift summaries with export"
    >
      <Tabs defaultValue="daily" className="gap-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="caregiver">Caregiver</TabsTrigger>
          <TabsTrigger value="shift">Shift</TabsTrigger>
        </TabsList>

        {/* Daily */}
        <TabsContent value="daily">
          {!daily ? (
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Assigned", daily.total],
                  ["Completed", daily.completed],
                  ["Pending", daily.pending],
                  ["Overdue", daily.overdue],
                  ["Issues", daily.issuesCount],
                  ["Completion", `${daily.completionRate}%`],
                ].map(([label, value]) => (
                  <Card key={String(label)} className="card-layer border-border/70">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold tabular-nums">{value}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="card-layer border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">By caregiver</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  {daily.byCaregiver.map((c) => (
                    <div key={c.caregiverId} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                      <span className="w-24 shrink-0 truncate text-sm font-medium">{c.name}</span>
                      <div className="flex-1"><RateBar rate={c.rate} /></div>
                      <span className="w-40 shrink-0 text-right text-xs text-muted-foreground">
                        {c.completed}/{c.total} done · {c.missed} missed · {c.issues} issues
                      </span>
                    </div>
                  ))}
                  {daily.byCaregiver.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">No data for this day.</p>
                  )}
                </CardContent>
              </Card>

              {daily.notes.length > 0 && (
                <Card className="card-layer border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Caregiver notes</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {daily.notes.map((n) => (
                      <div key={n.taskId} className="rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="font-medium">{n.caregiverName}</span> — {n.taskName}:{" "}
                        <span className="text-muted-foreground">"{n.note}"</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Caregiver */}
        <TabsContent value="caregiver">
          <Card className="card-layer mb-4 border-border/70">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Caregiver</Label>
                <Select value={caregiverId} onValueChange={setCaregiverId}>
                  <SelectTrigger><SelectValue placeholder="Pick a caregiver" /></SelectTrigger>
                  <SelectContent>
                    {(caregivers ?? []).map((c) => (
                      <SelectItem key={c._id} value={c._id}>{c.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>From</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>To</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {!caregiverId ? (
            <Card className="card-layer border-dashed border-border/70">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Pick a caregiver and date range to generate a report.
              </CardContent>
            </Card>
          ) : !cgReport ? (
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
          ) : (
            <Card className="card-layer border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {cgReport.caregiverName} · {formatDateShort(new Date(fromDate + "T00:00:00").getTime())} –{" "}
                  {formatDateShort(new Date(toDate + "T00:00:00").getTime())}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Total tasks", cgReport.total],
                  ["Completed", cgReport.completed],
                  ["Missed", cgReport.missed],
                  ["Issues reported", cgReport.issuesReported],
                  ["Avg min late", cgReport.avgMinutesLate],
                  ["Completion", `${cgReport.completionRate}%`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md bg-muted px-3 py-3 text-center">
                    <div className="text-xl font-bold tabular-nums">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Shift */}
        <TabsContent value="shift">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>From</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>To</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="cursor-pointer" onClick={exportRangeCsv}>
                <Download className="mr-1 size-4" /> CSV
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() =>
                  shiftRep &&
                  printTable(
                    "Shift Report",
                    `${fromDate} to ${toDate}`,
                    ["Shift", "Window", "Total", "Completed", "Pending", "Issues", "Rate %"],
                    shiftRep.map((s) => [s.name, `${s.startTime}–${s.endTime}`, String(s.total), String(s.completed), String(s.pending), String(s.issues), String(s.rate)]),
                  )
                }
              >
                <Printer className="mr-1 size-4" /> PDF
              </Button>
            </div>
          </div>

          {!shiftRep ? (
            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
          ) : (
            <Card className="card-layer border-border/70">
              <CardContent className="p-0">
                <div className="flex flex-col divide-y">
                  {shiftRep.map((s) => (
                    <div key={s.shiftId} className="flex flex-wrap items-center gap-4 px-4 py-3">
                      <div className="w-44 shrink-0">
                        <div className="text-sm font-semibold">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.startTime}–{s.endTime}</div>
                      </div>
                      <div className="min-w-40 flex-1"><RateBar rate={s.rate} /></div>
                      <span className="text-xs text-muted-foreground">
                        {s.completed}/{s.total} done · {s.pending} pending · {s.issues} issues
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

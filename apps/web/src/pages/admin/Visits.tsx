import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { api } from "@convex/_generated/api";
import { useToday } from "@/hooks/use-profile";
import { formatTime } from "@/lib/time";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { Id } from "@convex/_generated/dataModel";

type Visit = {
  _id: Id<"visits">;
  caregiverId: Id<"caregivers">;
  caregiverName: string;
  shiftName: string;
  date: string;
  clockInAt: number;
  clockInLat?: number;
  clockInLng?: number;
  clockInNotes?: string;
  clockOutAt?: number;
  clockOutLat?: number;
  clockOutLng?: number;
  clockOutNotes?: string;
  durationMs: number;
  status: "active" | "completed";
  hasClockInGps: boolean;
  hasClockOutGps: boolean;
};

type Caregiver = {
  _id: Id<"caregivers">;
  fullName: string;
  status: string;
};

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function mapsUrl(lat?: number, lng?: number) {
  if (lat == null || lng == null) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export default function Visits() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const visits = useQuery(api.visits.listVisits, { date }) as Visit[] | undefined;
  const caregivers = useQuery(api.admin.caregiverDirectory) as
    | Caregiver[]
    | undefined;

  const active = (visits ?? []).filter((visit) => visit.status === "active").length;
  const completed = (visits ?? []).filter((visit) => visit.status === "completed").length;

  const notStarted = useMemo(() => {
    const activeCaregivers = (caregivers ?? []).filter(
      (caregiver) => caregiver.status === "active",
    );
    return activeCaregivers.filter(
      (caregiver) =>
        !(visits ?? []).some((visit) => visit.caregiverId === caregiver._id),
    );
  }, [caregivers, visits]);

  const gpsMissing = (visits ?? []).filter(
    (visit) => !visit.hasClockInGps || (visit.status === "completed" && !visit.hasClockOutGps),
  ).length;

  return (
    <AppShell
      role="admin"
      title="Visits"
      subtitle="Clock-in / clock-out verification and GPS audit trail"
    >
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Visit date</p>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <Button variant="outline" onClick={() => setDate(today)} className="cursor-pointer">
          Today
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active now</p>
            <p className="mt-1 text-2xl font-semibold">{active}</p>
          </CardContent>
        </Card>
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-semibold">{completed}</p>
          </CardContent>
        </Card>
        <Card className="card-layer border-border/70">
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Not started</p>
            <p className="mt-1 text-2xl font-semibold">{notStarted.length}</p>
          </CardContent>
        </Card>
        <Card className={gpsMissing > 0 ? "border-pending/60" : "card-layer border-border/70"}>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Missing GPS</p>
            <p className="mt-1 text-2xl font-semibold">{gpsMissing}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-layer border-border/70">
        <CardContent className="pt-5">
          {visits === undefined ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading visits…
            </div>
          ) : visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Navigation className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No visits recorded on {date}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caregiver</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Clock in</TableHead>
                    <TableHead>Clock out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[220px]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((visit) => {
                    const inUrl = mapsUrl(visit.clockInLat, visit.clockInLng);
                    const outUrl = mapsUrl(visit.clockOutLat, visit.clockOutLng);
                    return (
                      <TableRow key={visit._id}>
                        <TableCell className="align-top text-sm font-medium">
                          {visit.caregiverName}
                        </TableCell>
                        <TableCell className="align-top text-xs">{visit.shiftName}</TableCell>
                        <TableCell className="align-top text-xs">
                          <div>{formatTime(visit.clockInAt)}</div>
                          {visit.clockInNotes && (
                            <div className="max-w-[180px] text-muted-foreground">
                              {visit.clockInNotes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-xs">
                          <div>
                            {visit.clockOutAt ? formatTime(visit.clockOutAt) : "—"}
                          </div>
                          {visit.clockOutNotes && (
                            <div className="max-w-[180px] text-muted-foreground">
                              {visit.clockOutNotes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-xs">
                          {visit.status === "active"
                            ? `${formatDuration(visit.durationMs)} (live)`
                            : formatDuration(visit.durationMs)}
                        </TableCell>
                        <TableCell className="align-top text-xs">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" />
                              {inUrl ? (
                                <a
                                  href={inUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline decoration-dotted"
                                >
                                  in
                                </a>
                              ) : (
                                <span className="text-muted-foreground">in —</span>
                              )}
                            </span>
                            {visit.status === "completed" && (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3" />
                                {outUrl ? (
                                  <a
                                    href={outUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline decoration-dotted"
                                  >
                                    out
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">out —</span>
                                )}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant={visit.status === "active" ? "secondary" : "outline"}>
                            {visit.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-xs text-muted-foreground">
                          {[visit.clockInNotes, visit.clockOutNotes].filter(Boolean).join(" · ") ||
                            "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {notStarted.length > 0 && (
        <Card className="card-layer mt-4 border-pending/40">
          <CardContent className="pt-5">
            <p className="text-sm font-medium">Caregivers without a visit on {date}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {notStarted.map((caregiver) => (
                <Badge key={caregiver._id} variant="outline">
                  {caregiver.fullName}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

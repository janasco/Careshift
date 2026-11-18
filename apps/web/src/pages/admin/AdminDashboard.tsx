import { AppShell, StatusChip } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useSlowClock, useProfile, useToday } from "@/hooks/use-profile";
import { useMaterializeDay } from "@/hooks/use-materialize-day";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { formatDateLong, formatTime, shiftRangeLabel } from "@/lib/time";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock,
  Loader2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

const STATUS_COLORS: Record<string, string> = {
  completed: "text-complete",
  working: "text-progress",
  pending: "text-pending",
  overdue: "text-issue",
  upcoming: "text-upcoming",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { profile, isLoading } = useProfile();
  const today = useToday();
  const now = useSlowClock();
  const navigate = useNavigate();

  const summary = useQuery(api.admin.dashboardSummary, { date: today });

  // Ensure today's recurring assignments exist for this date (idempotent).
  useMaterializeDay(today);

  if (isLoading || summary === undefined) {
    return (
      <AppShell role="admin" title="Dashboard">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const firstName = (profile?.fullName ?? user?.name ?? "there").split(" ")[0];

  const statCards = [
    {
      label: "Today's Tasks",
      value: summary.totalTasks,
      icon: ClipboardList,
      tone: "bg-accent text-accent-foreground",
      to: "/today",
    },
    {
      label: "Completed",
      value: summary.completed,
      icon: CheckCircle2,
      tone: "bg-complete-bg text-complete",
      to: "/history?status=completed",
    },
    {
      label: "Pending",
      value: summary.pending,
      icon: CircleDashed,
      tone: "bg-pending-bg text-pending",
      to: "/today",
    },
    {
      label: "Overdue",
      value: summary.overdue,
      icon: AlertTriangle,
      tone: "bg-issue-bg text-issue",
      to: "/history?status=overdue",
    },
    {
      label: "Issues",
      value: summary.issues,
      icon: ShieldAlert,
      tone: "bg-issue-bg text-issue",
      to: "/issues",
    },
  ];

  const chartData = summary.shiftBreakdown.map((s: { name: string; rate: number }) => ({
    name: s.name.replace(" Shift", ""),
    rate: s.rate,
  }));

  return (
    <AppShell
      role="admin"
      title={`Good ${new Date(now).getHours() < 12 ? "morning" : new Date(now).getHours() < 18 ? "afternoon" : "evening"}, ${firstName}`}
      subtitle={formatDateLong(now)}
      actions={
        <Button onClick={() => navigate("/today")} className="cursor-pointer">
          View today's schedule
        </Button>
      }
    >
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link to={c.to}>
              <Card className="card-layer h-full border-border/70 transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.tone}`}>
                    <c.icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-bold tabular-nums tracking-tight">{c.value}</div>
                    <div className="truncate text-xs font-medium text-muted-foreground">{c.label}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Live clock + completion ring */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="card-layer border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-muted-foreground" /> Right now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums tracking-tight">{formatTime(now)}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.totalCaregivers} active caregivers · {summary.templatesCount} task templates
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Progress value={summary.completionRate} className="h-2.5" />
              <span className="w-12 text-right text-sm font-semibold tabular-nums">
                {summary.completionRate}%
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Today's completion rate</p>
          </CardContent>
        </Card>

        {/* Caregiver status */}
        <Card className="card-layer border-border/70 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-muted-foreground" /> Caregivers
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {summary.caregiverStatus.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active caregivers yet. Add them under Caregivers.
              </p>
            )}
            {summary.caregiverStatus.map(
              (cg: {
                caregiverId: string;
                name: string;
                shiftName: string;
                shiftStart?: string;
                shiftEnd?: string;
                completed: number;
                total: number;
                overdue: number;
                liveStatus: string;
              }) => (
                <button
                  key={cg.caregiverId}
                  onClick={() => navigate(`/caregivers?focus=${cg.caregiverId}`)}
                  className="flex w-full items-center gap-3 py-3 text-left cursor-pointer first:pt-0 last:pb-0 hover:opacity-80"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{cg.name}</span>
                      <StatusChip variant={cg.liveStatus} />
                      {cg.overdue > 0 && (
                        <span className="text-xs font-semibold text-issue">{cg.overdue} overdue</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {cg.shiftName}
                      {cg.shiftStart && cg.shiftEnd && ` · ${shiftRangeLabel(cg.shiftStart, cg.shiftEnd)}`}
                    </div>
                  </div>
                  <div className="flex w-32 shrink-0 items-center gap-2">
                    <Progress value={cg.total ? (cg.completed / cg.total) * 100 : 0} className="h-2" />
                    <span className="w-10 text-right text-xs font-semibold tabular-nums">
                      {cg.completed}/{cg.total}
                    </span>
                  </div>
                </button>
              ),
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="card-layer border-border/70">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Completion by shift</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis unit="%" tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]} />
                <Tooltip cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="rate" radius={6} fill="var(--chart-1)" maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-layer border-border/70">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">Today's tasks by state</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Completed", value: summary.completed },
                  { name: "With issue", value: summary.withIssue },
                  { name: "Pending", value: summary.pending },
                  { name: "Overdue", value: summary.overdue },
                ]}
                layout="vertical"
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="value" radius={6} maxBarSize={22}>
                  <Cell fill="var(--chart-3)" />
                  <Cell fill="var(--chart-5)" />
                  <Cell fill="var(--chart-4)" />
                  <Cell fill="var(--chart-2)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

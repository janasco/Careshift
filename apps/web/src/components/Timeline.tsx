import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Moon,
  Play,
  AlertTriangle,
  Square,
  Circle,
} from "lucide-react";
import { motion } from "framer-motion";

type TimelineEvent = {
  time: number;
  label: string;
  kind: string;
  detail?: string;
};

const kindStyles: Record<string, { icon: React.ReactNode; ring: string }> = {
  shift_start: { icon: <Play className="size-3.5" />, ring: "bg-progress-bg text-progress" },
  task_done: { icon: <CheckCircle2 className="size-3.5" />, ring: "bg-complete-bg text-complete" },
  task_done_with_issue: { icon: <AlertTriangle className="size-3.5" />, ring: "bg-issue-bg text-issue" },
  issue_reported: { icon: <AlertTriangle className="size-3.5" />, ring: "bg-issue-bg text-issue" },
  shift_end: { icon: <Square className="size-3.5" />, ring: "bg-muted text-muted-foreground" },
  shift_planned: { icon: <Circle className="size-3.5" />, ring: "bg-muted text-muted-foreground" },
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity recorded for this day yet.
      </p>
    );
  }

  return (
    <ol className="relative ml-3 border-l">
      {events.map((e, i) => {
        const style = kindStyles[e.kind] ?? kindStyles.shift_planned;
        return (
          <motion.li
            key={`${e.time}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            className="relative flex gap-3 pb-5 pl-5 last:pb-0"
          >
            <span
              className={cn(
                "absolute -left-[13px] flex size-6 items-center justify-center rounded-full ring-4 ring-card",
                style.ring,
              )}
            >
              {style.icon}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {formatTime(e.time)}
                </span>
                <span className="text-sm font-medium">{e.label}</span>
              </div>
              {e.detail && (
                <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function MoonNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
      <Moon className="size-3.5 shrink-0" />
      {children}
    </div>
  );
}

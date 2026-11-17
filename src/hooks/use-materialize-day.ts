import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Ensures today's recurring assignments have been materialized into
 * scheduledTasks for the given date. Idempotent on the server (unique per
 * assignment|caregiver|date) and once-per-date on the client, so it is safe
 * to call on any authed page load (dashboard, checklist).
 */
export function useMaterializeDay(date: string | undefined) {
  const materialize = useMutation(api.assignments.materializeDay);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(new Set<string>());

  const run = useCallback(
    async (d: string) => {
      if (attempted.current.has(d)) return;
      attempted.current.add(d);
      setState("running");
      try {
        await materialize({ date: d });
        setState("done");
      } catch (e) {
        attempted.current.delete(d);
        setState("error");
        setError(e instanceof Error ? e.message : "Could not generate today's tasks");
      }
    },
    [materialize],
  );

  useEffect(() => {
    if (date) void run(date);
  }, [date, run]);

  return { state, error };
}

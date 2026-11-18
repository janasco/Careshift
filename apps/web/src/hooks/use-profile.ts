import { useEffect, useState } from "react";
import { dateStrFrom } from "@/lib/time";
import { api, useQuery } from "@/lib/cf-api";

/** Signed-in user's app profile (role, name, shift). */
export function useProfile() {
  const me = useQuery(api.profiles.me);
  return {
    isLoading: me === undefined,
    user: me?.user ?? null,
    profile: me?.profile ?? null,
    isAdmin: me?.profile?.role === "admin",
    isCaregiver: me?.profile?.role === "caregiver",
  };
}

/**
 * Live clock that ticks at the given interval (default 1s).
 *
 * IMPORTANT: every page re-renders whenever this updates, so only use the
 * fast 1s cadence inside small isolated components (e.g. <LiveClock />).
 * Pages should use `useSlowClock()` for status/date logic to avoid
 * re-rendering the whole tree every second — a major cause of sluggish
 * taps on low-end phones.
 */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Page-level "now": fresh enough for due/status logic, cheap to render. */
export function useSlowClock(intervalMs = 30000) {
  return useClock(intervalMs);
}

/** Today's date string ("YYYY-MM-DD"), refreshed every 30s. */
export function useToday() {
  const now = useClock(30000);
  return dateStrFrom(now);
}

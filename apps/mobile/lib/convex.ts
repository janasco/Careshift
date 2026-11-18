import { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export { api };
export type { Id };

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_CONVEX_URL. Add it to apps/mobile/.env.local — see .env.example.",
  );
}

export const convex = new ConvexReactClient(convexUrl);

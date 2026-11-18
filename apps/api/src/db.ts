import { drizzle } from "drizzle-orm/d1";
import { schema } from "@careshift/db";
import type { Bindings } from "./env";

export function getDb(env: Bindings) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;

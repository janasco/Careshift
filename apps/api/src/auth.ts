import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema } from "@careshift/db";
import { getDb } from "./db";
import type { Bindings } from "./env";

export function createAuth(env: Bindings) {
  const db = getDb(env);
  const extraOrigins = (env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: [
      env.WEB_ORIGIN,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "careshift://",
      "careshift-organizer://",
      "exp://**",
      ...extraOrigins,
    ],
    plugins: [expo()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "caregiver",
          input: false,
        },
      },
    },
  });
}

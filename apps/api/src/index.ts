import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import type { Bindings } from "./env";
import bootstrap from "./routes/bootstrap";
import patients from "./routes/patients";
import patientOptions from "./routes/patientOptions";
import vitals from "./routes/vitals";
import me from "./routes/me";
import caregivers from "./routes/caregivers";
import shifts from "./routes/shifts";
import careEvents from "./routes/careEvents";
import calendar from "./routes/calendar";
import push from "./routes/push";
import { runPushScheduler } from "./lib/push-scheduler";
import handoff from "./routes/handoff";
import medications from "./routes/medications";
import visits from "./routes/visits";
import tasks from "./routes/tasks";
import issues from "./routes/issues";
import reports from "./routes/reports";
import timeline from "./routes/timeline";
import profiles from "./routes/profiles";
import admin from "./routes/admin";
import { WorkspaceRoom } from "./realtime";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return origin;
      const extraOrigins = (c.env.TRUSTED_ORIGINS ?? "")
        .split(",")
        .map((allowed: string) => allowed.trim())
        .filter(Boolean);
      const allowed = [
        c.env.WEB_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        ...extraOrigins,
      ];
      return allowed.includes(origin) ? origin : null;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    credentials: true,
    maxAge: 600,
  }),
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "careshift-api",
    runtime: "cloudflare-workers",
  }),
);

// Better Auth's public sign-up endpoint is disabled unless explicitly enabled.
// The bootstrap and admin flows create users server-side.
app.post("/api/auth/sign-up/email", async (c) => {
  if (c.env.ALLOW_PUBLIC_SIGNUP === "true") {
    return createAuth(c.env).handler(c.req.raw);
  }
  return c.json(
    { error: "Public sign-up is disabled. Ask an administrator for an account." },
    403,
  );
});

app.route("/api/bootstrap", bootstrap);
app.route("/api/me", me);
app.route("/api/caregivers", caregivers);
app.route("/api/shifts", shifts);
app.route("/api/patients", patients);
app.route("/api/patient-options", patientOptions);
app.route("/api/vitals", vitals);
app.route("/api/care-events", careEvents);
app.route("/api/calendar", calendar);
app.route("/api/push", push);
app.route("/api/handoff", handoff);
app.route("/api/medications", medications);
app.route("/api/visits", visits);
app.route("/api/tasks", tasks);
app.route("/api/issues", issues);
app.route("/api/reports", reports);
app.route("/api/timeline", timeline);
app.route("/api/profiles", profiles);
app.route("/api/admin", admin);

app.get("/api/realtime", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }
  const workspace = c.req.query("workspace") ?? "default";
  const id = c.env.WORKSPACE_ROOM.idFromName(workspace);
  return c.env.WORKSPACE_ROOM.get(id).fetch(c.req.raw);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return createAuth(c.env).handler(c.req.raw);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((error, c) => {
  console.error("API error", error);
  return c.json(
    {
      error: error instanceof Error ? error.message : "Internal server error",
    },
    500,
  );
});

export { WorkspaceRoom };
export type AppType = typeof app;

export default {
  fetch: app.fetch,
  scheduled: async (controller: ScheduledController, env, ctx) => {
    console.log("Careshift cron", controller.cron);
    ctx.waitUntil(
      runPushScheduler(env).catch((error) => {
        console.error("Push scheduler failed", error);
      }),
    );
  },
} satisfies ExportedHandler<Bindings>;

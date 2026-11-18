import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth } from "./auth";
import type { Bindings } from "./env";
import bootstrap from "./routes/bootstrap";
import patients from "./routes/patients";
import vitals from "./routes/vitals";
import { WorkspaceRoom } from "./realtime";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return origin;
      const allowed = [
        c.env.WEB_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://10.0.0.243:5173",
        "http://10.0.0.2:5173",
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
app.route("/api/patients", patients);
app.route("/api/vitals", vitals);

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
  scheduled: async (controller: ScheduledController) => {
    console.log("Careshift cron", controller.cron);
    // Phase 2: materialize daily tasks, medication doses, and visit reminders.
  },
} satisfies ExportedHandler<Bindings>;

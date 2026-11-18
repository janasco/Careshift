import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  Smartphone,
  Users,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";
import logo from "@/assets/logo.svg";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

const features = [
  {
    icon: ClipboardCheck,
    title: "One-tap checklists",
    body: "Caregivers see their shift and today's tasks the moment they sign in. One tap confirms completion — timestamped, attributed, synced.",
  },
  {
    icon: Activity,
    title: "Live supervisor view",
    body: "The dashboard updates the moment a task is checked off. Completion rates, overdue alerts, and open issues at a glance.",
  },
  {
    icon: CalendarClock,
    title: "Shifts & recurring tasks",
    body: "Morning, afternoon, and overnight shifts with automatic day-rollover. Assign task templates by shift, caregiver, day, and time.",
  },
  {
    icon: WifiOff,
    title: "Offline-safe recording",
    body: "Weak signal in a client's home? Completions queue locally and sync automatically — nothing silently disappears.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based security",
    body: "Caregivers only ever see their own tasks. Admins get full oversight. Every important action lands in the audit log.",
  },
  {
    icon: BellRing,
    title: "Issues surfaced fast",
    body: "“Client refused”, “supplies unavailable”, emergencies — reported in seconds and shown prominently until resolved.",
  },
];

const roles = [
  {
    icon: Users,
    label: "For supervisors",
    points: ["Real-time caregiver status", "History with filters & exports", "Reports: daily, caregiver, shift"],
    href: "/auth?returnTo=%2Fdashboard",
    cta: "Open the dashboard",
  },
  {
    icon: Smartphone,
    label: "For caregivers",
    points: ["Today's checklist, zero menus", "Large tap targets", "Notes & issue reporting"],
    href: "/auth?returnTo=%2Fchecklist",
    cta: "Open my checklist",
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background"
    >
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Activity className="size-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">{APP_NAME}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#roles" className="transition-colors hover:text-foreground">For your team</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button size="sm" asChild className="cursor-pointer">
                <Link to="/dashboard">Dashboard <ArrowRight className="ml-1 size-3.5" /></Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild className="cursor-pointer">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button size="sm" asChild className="cursor-pointer">
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div {...fadeUp}>
              <Badge variant="secondary" className="mb-4 gap-1.5 px-3 py-1">
                <CheckCircle2 className="size-3.5 text-complete" />
                Caregiver operations, under control
              </Badge>
            </motion.div>
            <motion.h1
              {...fadeUp}
              transition={{ delay: 0.06 }}
              className="text-balance text-4xl font-bold tracking-tight sm:text-5xl"
            >
              Every task done.
              <span className="block text-primary">Every shift accounted for.</span>
            </motion.h1>
            <motion.p
              {...fadeUp}
              transition={{ delay: 0.12 }}
              className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              {APP_NAME} turns daily care checklists into a live operations view — caregivers
              check tasks off in one tap, supervisors watch progress in real time, and every
              record is kept for accountability.
            </motion.p>
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.18 }}
              className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button size="lg" asChild className="w-full cursor-pointer sm:w-auto">
                <Link to="/auth?returnTo=%2Fdashboard">
                  Sign in to your workspace <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full cursor-pointer sm:w-auto">
                <a href="#how">See how it works</a>
              </Button>
            </motion.div>
          </div>

          {/* Hero mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="relative mx-auto mt-14 max-w-3xl"
          >
            <div className="card-layer rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>TODAY'S OVERVIEW</span>
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 animate-pulse rounded-full bg-complete" /> live
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-3 text-center">
                    {[
                      ["24", "Tasks", "text-foreground"],
                      ["17", "Done", "text-complete"],
                      ["5", "Pending", "text-pending"],
                      ["2", "Issues", "text-issue"],
                    ].map(([n, l, tone]) => (
                      <div key={l} className="rounded-lg bg-muted/60 px-2 py-3">
                        <div className={`text-2xl font-bold tabular-nums ${tone}`}>{n}</div>
                        <div className="text-[11px] text-muted-foreground">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      ["Maria", "Morning", 8, 8, "bg-complete"],
                      ["Ana", "Afternoon", 5, 8, "bg-progress"],
                      ["Lisa", "Night", 0, 8, "bg-muted-foreground/30"],
                    ].map(([name, shift, done, total, color]) => (
                      <div key={name as string} className="flex items-center gap-3 text-sm">
                        <span className="w-12 font-medium">{name}</span>
                        <span className="w-20 text-xs text-muted-foreground">{shift}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${color}`}
                            style={{ width: `${((done as number) / (total as number)) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-semibold tabular-nums">
                          {done}/{total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Phone mock */}
                <div className="mx-auto w-44 rounded-[1.6rem] border border-border/70 bg-card p-2.5 shadow-sm">
                  <div className="rounded-[1.2rem] border border-border/50 p-3">
                    <div className="text-[10px] font-bold text-muted-foreground">MY SHIFT · MORNING</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-3/4 rounded-full bg-complete" />
                    </div>
                    <div className="mt-3 space-y-2">
                      {["Prepare breakfast", "Medication check", "Personal hygiene", "Room cleaning"].map((t, i) => (
                        <div key={t} className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5">
                          <div className={`flex size-5 items-center justify-center rounded-md border ${i < 2 ? "border-complete bg-complete text-white" : "border-border"}`}>
                            {i < 2 && <Check className="size-3" strokeWidth={3} />}
                          </div>
                          <span className={`text-[10px] font-medium ${i < 2 ? "text-muted-foreground line-through" : ""}`}>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-card/40 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4">
          <motion.h2 {...fadeUp} className="text-center text-3xl font-bold tracking-tight">
            Built for the floor, not the back office
          </motion.h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Caregivers get simplicity. Supervisors get visibility. Records stay intact.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ delay: i * 0.05 }}
                className="card-layer rounded-xl border border-border/70 bg-card p-5"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-3 text-base font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4">
          <motion.h2 {...fadeUp} className="text-center text-3xl font-bold tracking-tight">
            Two views. One system.
          </motion.h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {roles.map((r, i) => (
              <motion.div
                key={r.label}
                {...fadeUp}
                transition={{ delay: i * 0.08 }}
                className="card-layer flex flex-col rounded-xl border border-border/70 bg-card p-6"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <r.icon className="size-4" /> {r.label}
                </div>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-complete" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full cursor-pointer" asChild>
                  <Link to={r.href}>{r.cta} <ArrowRight className="ml-1 size-4" /></Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/60 bg-card/40 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4">
          <motion.h2 {...fadeUp} className="text-center text-3xl font-bold tracking-tight">
            How it works
          </motion.h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              ["1", "Admin sets up", "Create shifts, task templates, and recurring assignments."],
              ["2", "Caregiver signs in", "Sees only their shift and today's checklist."],
              ["3", "One tap to complete", "Exact time, caregiver, and task recorded server-side."],
              ["4", "Everything tracked", "Live dashboard, history, reports, and audit trail."],
            ].map(([n, title, body], i) => (
              <motion.div key={n} {...fadeUp} transition={{ delay: i * 0.06 }} className="relative">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {n}
                </div>
                <h3 className="mt-3 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4">
          <motion.div
            {...fadeUp}
            className="card-layer relative overflow-hidden rounded-2xl border border-border/70 bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12"
          >
            <div className="hero-grid absolute inset-0 opacity-20" aria-hidden />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight">Ready to see every shift clearly?</h2>
              <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">
                Sign in to monitor today's shifts — or open the caregiver view to see the
                1-tap checklist your team uses in the field.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" variant="secondary" asChild className="w-full cursor-pointer sm:w-auto">
                  <Link to="/auth?returnTo=%2Fdashboard">Supervisor sign-in</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="w-full cursor-pointer border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
                >
                  <Link to="/auth?returnTo=%2Fchecklist">Caregiver sign-in</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img src={logo} alt="" className="size-5 rounded bg-foreground" />
            {APP_NAME} — Caregiver Task & Shift Tracking
          </div>
          <p className="text-xs text-muted-foreground">
            Reliable for caregivers · Visible for supervisors · Records preserved
          </p>
        </div>
      </footer>
    </motion.div>
  );
}

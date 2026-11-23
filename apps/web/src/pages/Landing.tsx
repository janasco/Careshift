import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Pill,
  ShieldCheck,
  Smartphone,
  Users,
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
    icon: Pill,
    title: "Medication tracking",
    body: "Set up the complete medication schedule. One tap confirms a dose is given, and everyone in the family sees it instantly.",
  },
  {
    icon: CalendarClock,
    title: "Shared care calendar",
    body: "Doctor appointments, family visits, and reminders in one calendar. Every care team member sees the same plan.",
  },
  {
    icon: ClipboardCheck,
    title: "Task coordination",
    body: "Assign care tasks to family members or hired caregivers. Everyone knows what they are responsible for and when.",
  },
  {
    icon: BookOpen,
    title: "Care journal",
    body: "Log daily observations, health notes, and care updates. Build a running record any family member can reference.",
  },
  {
    icon: Users,
    title: "One connected team",
    body: "Whether you live next door or 400 miles away, everyone stays informed without WhatsApp groups or sticky notes.",
  },
  {
    icon: ShieldCheck,
    title: "Private and secure",
    body: "Role-based access keeps care notes inside the team. Every important action is timestamped and preserved.",
  },
];

const roles = [
  {
    icon: Users,
    label: "For organizers",
    points: [
      "Manage medications, appointments, and tasks",
      "Invite family members and caregivers",
      "Follow the care journal and daily reports",
    ],
    href: "/downloads/careshift-organizer.apk",
    cta: "Get the organizer app",
  },
  {
    icon: Smartphone,
    label: "For caregivers",
    points: [
      "See today's care plan, zero menus",
      "One-tap medication confirmation",
      "Add notes and report issues",
    ],
    href: "/downloads/careshift-caregiver.apk",
    cta: "Get the caregiver app",
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
            <a href="#apps" className="transition-colors hover:text-foreground">Get the apps</a>
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
                Your care team, in one place
              </Badge>
            </motion.div>
            <motion.h1
              {...fadeUp}
              transition={{ delay: 0.06 }}
              className="text-balance text-4xl font-bold tracking-tight sm:text-5xl"
            >
              Nobody misses a medication.
              <span className="block text-primary">Nobody feels left out.</span>
            </motion.h1>
            <motion.p
              {...fadeUp}
              transition={{ delay: 0.12 }}
              className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              {APP_NAME} brings your whole care team together — from daily medications to
              doctor appointments to care notes. Stop juggling group chats, sticky notes, and
              phone calls. One shared space keeps every family member informed.
            </motion.p>
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.18 }}
              className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button size="lg" asChild className="w-full cursor-pointer sm:w-auto">
                <a href="#apps">
                  Get the apps <ArrowRight className="ml-1.5 size-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full cursor-pointer sm:w-auto">
                <Link to="/auth?returnTo=%2Fdashboard">Open the organizer console</Link>
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
                    <span>TODAY'S CARE</span>
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 animate-pulse rounded-full bg-complete" /> live
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-3 text-center">
                    {[
                      ["6", "Meds", "text-foreground"],
                      ["4", "Given", "text-complete"],
                      ["2", "Due", "text-pending"],
                      ["1", "Note", "text-issue"],
                    ].map(([n, l, tone]) => (
                      <div key={l} className="rounded-lg bg-muted/60 px-2 py-3">
                        <div className={`text-2xl font-bold tabular-nums ${tone}`}>{n}</div>
                        <div className="text-[11px] text-muted-foreground">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      ["Mom", "Meds", 8, 8, "bg-complete"],
                      ["Dad", "Visits", 5, 8, "bg-progress"],
                      ["Ana", "Tasks", 0, 8, "bg-muted-foreground/30"],
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
                    <div className="text-[10px] font-bold text-muted-foreground">TODAY'S CARE</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-3/4 rounded-full bg-complete" />
                    </div>
                    <div className="mt-3 space-y-2">
                      {["Morning medications", "Doctor appointment", "Pick up prescription", "Blood pressure check"].map((t, i) => (
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
            Everything your family needs to coordinate care
          </motion.h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Medications, appointments, tasks, and notes — shared with the people who help.
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
            Two apps. One care team.
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
                  <a href={r.href} download>
                    {r.cta} <ArrowRight className="ml-1 size-4" />
                  </a>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Apps */}
      <section id="apps" className="border-t border-border/60 bg-card/40 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4">
          <motion.h2 {...fadeUp} className="text-center text-3xl font-bold tracking-tight">
            Get both apps
          </motion.h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            The organizer plans care. The caregiver carries it out. Both connect to the
            same shared workspace.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <motion.div
              {...fadeUp}
              className="card-layer flex flex-col rounded-xl border border-border/70 bg-card p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Users className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">CareShift Organizer</h3>
                  <p className="text-xs text-muted-foreground">For the family organizer</p>
                </div>
              </div>
              <ul className="mt-4 flex-1 space-y-2.5">
                {[
                  "Medications, appointments, and care tasks",
                  "Care team and care recipient profiles",
                  "Care journal, reports, and issue follow-up",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-complete" />
                    {point}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full cursor-pointer" asChild>
                <a href="/downloads/careshift-organizer.apk" download>
                  Download organizer APK <ArrowRight className="ml-1 size-4" />
                </a>
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Android · internal build · 34 MB
              </p>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ delay: 0.08 }}
              className="card-layer flex flex-col rounded-xl border border-border/70 bg-card p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">CareShift Caregiver</h3>
                  <p className="text-xs text-muted-foreground">For family and hired caregivers</p>
                </div>
              </div>
              <ul className="mt-4 flex-1 space-y-2.5">
                {[
                  "Today's checklist and one-tap confirmation",
                  "Medication doses, visits, and handoff notes",
                  "Task notes, issues, and device reminders",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-complete" />
                    {point}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full cursor-pointer" asChild>
                <a href="/downloads/careshift-caregiver.apk" download>
                  Download caregiver APK <ArrowRight className="ml-1 size-4" />
                </a>
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Android · internal build · 36 MB
              </p>
            </motion.div>
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
              ["1", "Add your loved one", "Create the care profile, medication schedule, and care notes."],
              ["2", "Invite the care team", "Family members and caregivers join the same workspace."],
              ["3", "Share the daily plan", "Meds, appointments, and tasks appear for everyone."],
              ["4", "Stay in sync", "One tap updates the team and builds the care journal."],
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
              <h2 className="text-3xl font-bold tracking-tight">Ready to bring your care team together?</h2>
              <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">
                Replace the chaos of group chats, sticky notes, and phone calls with one
                shared space for medications, appointments, tasks, and care notes.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" variant="secondary" asChild className="w-full cursor-pointer sm:w-auto">
                  <a href="/downloads/careshift-organizer.apk" download>
                    Download organizer app
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="w-full cursor-pointer border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 sm:w-auto"
                >
                  <a href="/downloads/careshift-caregiver.apk" download>
                    Download caregiver app
                  </a>
                </Button>
              </div>
              <p className="mt-4 text-sm text-primary-foreground/70">
                Already have an account?{" "}
                <Link to="/auth?returnTo=%2Fdashboard" className="underline underline-offset-4">
                  Open the organizer console
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img src={logo} alt="" className="size-5 rounded bg-foreground" />
            {APP_NAME} — Family Care Coordination
          </div>
          <p className="text-xs text-muted-foreground">
            Reliable for caregivers · Visible for families · Records preserved
          </p>
        </div>
      </footer>
    </motion.div>
  );
}

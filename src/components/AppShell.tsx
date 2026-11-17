import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { statusChip, STATUS_LABELS } from "@/lib/status";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileClock,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

export type Role = "admin" | "caregiver";

const adminNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/today", label: "Today's Schedule", icon: CalendarClock },
  { to: "/vitals", label: "Vital Signs", icon: HeartPulse },
  { to: "/caregivers", label: "Caregivers", icon: Users },
  { to: "/shifts", label: "Shifts", icon: ClipboardList },
  { to: "/tasks", label: "Task Templates", icon: ClipboardList },
  { to: "/assignments", label: "Assignments", icon: CalendarClock },
  { to: "/history", label: "History", icon: History },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/issues", label: "Issues", icon: ShieldAlert },
  { to: "/audit", label: "Audit Log", icon: FileClock },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({
  role,
  title,
  subtitle,
  actions,
  children,
}: {
  role: Role;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = role === "admin" ? adminNav : [];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = profile?.fullName ?? user?.name ?? "User";
  const initials = displayName
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4">
          <button
            className="mr-1 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden cursor-pointer"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Activity className="size-4" />
            </div>
            <span className="hidden text-sm font-bold tracking-tight sm:block">{APP_NAME}</span>
          </Link>

          <Badge variant="secondary" className="ml-1 hidden capitalize sm:inline-flex">
            {role}
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full cursor-pointer">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{displayName}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {user?.email ?? ""}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        {/* Desktop sidebar */}
        {role === "admin" && (
          <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r lg:block">
            <nav className="flex flex-col gap-1 p-3">
              {nav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer",
                      isActive && "bg-accent text-accent-foreground",
                    )
                  }
                >
                  <Icon className="size-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r bg-card p-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-sm font-bold">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "mt-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer",
                    isActive && "bg-accent text-accent-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
            <div className="mt-3 border-t pt-3">
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 size-4" /> Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusChip({
  variant,
  label,
  className,
}: {
  variant: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        statusChip(variant),
        className,
      )}
    >
      {label ?? STATUS_LABELS[variant] ?? variant}
    </span>
  );
}

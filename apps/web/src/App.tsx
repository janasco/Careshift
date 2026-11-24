import { RequireAuth } from "@/components/RequireAuth";
import { useProfile } from "@/hooks/use-profile";
import { Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";
import type { ComponentType, FC, ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";

import { NotFound } from "./pages/NotFound";

function lazyPage(loader: () => Promise<{ default: ComponentType }>): FC<Record<string, unknown>> {
  return lazy(loader) as unknown as FC<Record<string, unknown>>;
}

const Landing = lazyPage(() => import("./pages/Landing"));
const AuthPage = lazyPage(() => import("./pages/Auth"));
const Privacy = lazyPage(() => import("./pages/Privacy"));
const DataDeletion = lazyPage(() => import("./pages/DataDeletion"));
const AdminDashboard = lazyPage(() => import("./pages/admin/AdminDashboard"));
const TodaySchedule = lazyPage(() => import("./pages/admin/TodaySchedule"));
const VitalSigns = lazyPage(() => import("./pages/admin/VitalSigns"));
const Patients = lazyPage(() => import("./pages/admin/Patients"));
const CareLog = lazyPage(() => import("./pages/admin/CareLog"));
const Medications = lazyPage(() => import("./pages/admin/Medications"));
const Visits = lazyPage(() => import("./pages/admin/Visits"));
const Caregivers = lazyPage(() => import("./pages/admin/Caregivers"));
const Shifts = lazyPage(() => import("./pages/admin/Shifts"));
const TaskTemplates = lazyPage(() => import("./pages/admin/TaskTemplates"));
const Assignments = lazyPage(() => import("./pages/admin/Assignments"));
const History = lazyPage(() => import("./pages/admin/History"));
const Reports = lazyPage(() => import("./pages/admin/Reports"));
const Issues = lazyPage(() => import("./pages/admin/Issues"));
const AuditLog = lazyPage(() => import("./pages/admin/AuditLog"));
const Settings = lazyPage(() => import("./pages/admin/Settings"));
const CaregiverChecklist = lazyPage(() => import("./pages/CaregiverChecklist"));

/** Role gate: admins go to admin pages, caregivers only to /checklist. */
function RoleRoute({ role, children }: { role: "admin" | "caregiver"; children: ReactNode }) {
  const { profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/auth" replace />;
  }

  if (profile.role !== role) {
    // Wrong role: send them to their own home
    return <Navigate to={profile.role === "admin" ? "/dashboard" : "/checklist"} replace />;
  }

  return <>{children}</>;
}

/** Standard wrapper for admin pages: auth + role gate. */
function AdminPage({ children }: { children: ReactNode }) {
  return (
    <RequireAuth redirectImmediately>
      <RoleRoute role="admin">{children}</RoleRoute>
    </RequireAuth>
  );
}

export function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/data-deletion" element={<DataDeletion />} />

        {/* Caregiver */}
        <Route
          path="/checklist"
          element={
            <RequireAuth redirectImmediately>
              <RoleRoute role="caregiver">
                <CaregiverChecklist />
              </RoleRoute>
            </RequireAuth>
          }
        />

        {/* Admin */}
        <Route path="/dashboard" element={<AdminPage><AdminDashboard /></AdminPage>} />
        <Route path="/today" element={<AdminPage><TodaySchedule /></AdminPage>} />
        <Route path="/vitals" element={<AdminPage><VitalSigns /></AdminPage>} />
        <Route path="/patients" element={<AdminPage><Patients /></AdminPage>} />
        <Route path="/care-log" element={<AdminPage><CareLog /></AdminPage>} />
        <Route path="/medications" element={<AdminPage><Medications /></AdminPage>} />
        <Route path="/visits" element={<AdminPage><Visits /></AdminPage>} />
        <Route path="/caregivers" element={<AdminPage><Caregivers /></AdminPage>} />
        <Route path="/shifts" element={<AdminPage><Shifts /></AdminPage>} />
        <Route path="/tasks" element={<AdminPage><TaskTemplates /></AdminPage>} />
        <Route path="/assignments" element={<AdminPage><Assignments /></AdminPage>} />
        <Route path="/history" element={<AdminPage><History /></AdminPage>} />
        <Route path="/reports" element={<AdminPage><Reports /></AdminPage>} />
        <Route path="/issues" element={<AdminPage><Issues /></AdminPage>} />
        <Route path="/audit" element={<AdminPage><AuditLog /></AdminPage>} />
        <Route path="/settings" element={<AdminPage><Settings /></AdminPage>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

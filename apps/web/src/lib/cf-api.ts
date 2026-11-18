import {
  useMutation as useReactQueryMutation,
  useQuery as useReactQuery,
  useQueryClient,
} from "@tanstack/react-query";

type QueryToken = { __kind: "query"; key: string };
type MutationToken = { __kind: "mutation"; key: string };

const q = (key: string): QueryToken => ({ __kind: "query", key });
const m = (key: string): MutationToken => ({ __kind: "mutation", key });

// ── request helpers ───────────────────────────────────────────────────────

const API_BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? ""
).replace(/\/$/, "");

export { API_BASE };

function querystring(params?: Record<string, unknown>) {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "all") {
      continue;
    }
    search.set(key, String(value));
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

async function request<T = any>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed (${response.status})`);
  }
  return data as T;
}

/** Add Convex-style `_id` handles to API records so existing pages keep working. */
function normalize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = { ...record };
    if (record.id != null && out._id == null) out._id = record.id;
    for (const [key, child] of Object.entries(record)) {
      if (child && typeof child === "object") out[key] = normalize(child);
    }
    return out as T;
  }
  return value;
}

// ── query execution ───────────────────────────────────────────────────────

async function executeQuery(key: string, args: any): Promise<any> {
  switch (key) {
    case "bootstrap.workspaceStatus":
      return request("/api/bootstrap/status");

    case "profiles.me":
    case "users.currentUser": {
      const me = await request("/api/me");
      return key === "users.currentUser" ? me?.user ?? null : me;
    }

    case "admin.dashboardSummary":
      return request(`/api/admin/summary${querystring({ date: args?.date })}`);

    case "admin.caregiverDirectory":
      return request("/api/caregivers");

    case "admin.historySearch":
      return request(
        `/api/admin/history${querystring({
          fromDate: args?.fromDate,
          toDate: args?.toDate,
          caregiverId: args?.caregiverId,
          shiftId: args?.shiftId,
          templateId: args?.templateId,
          status: args?.status,
        })}`,
      );

    case "admin.allIssues":
      return request(`/api/issues${querystring({ status: args?.status })}`);

    case "audit.listAuditLogs":
      return request(
        `/api/admin/audit${querystring({
          action: args?.action,
          limit: args?.limit,
        })}`,
      );

    case "shifts.listShifts":
      return request("/api/shifts");

    case "tasks.listTemplates":
      return request("/api/tasks/templates");

    case "assignments.listAssignments":
      return request("/api/tasks/assignments");

    case "checklist.myTasksForDate":
      return request(
        `/api/tasks/checklist/my-tasks${querystring({ date: args?.date })}`,
      );

    case "checklist.adminTasksForDate":
      return request(`/api/tasks/admin${querystring({ date: args?.date })}`);

    case "visits.myVisitForDate":
      return request(`/api/visits/today${querystring({ date: args?.date })}`);

    case "visits.listVisits":
      return request(`/api/visits${querystring({ date: args?.date })}`);

    case "vitals.listVitalSigns":
      return request(
        `/api/vitals${querystring({ patientId: args?.patientId })}`,
      );

    case "patients.listPatients":
      return request("/api/patients");

    case "patients.patientSummaries":
      return request("/api/patients/summaries");

    case "careEvents.listCareEvents":
      return request(
        `/api/care-events${querystring({
          patientId: args?.patientId,
          caregiverId: args?.caregiverId,
          eventType: args?.eventType,
        })}`,
      );

    case "medications.listMedications":
      return request("/api/medications");

    case "medications.listMedicationDoses":
      return request(
        `/api/medications/doses${querystring({ date: args?.date })}`,
      );

    case "medications.medicationAdherence":
      return request(
        `/api/medications/adherence${querystring({
          fromDate: args?.fromDate,
          toDate: args?.toDate,
          nowDate: args?.nowDate,
          nowTime: args?.nowTime,
        })}`,
      );

    case "reports.dailyReport":
      return request(`/api/reports/daily${querystring({ date: args?.date })}`);

    case "reports.caregiverReport":
      return request(
        `/api/reports/caregiver${querystring({
          caregiverId: args?.caregiverId,
          fromDate: args?.fromDate,
          toDate: args?.toDate,
        })}`,
      );

    case "reports.shiftReport":
      return request(
        `/api/reports/shift${querystring({
          fromDate: args?.fromDate,
          toDate: args?.toDate,
        })}`,
      );

    case "reports.trendReport":
      return request(
        `/api/reports/trend${querystring({
          fromDate: args?.fromDate,
          toDate: args?.toDate,
        })}`,
      );

    case "timeline.caregiverTimeline":
      return request(
        `/api/timeline${querystring({
          caregiverId: args?.caregiverId,
          date: args?.date,
        })}`,
      );

    case "timeline.myTimeline":
      return request(`/api/timeline/me${querystring({ date: args?.date })}`);

    default:
      throw new Error(`Unsupported API query: ${key}`);
  }
}

// ── mutation execution ────────────────────────────────────────────────────

async function executeMutation(key: string, args: any): Promise<any> {
  const json = (body: unknown): RequestInit => ({
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });

  switch (key) {
    case "bootstrap.claimAdmin":
      return request("/api/bootstrap/admin", json(args));
    case "bootstrap.resetWorkspace":
      return request("/api/bootstrap/reset", json({}));
    case "bootstrap.seedStarterTemplates":
      return request("/api/bootstrap/seed-templates", json({}));

    case "profiles.createProfile":
      return request(
        "/api/caregivers",
        json({
          fullName: args.fullName,
          email: args.email,
          password: args.password,
          phone: args.phone,
          employeeCode: args.employeeCode,
          shiftId: args.shiftId,
        }),
      );

    case "profiles.updateProfile": {
      const { profileId, ...body } = args;
      return request(`/api/profiles/${profileId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    }

    case "profiles.resetPassword":
      return request(`/api/profiles/${args.profileId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: args.newPassword }),
      });

    case "profiles.touchLastLogin":
      return request("/api/profiles/touch", json({}));

    case "shifts.upsertShift": {
      const { id, ...body } = args;
      return request(id ? `/api/shifts/${id}` : "/api/shifts", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
    }

    case "shifts.setShiftActive":
      return request(`/api/shifts/${args.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: args.active }),
      });

    case "shifts.deleteShift":
      return request(`/api/shifts/${args.id}`, { method: "DELETE" });

    case "tasks.saveTemplate": {
      const { id, ...body } = args;
      return request(id ? `/api/tasks/templates/${id}` : "/api/tasks/templates", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
    }

    case "tasks.deactivateTemplate":
      return request(`/api/tasks/templates/${args.id}`, { method: "DELETE" });

    case "assignments.saveAssignment": {
      const { id, ...body } = args;
      return request(id ? `/api/tasks/assignments/${id}` : "/api/tasks/assignments", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
    }

    case "assignments.setAssignmentActive":
      return request(`/api/tasks/assignments/${args.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: args.active }),
      });

    case "assignments.materializeDay":
      return request("/api/tasks/materialize", json({ date: args.date }));

    case "checklist.completeTask":
      return request("/api/tasks/checklist/complete", json(args));

    case "checklist.addTaskNote":
      return request("/api/tasks/checklist/note", json(args));

    case "checklist.reportIssue":
      return request("/api/tasks/checklist/issue", json(args));

    case "checklist.createOneOffTask":
      return request("/api/tasks/one-off", json(args));

    case "issues.resolveIssue":
      return request(`/api/issues/${args.issueId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ note: args.note }),
      });

    case "patients.createPatient":
      return request("/api/patients", json(args));

    case "patients.updatePatient": {
      const { patientId, ...body } = args;
      return request(`/api/patients/${patientId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    }

    case "vitals.createVitalSign":
      return request("/api/vitals", json(args));

    case "vitals.updateVitalSign": {
      const { id, ...body } = args;
      return request(`/api/vitals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    }

    case "careEvents.createCareEvent":
      return request("/api/care-events", json(args));

    case "careEvents.updateCareEvent": {
      const { eventId, ...body } = args;
      return request(`/api/care-events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    }

    case "medications.createMedication":
      return request("/api/medications", json(args));

    case "medications.updateMedication": {
      const { medicationId, ...body } = args;
      return request(`/api/medications/${medicationId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    }

    case "medications.logDose":
      return request("/api/medications/doses/log", json(args));

    case "medications.clearDoseLog":
      return request("/api/medications/doses/clear", json(args));

    case "visits.clockIn":
      return request("/api/visits/clock-in", json(args));

    case "visits.clockOut":
      return request("/api/visits/clock-out", json(args));

    default:
      throw new Error(`Unsupported API mutation: ${key}`);
  }
}

// ── hooks ─────────────────────────────────────────────────────────────────

export function useQuery(token: QueryToken, args?: any): any {
  const skip = args === "skip";
  const query = useReactQuery({
    queryKey: ["cf", token.key, args],
    queryFn: () => executeQuery(token.key, args),
    enabled: !skip,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (skip) return undefined;
  return normalize(query.data as any);
}

export function useMutation(token: MutationToken) {
  const queryClient = useQueryClient();
  const mutation = useReactQueryMutation({
    mutationFn: (args?: any) => executeMutation(token.key, args),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  return (args?: any) => mutation.mutateAsync(args);
}

// ── API surface matching the old Convex function references ───────────────

export const api = {
  admin: {
    dashboardSummary: q("admin.dashboardSummary"),
    caregiverDirectory: q("admin.caregiverDirectory"),
    historySearch: q("admin.historySearch"),
    allIssues: q("admin.allIssues"),
  },
  assignments: {
    listAssignments: q("assignments.listAssignments"),
    saveAssignment: m("assignments.saveAssignment"),
    setAssignmentActive: m("assignments.setAssignmentActive"),
    materializeDay: m("assignments.materializeDay"),
  },
  audit: {
    listAuditLogs: q("audit.listAuditLogs"),
  },
  bootstrap: {
    workspaceStatus: q("bootstrap.workspaceStatus"),
    claimAdmin: m("bootstrap.claimAdmin"),
    resetWorkspace: m("bootstrap.resetWorkspace"),
    seedStarterTemplates: m("bootstrap.seedStarterTemplates"),
  },
  careEvents: {
    listCareEvents: q("careEvents.listCareEvents"),
    createCareEvent: m("careEvents.createCareEvent"),
    updateCareEvent: m("careEvents.updateCareEvent"),
  },
  checklist: {
    myTasksForDate: q("checklist.myTasksForDate"),
    adminTasksForDate: q("checklist.adminTasksForDate"),
    completeTask: m("checklist.completeTask"),
    addTaskNote: m("checklist.addTaskNote"),
    reportIssue: m("checklist.reportIssue"),
    createOneOffTask: m("checklist.createOneOffTask"),
  },
  issues: {
    resolveIssue: m("issues.resolveIssue"),
  },
  medications: {
    listMedications: q("medications.listMedications"),
    listMedicationDoses: q("medications.listMedicationDoses"),
    medicationAdherence: q("medications.medicationAdherence"),
    createMedication: m("medications.createMedication"),
    updateMedication: m("medications.updateMedication"),
    logDose: m("medications.logDose"),
    clearDoseLog: m("medications.clearDoseLog"),
  },
  patients: {
    listPatients: q("patients.listPatients"),
    patientSummaries: q("patients.patientSummaries"),
    createPatient: m("patients.createPatient"),
    updatePatient: m("patients.updatePatient"),
  },
  profiles: {
    me: q("profiles.me"),
    createProfile: m("profiles.createProfile"),
    updateProfile: m("profiles.updateProfile"),
    resetPassword: m("profiles.resetPassword"),
    touchLastLogin: m("profiles.touchLastLogin"),
  },
  reports: {
    dailyReport: q("reports.dailyReport"),
    caregiverReport: q("reports.caregiverReport"),
    shiftReport: q("reports.shiftReport"),
    trendReport: q("reports.trendReport"),
  },
  shifts: {
    listShifts: q("shifts.listShifts"),
    upsertShift: m("shifts.upsertShift"),
    setShiftActive: m("shifts.setShiftActive"),
    deleteShift: m("shifts.deleteShift"),
  },
  tasks: {
    listTemplates: q("tasks.listTemplates"),
    saveTemplate: m("tasks.saveTemplate"),
    deactivateTemplate: m("tasks.deactivateTemplate"),
  },
  timeline: {
    caregiverTimeline: q("timeline.caregiverTimeline"),
    myTimeline: q("timeline.myTimeline"),
  },
  users: {
    currentUser: q("users.currentUser"),
  },
  visits: {
    myVisitForDate: q("visits.myVisitForDate"),
    listVisits: q("visits.listVisits"),
    clockIn: m("visits.clockIn"),
    clockOut: m("visits.clockOut"),
  },
  vitals: {
    listVitalSigns: q("vitals.listVitalSigns"),
    createVitalSign: m("vitals.createVitalSign"),
    updateVitalSign: m("vitals.updateVitalSign"),
  },
};

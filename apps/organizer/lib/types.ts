export type CaregiverStatus =
  | "completed"
  | "working"
  | "pending"
  | "overdue"
  | "upcoming";

export type AdminSummary = {
  date: string;
  now: number;
  totalCaregivers: number;
  totalTasks: number;
  completed: number;
  withIssue: number;
  pending: number;
  overdue: number;
  issues: number;
  completionRate: number;
  templatesCount: number;
  caregiverStatus: Array<{
    caregiverId: string;
    name: string;
    shiftName: string;
    shiftStart?: string;
    shiftEnd?: string;
    completed: number;
    withIssue: number;
    pending: number;
    overdue: number;
    total: number;
    liveStatus: CaregiverStatus;
  }>;
  shiftBreakdown: Array<{
    shiftId: string;
    name: string;
    total: number;
    completed: number;
    rate: number;
  }>;
};

export type Caregiver = {
  id: string;
  profileId: string | null;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  shiftId: string | null;
  shiftName: string | null;
  status: string;
  hiredAt: number | null;
  lastLoginAt: number | null;
  active: boolean | null;
};

export type Patient = {
  id: string;
  fullName: string;
  preferredName: string | null;
  aliases: string[] | null;
  dateOfBirth: string | null;
  room: string | null;
  address: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  notes: string | null;
  status: string;
  createdAt: number;
};

export type PatientSummary = {
  id: string;
  fullName: string;
  preferredName: string | null;
  aliases: string[] | null;
  dateOfBirth: string | null;
  room: string | null;
  address: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  notes: string | null;
  status: string;
  createdAt: number;
  vitalsCount: number;
  careEventCount: number;
  latestVitals: VitalSign | null;
  latestEvent: CareEvent | null;
};

export type VitalSign = {
  id: string;
  patientId: string | null;
  patientName: string | null;
  caregiverId: string | null;
  caregiverName: string | null;
  bloodPressure: string | null;
  heartRate: number | null;
  temperature: number | null;
  oxygenSaturation: number | null;
  respiratoryRate: number | null;
  weight: number | null;
  bloodSugar: number | null;
  painLevel: number | null;
  notes: string | null;
  recordedAt: number | null;
  createdAt: number;
};

export type Medication = {
  id: string;
  patientId: string | null;
  patientName: string;
  name: string;
  dosage: string | null;
  route: string | null;
  frequency: string | null;
  times: string[];
  startDate: string | null;
  endDate: string | null;
  instructions: string | null;
  stock: number | null;
  refillThreshold: number | null;
  active: boolean;
  lowStock: boolean;
};

export type MedicationDoseRow = Medication & {
  doses: Array<{
    time: string;
    log: {
      id: string;
      status: string;
      takenAt: number | null;
      skipReason: string | null;
      caregiverName: string | null;
    } | null;
  }>;
};

export type CalendarEvent = {
  id: string;
  patientId: string | null;
  patientName: string | null;
  title: string;
  eventType: string;
  location: string | null;
  notes: string | null;
  startMs: number;
  endMs: number | null;
  allDay: boolean;
  createdByName: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CareEvent = {
  id: string;
  patientId: string | null;
  patientName: string | null;
  caregiverId: string | null;
  caregiverName: string | null;
  eventType: string;
  severity: string | null;
  occurredAt: number | null;
  timeLabel: string | null;
  notes: string;
  source: string | null;
  createdAt: number;
};

export type Task = {
  id: string;
  _id: string;
  caregiverId: string;
  caregiverName: string;
  taskName: string;
  taskDescription?: string | null;
  category: string;
  priority: string;
  required: boolean;
  shiftName: string;
  patientName: string;
  scheduledTime: string;
  dueMs: number;
  status: string;
  completedAt: number | null;
  note: string | null;
  issue: {
    _id: string;
    issueType: string;
    description: string;
    status: string;
    createdAt: number;
  } | null;
};

export type Issue = {
  id: string;
  scheduledTaskId: string | null;
  caregiverId: string | null;
  caregiverName: string | null;
  issueType: string;
  description: string;
  status: string;
  createdAt: number;
  resolvedAt: number | null;
  taskName: string | null;
  taskDate: string | null;
  shiftName: string | null;
};

export type DailyReport = {
  date: string;
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  issuesCount: number;
  completionRate: number;
  byCaregiver: Array<{
    caregiverId: string;
    name: string;
    total: number;
    completed: number;
    missed: number;
    issues: number;
    rate: number;
  }>;
  notes: Array<{
    taskId: string;
    caregiverName: string;
    taskName: string;
    note: string;
  }>;
};

export type PatientOption = {
  id: string;
  fullName: string;
  preferredName: string | null;
};

export type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  active: boolean;
};

export type Me = {
  user: { id: string; name: string; email: string };
  profile: {
    id: string;
    userId: string;
    role: string;
    fullName: string;
    phone: string | null;
    employeeCode: string | null;
    shiftId: string | null;
    active: boolean;
    lastLoginAt: number | null;
  } | null;
  shift: Shift | null;
};

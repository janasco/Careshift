export const CARE_EVENT_TYPES = [
  "Bowel movement",
  "Urine output",
  "Medication given",
  "Stoma/catheter care",
  "Pain",
  "Intake",
  "Position change",
  "Observation",
  "Other",
] as const;

export const CARE_EVENT_SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export type CareEventSeverity = (typeof CARE_EVENT_SEVERITIES)[number]["value"];

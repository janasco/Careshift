import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { formatTimeLabel, todayStr } from "@careshift/shared";

const TASK_IDS_KEY = "careshift.task-reminder-ids";
const MED_IDS_KEY = "careshift.med-reminder-ids";
const CHANNEL = "reminders";

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "CareShift reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0f766e",
      sound: "default",
    });
  }
}

export async function ensureRemindersPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function storedIds(key: string): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function cancelStored(key: string) {
  const ids = await storedIds(key);
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

async function saveIds(key: string, ids: string[]) {
  await SecureStore.setItemAsync(key, JSON.stringify(ids)).catch(() => undefined);
}

async function schedule(
  content: Notifications.NotificationContentInput,
  date: Date,
) {
  if (date.getTime() <= Date.now()) return null;
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      sound: "default",
      ...content,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: CHANNEL,
    },
  });
}

export async function syncTaskReminders(
  tasks: Array<{
    _id: string;
    taskName: string;
    patientName?: string;
    dueMs: number;
    status: string;
  }>,
) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await cancelStored(TASK_IDS_KEY);

  const ids: string[] = [];
  for (const task of tasks) {
    if (task.status !== "pending") continue;
    const when = new Date(task.dueMs - 10 * 60 * 1000);
    const id = await schedule(
      {
        title: "Task due soon",
        body: `${task.taskName}${task.patientName ? ` · ${task.patientName}` : ""}`,
        data: { url: "/checklist" },
      },
      when,
    );
    if (id) ids.push(id);
  }
  await saveIds(TASK_IDS_KEY, ids);
}

export async function syncMedicationReminders(
  rows: Array<{
    medication: {
      name: string;
      dosage?: string | null;
      patientName: string;
    };
    dose: {
      time: string;
      log: { status: string } | null;
    };
  }>,
) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await cancelStored(MED_IDS_KEY);

  const today = todayStr();
  const ids: string[] = [];
  for (const row of rows) {
    if (row.dose.log) continue;
    const when = new Date(`${today}T${row.dose.time}:00`);
    if (Number.isNaN(when.getTime())) continue;
    const id = await schedule(
      {
        title: "Medication due",
        body: `${row.medication.name}${
          row.medication.dosage ? ` ${row.medication.dosage}` : ""
        } · ${row.medication.patientName} · ${formatTimeLabel(row.dose.time)}`,
        data: { url: "/medications" },
      },
      when,
    );
    if (id) ids.push(id);
  }
  await saveIds(MED_IDS_KEY, ids);
}

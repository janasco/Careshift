import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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

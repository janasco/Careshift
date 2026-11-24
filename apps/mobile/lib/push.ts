import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiPost } from "./api";

let lastRegisteredToken: string | null = null;

export async function ensurePushPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function registerPushToken() {
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return false;

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    const value = typeof token.data === "string" ? token.data : null;
    if (!value) return false;
    if (value === lastRegisteredToken) return true;

    await apiPost("/api/push/tokens", {
      token: value,
      platform: Platform.OS,
    });
    lastRegisteredToken = value;
    return true;
  } catch (error) {
    console.warn("Push token registration failed", error);
    return false;
  }
}

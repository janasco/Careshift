import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

const configuredUrl = process.env.EXPO_PUBLIC_API_URL;

if (!configuredUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_API_URL. Add it to apps/mobile/.env.local — see .env.example.",
  );
}

export const API_URL = configuredUrl.replace(/\/$/, "");

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [
    expoClient({
      scheme: "careshift",
      storagePrefix: "careshift",
      storage: SecureStore,
    }),
  ],
});

export async function apiFetch<T = any>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const cookies = await authClient.getCookie();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
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

export function apiGet<T = any>(path: string) {
  return apiFetch<T>(path);
}

export function apiPost<T = any>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function apiPatch<T = any>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body ?? {}),
  });
}

import { inArray } from "drizzle-orm";
import { pushTokens } from "@careshift/db";
import type { Db } from "../db";
import type { Bindings } from "../env";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type PushResult = {
  configured: boolean;
  tokenCount: number;
  sent: number;
  failed: number;
  invalidTokens: string[];
};

let cachedAccessToken:
  | { token: string; expiresAt: number; clientEmail: string }
  | null = null;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlText(value: string) {
  return base64Url(new TextEncoder().encode(value));
}

function privateKeyBytes(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function serviceAccount(env: Bindings): ServiceAccount | null {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("Invalid FIREBASE_SERVICE_ACCOUNT", error);
    return null;
  }
}

async function accessToken(account: ServiceAccount) {
  if (
    cachedAccessToken &&
    cachedAccessToken.clientEmail === account.client_email &&
    Date.now() < cachedAccessToken.expiresAt - 60_000
  ) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlText(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Firebase OAuth failed (${response.status}): ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    clientEmail: account.client_email,
  };
  return data.access_token;
}

export async function sendPushToTokens(
  env: Bindings,
  tokens: string[],
  message: PushMessage,
): Promise<PushResult> {
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  const account = serviceAccount(env);
  if (!account || uniqueTokens.length === 0) {
    return {
      configured: Boolean(account),
      tokenCount: uniqueTokens.length,
      sent: 0,
      failed: 0,
      invalidTokens: [],
    };
  }

  let bearer: string;
  try {
    bearer = await accessToken(account);
  } catch (error) {
    console.error("Could not get Firebase access token", error);
    return {
      configured: true,
      tokenCount: uniqueTokens.length,
      sent: 0,
      failed: uniqueTokens.length,
      invalidTokens: [],
    };
  }

  const data = Object.fromEntries(
    Object.entries(message.data ?? {}).map(([key, value]) => [key, String(value)]),
  );
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
    account.project_id,
  )}/messages:send`;

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  await Promise.all(
    uniqueTokens.map(async (token) => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${bearer}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: message.title,
                body: message.body,
              },
              data,
              android: {
                priority: "high",
                notification: {
                  channelId: "reminders",
                  sound: "default",
                },
              },
            },
          }),
        });

        if (response.ok) {
          sent += 1;
          return;
        }

        failed += 1;
        const text = await response.text();
        if (
          response.status === 404 ||
          text.includes("UNREGISTERED") ||
          text.includes("INVALID_ARGUMENT")
        ) {
          invalidTokens.push(token);
        }
        console.error("FCM send failed", response.status, text.slice(0, 300));
      } catch (error) {
        failed += 1;
        console.error("FCM request failed", error);
      }
    }),
  );

  return {
    configured: true,
    tokenCount: uniqueTokens.length,
    sent,
    failed,
    invalidTokens,
  };
}

export async function sendPushToUsers(
  env: Bindings,
  db: Db,
  userIds: string[],
  message: PushMessage,
): Promise<PushResult> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return {
      configured: Boolean(serviceAccount(env)),
      tokenCount: 0,
      sent: 0,
      failed: 0,
      invalidTokens: [],
    };
  }

  const rows = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(inArray(pushTokens.userId, uniqueUserIds));

  const result = await sendPushToTokens(
    env,
    rows.map((row) => row.token),
    message,
  );

  if (result.invalidTokens.length > 0) {
    await db
      .delete(pushTokens)
      .where(inArray(pushTokens.token, result.invalidTokens));
  }

  return result;
}

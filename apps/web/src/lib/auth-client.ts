import { createAuthClient } from "better-auth/react";
import { API_BASE } from "./cf-api";

export const authClient = createAuthClient({
  baseURL: `${API_BASE || window.location.origin}/api/auth`,
});

export const { useSession, signIn, signOut } = authClient;

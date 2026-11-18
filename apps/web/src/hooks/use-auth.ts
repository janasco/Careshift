import { authClient, useSession } from "@/lib/auth-client";

type PasswordCredentials = {
  email: string;
  password: string;
  flow?: string;
};

export function useAuth() {
  const { data: session, isPending } = useSession();

  const signIn = async (
    provider: "password",
    credentials: PasswordCredentials,
  ) => {
    if (provider !== "password") {
      throw new Error("Only password sign-in is enabled");
    }
    const result = await authClient.signIn.email({
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    });
    if (result.error) {
      throw new Error(result.error.message ?? "Invalid email or password");
    }
    return result.data;
  };

  const signOut = async () => {
    await authClient.signOut();
  };

  return {
    isLoading: isPending,
    isAuthenticated: Boolean(session),
    user: session?.user ?? null,
    signIn,
    signOut,
  };
}

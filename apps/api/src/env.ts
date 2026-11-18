export type Bindings = {
  DB: D1Database;
  WORKSPACE_ROOM: DurableObjectNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  WEB_ORIGIN: string;
  TIMEZONE_OFFSET_MINUTES?: string;
  ALLOW_PUBLIC_SIGNUP?: string;
};

export type Variables = {
  session: {
    user: {
      id: string;
      email: string;
      name: string;
      role?: string | null;
    };
    session: {
      id: string;
      userId: string;
      expiresAt: Date;
    };
  };
  profile: {
    id: string;
    userId: string;
    role: string;
    fullName: string;
    active: boolean;
    shiftId: string | null;
  } | null;
};

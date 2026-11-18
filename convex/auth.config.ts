import type { AuthConfig } from "convex/server";

// Standard Convex Auth provider for this project's own sign-in. The deployment
// self-issues JWTs (iss = CONVEX_SITE_URL) validated via OIDC discovery at
// `${domain}/.well-known/openid-configuration`, served by auth.addHttpRoutes()
// in convex/http.ts.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;

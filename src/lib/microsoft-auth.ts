import type { NextRequest } from "next/server";

// Short-lived cookie holding the state, nonce and PKCE verifier between the
// redirect to Microsoft and the callback, so the callback can prove the
// response belongs to a sign-in this browser actually started.
export const OAUTH_COOKIE = "mirrorline_oauth";

export const SCOPES = "openid profile email";

export type MicrosoftConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
};

export function microsoftConfig(): { config: MicrosoftConfig } | { missing: string[] } {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const missing = [
    ["AZURE_AD_TENANT_ID", tenantId],
    ["AZURE_AD_CLIENT_ID", clientId],
    ["AZURE_AD_CLIENT_SECRET", clientSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name as string);
  if (missing.length > 0 || !tenantId || !clientId || !clientSecret) return { missing };
  return { config: { tenantId, clientId, clientSecret } };
}

export function authorityUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
}

// Must exactly match a redirect URI registered on the Entra app. Defaults to
// the origin the browser used, so localhost works in dev without extra config;
// set AZURE_AD_REDIRECT_URI when the app sits behind a proxy that changes it.
export function redirectUri(req: NextRequest): string {
  return process.env.AZURE_AD_REDIRECT_URI || `${req.nextUrl.origin}/api/auth/microsoft/callback`;
}

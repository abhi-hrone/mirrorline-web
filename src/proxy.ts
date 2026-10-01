import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

// The sign-in page and the Microsoft sign-in routes have to be reachable
// without a session. The reveal webhook is called by Ocean's servers, which
// have no session cookie; the route authenticates them itself with a signed
// token in the URL (see lib/webhook-auth.ts).
const PUBLIC_PATHS = [
  "/",
  "/api/auth/microsoft/login",
  "/api/auth/microsoft/callback",
  "/api/auth/logout",
  "/api/contacts/reveal-webhook",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  // Already signed in: skip the sign-in page.
  if (pathname === "/" && user) {
    return NextResponse.redirect(new URL("/campaigns", request.url));
  }

  if (PUBLIC_PATHS.includes(pathname) || user) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

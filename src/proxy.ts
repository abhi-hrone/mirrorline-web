import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Kept in sync with /api/auth/verify-key, which sets this cookie once the
// security key checks out. Direct navigation to any other route without it
// gets bounced back to the sign-in page instead of only relying on the
// button's client-side prompt, which a typed-in URL would otherwise skip.
export const SESSION_COOKIE = "mirrorline_session";

// The reveal webhook is called by Ocean's servers, which have no session
// cookie; the route authenticates them itself with a signed token in the URL
// (see lib/webhook-auth.ts).
const PUBLIC_PATHS = ["/", "/api/auth/verify-key", "/api/contacts/reveal-webhook"];

export function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.SECURITY_ACCESS_KEY;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (secret && token === secret) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

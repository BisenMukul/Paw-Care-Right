import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { authorizeAdminRequest } from "./src/admin/admin-auth";
import { parseAdminAuthConfig } from "./src/admin/admin-env";

/**
 * T111 D1: fail-closed HTTP Basic-auth gate for every `/admin*` request.
 * All real logic lives in pure, jest-testable functions under
 * `src/admin/` -- this file stays a thin delegator (jest `roots` is `src`
 * only, so this file itself is proven correct by `middleware-wiring.spec.ts`'s
 * static read plus `e2e/smoke.spec.ts`'s real, running-server assertion).
 * No cookie, no session, no sign-in page, no redirect -- basic-auth per
 * request is the whole mechanism. Never logs credentials.
 */
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const authConfig = parseAdminAuthConfig(process.env);
  const result = await authorizeAdminRequest(request.headers.get("authorization"), authConfig);

  if (result === "ok") {
    return NextResponse.next();
  }

  return new NextResponse(null, {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' },
  });
}

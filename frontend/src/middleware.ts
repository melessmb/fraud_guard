import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("fg_token")?.value;

  // Inject Authorization header from httpOnly cookie for all /api/v1/* requests
  if (pathname.startsWith("/api/v1/")) {
    if (token) {
      const headers = new Headers(request.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next();
  }

  // Skip Next.js internals, static files, and auth API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPortalLogin    = pathname === "/portal/login";
  const isPortalRoute    = pathname.startsWith("/portal");
  const isDashboardLogin = pathname === "/login";

  // ── Portal routes (/portal/*) ────────────────────────────────────────────
  if (isPortalRoute) {
    if (isPortalLogin) {
      // Already logged in → skip portal login
      if (token) return NextResponse.redirect(new URL("/portal", request.url));
      return NextResponse.next();
    }
    // Unauthenticated → portal login
    if (!token) {
      const url = new URL("/portal/login", request.url);
      if (pathname !== "/portal") url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Dashboard routes ─────────────────────────────────────────────────────
  if (isDashboardLogin) {
    if (token) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!token) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

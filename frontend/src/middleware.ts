import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const dashboardToken = request.cookies.get("fg_token")?.value;
  const portalToken    = request.cookies.get("fg_portal_token")?.value;

  // Inject Authorization header from the appropriate httpOnly cookie for /api/v1/* requests.
  // apiFetch sets X-Fg-Space: dashboard, portalFetch sets X-Fg-Space: portal.
  // This fallback only triggers when the Zustand store token is unavailable (e.g. SSR).
  if (pathname.startsWith("/api/v1/")) {
    const existingAuth = request.headers.get("Authorization");
    if (!existingAuth) {
      const space = request.headers.get("X-Fg-Space");
      const token = space === "portal" ? portalToken
                  : space === "dashboard" ? dashboardToken
                  : (portalToken ?? dashboardToken);
      if (token) {
        const headers = new Headers(request.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return NextResponse.next({ request: { headers } });
      }
    }
    return NextResponse.next();
  }

  // Skip Next.js internals, static files, and auth API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
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
      // Already logged in to portal → skip portal login
      if (portalToken) return NextResponse.redirect(new URL("/portal", request.url));
      return NextResponse.next();
    }
    // Unauthenticated portal user → portal login
    if (!portalToken) {
      const url = new URL("/portal/login", request.url);
      if (pathname !== "/portal") url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Dashboard routes ─────────────────────────────────────────────────────
  if (isDashboardLogin) {
    if (dashboardToken) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!dashboardToken) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

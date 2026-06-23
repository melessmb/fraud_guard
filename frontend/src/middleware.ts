import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("fg_token")?.value;

  // Inject Authorization header from httpOnly cookie for all /api/v1/* requests.
  // This runs before the rewrite proxies the request to the FastAPI backend,
  // so the backend always receives a proper Bearer token regardless of Zustand state.
  if (pathname.startsWith("/api/v1/")) {
    if (token) {
      const headers = new Headers(request.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next();
  }

  // Skip other Next.js internals and static files
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login";

  // Redirect unauthenticated users to /login
  if (!isLoginPage && !token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in → skip login page
  if (isLoginPage && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

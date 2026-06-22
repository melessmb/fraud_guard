import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

// localePrefix: "never" — locale detected from cookie/browser but never added to URLs
// This avoids /en/login 404s — all routes are always /login, /, /alertes, etc.
const intlMiddleware = createMiddleware({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "never",
});

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("fg_token")?.value;

  const isLoginPage = pathname === "/login";

  // Redirect unauthenticated users to /login
  if (!isLoginPage && !token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in and visiting /login → dashboard
  if (isLoginPage && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

const PUBLIC_PATHS = ["/login", "/en/login", "/fr/login"];

const intlMiddleware = createMiddleware({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
});

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("fg_token")?.value;

  // Auth check — redirect to login if no token
  const isPublic = PUBLIC_PATHS.some((p) => pathname.endsWith(p));
  if (!isPublic && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already logged in and visiting /login → redirect to dashboard
  if (isPublic && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

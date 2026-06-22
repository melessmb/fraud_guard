"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "fg_token";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 3600,
};

/** Decode JWT payload without verification (client-safe) */
export function decodeToken(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    const pad = part + "=".repeat((4 - (part.length % 4)) % 4);
    return JSON.parse(Buffer.from(pad, "base64url").toString("utf-8"));
  } catch {
    return {};
  }
}

/** Save token in httpOnly cookie */
export async function saveToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);
}

/** Read token from httpOnly cookie */
export async function getToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

/** Delete token cookie (logout) */
export async function clearToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Check token expiry */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  const exp = payload.exp as number | undefined;
  if (!exp) return true;
  return exp * 1000 < Date.now();
}

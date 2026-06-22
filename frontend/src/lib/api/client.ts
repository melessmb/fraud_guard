import createClient from "openapi-fetch";
import type { paths } from "@/types/api";

const API_BASE =
  typeof window !== "undefined"
    ? "" // browser → via Next.js rewrites proxy
    : process.env.API_URL || "http://localhost:8780";

export function createApiClient(token?: string) {
  return createClient<paths>({
    baseUrl: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Server-side client (uses token from cookie) */
export async function getServerClient() {
  const { getToken } = await import("@/lib/auth/session");
  const token = await getToken();
  return createApiClient(token ?? undefined);
}

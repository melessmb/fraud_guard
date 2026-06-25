import { usePortalAuthStore } from "@/lib/stores/portal-auth.store";

/**
 * Wrapper fetch pour les pages du portail client.
 * Injecte Authorization: Bearer depuis le store portal (isolé du dashboard).
 */
export function portalFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = usePortalAuthStore.getState().token;
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  // Identifies the origin space so the middleware can pick the right cookie fallback
  headers.set("X-Fg-Space", "portal");

  return fetch(input, { ...init, headers, credentials: "include" });
}

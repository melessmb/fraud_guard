import { useAuthStore } from "@/lib/stores/auth.store";

/**
 * Wrapper fetch qui injecte Authorization: Bearer depuis le store Zustand.
 * Utiliser à la place de fetch() dans toutes les pages dashboard.
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  // Identifies the origin space so the middleware can pick the right cookie fallback
  headers.set("X-Fg-Space", "dashboard");

  return fetch(input, { ...init, headers, credentials: "include" });
}

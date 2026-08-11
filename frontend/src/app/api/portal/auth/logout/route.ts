import { NextRequest, NextResponse } from "next/server";

const KEYCLOAK_URL  = process.env.KEYCLOAK_URL  || "http://localhost:8080";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || "fraudguard";
const CLIENT_ID     = "fraudguard-dashboard";

export async function POST(request: NextRequest) {
  let refreshToken: string | null = null;

  try {
    const body = await request.json();
    refreshToken = body.refresh_token ?? null;
  } catch { /* body vide — pas de refresh_token */ }

  // Révoquer la session Keycloak si on a le refresh_token
  if (refreshToken) {
    const logoutUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`;
    try {
      await fetch(logoutUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     CLIENT_ID,
          refresh_token: refreshToken,
        }),
      });
    } catch {
      // Keycloak inaccessible — on continue quand même (session locale effacée)
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("fg_portal_token", "", { maxAge: 0, path: "/", httpOnly: true, secure: true, sameSite: "lax" });
  return response;
}

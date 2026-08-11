import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("fg_token", "", { maxAge: 0, path: "/", httpOnly: true, secure: true, sameSite: "lax" });
  return response;
}

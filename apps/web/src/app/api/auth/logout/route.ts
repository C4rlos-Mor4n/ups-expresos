import { NextResponse, type NextRequest } from "next/server";
import { apiFetch, clearSession, readSession } from "@/lib/server/session";
import { forbidden, sameOrigin } from "@/lib/server/guards";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return forbidden();
  const { refreshToken } = await readSession();
  if (refreshToken) {
    await apiFetch("auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}

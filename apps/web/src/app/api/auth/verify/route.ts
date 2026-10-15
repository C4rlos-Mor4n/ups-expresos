import { NextResponse, type NextRequest } from "next/server";
import { apiPublic, saveSession } from "@/lib/server/session";
import { forbidden, relay, sameOrigin } from "@/lib/server/guards";

const PANEL_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return forbidden();
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; code?: unknown };
  if (typeof body.email !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ message: "Datos incompletos" }, { status: 400 });
  }
  const response = await apiPublic("auth/verify-code", { email: body.email.trim().toLowerCase(), code: body.code.trim() });
  if (!response.ok) return relay(response);
  const data = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
    user: { role: string; email: string; name: string | null };
  };
  if (!PANEL_ROLES.includes(data.user.role)) {
    // Cuenta válida pero sin permisos de panel: se cierra la sesión recién creada.
    await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3000"}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.accessToken}` },
      body: JSON.stringify({ refreshToken: data.refreshToken }),
    }).catch(() => undefined);
    return NextResponse.json({ message: "Esta cuenta no tiene acceso al panel administrativo." }, { status: 403 });
  }
  await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return NextResponse.json({ user: data.user });
}

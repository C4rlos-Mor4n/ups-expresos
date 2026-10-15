import { NextResponse, type NextRequest } from "next/server";
import { apiPublic } from "@/lib/server/session";
import { forbidden, relay, sameOrigin } from "@/lib/server/guards";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return forbidden();
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  if (typeof body.email !== "string") return NextResponse.json({ message: "Correo inválido" }, { status: 400 });
  const response = await apiPublic("auth/request-code", { email: body.email.trim().toLowerCase() });
  // El panel no muestra el código de desarrollo aunque la API lo exponga en pruebas.
  if (response.ok) return NextResponse.json({ sent: true });
  return relay(response);
}

import { NextResponse, type NextRequest } from "next/server";

/** Sin sesión → pantalla de ingreso. La verificación real del rol la hace la API en cada llamada. */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("upsgo_admin_rt");
  const { pathname } = request.nextUrl;
  if (!hasSession && pathname !== "/login") {
    return NextResponse.redirect(new URL("/panel/login", request.url));
  }
  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/panel", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!api|_next/static|_next/image|favicon.ico|icon.png|logo.png).*)"],
};

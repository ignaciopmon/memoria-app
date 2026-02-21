import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Se omite el middleware solo para archivos estáticos e imágenes.
  // Se ha quitado el "/api/" para que el token de sesión se refresque en llamadas API.
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.includes("/favicon.ico") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    return NextResponse.next(); 
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
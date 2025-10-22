import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for API routes, static files, images etc.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.includes("/favicon.ico") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    console.log("Middleware: Skipping", pathname); // Optional: for debugging
    return NextResponse.next(); // Let the request proceed without session handling
  }

  console.log("Middleware: Running updateSession for", pathname); // Optional: for debugging
  // For all other routes (pages), run the session update/redirect logic
  return await updateSession(request);
}

export const config = {
  // The matcher should still cover potentially protected pages AND API routes initially,
  // but the function logic above now specifically excludes API routes from session handling.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - fonts (self-hosted fonts)
     * - pdf.worker (pdfjs worker)
     * - files with extensions (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|fonts|pdf.worker|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|mjs)$).*)",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// wallet-first auth: middleware just passes through
// route protection is handled client-side via useAuth() hook
// (wallet state is in localStorage, not accessible in middleware)
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

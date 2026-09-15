import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("cf_session")?.value ||
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value;
  const { pathname } = request.nextUrl;

  if (token && (pathname === "/signIn" || pathname === "/signUp")) {
    const params = request.nextUrl.searchParams;

    if (params.get("switch") !== "1" && !params.get("error")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (!token && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/signUp", request.url));
  }

  if (!token && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/signIn?redirect=/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/signIn", "/signUp"],
};

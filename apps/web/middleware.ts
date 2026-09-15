import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("cf_session")?.value ||
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value;
  const { pathname } = request.nextUrl;

  if (token && (pathname === "/signIn" || pathname === "/signUp")) {
    if (request.nextUrl.searchParams.get("switch") !== "1") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (!token && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/signUp", request.url));
  }

  /* /admin has no sign-in of its own — admins use the ordinary one and come
   * back here, which is what lets a Google or GitHub account be an admin at
   * all. The `redirect` survives the OAuth round trip.
   *
   * This only checks that *a* session exists. Whether that session belongs to
   * an admin is decided in the admin layout, which can read the role; the
   * middleware cannot, because the role lives behind an API call and the JWT
   * is signed with a secret the web app does not hold. */
  if (!token && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/signIn?redirect=/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/signIn", "/signUp"],
};

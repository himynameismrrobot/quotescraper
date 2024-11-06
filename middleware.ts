import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    if (req.nextUrl.pathname.startsWith('/onboarding')) {
      return NextResponse.next();
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith('/auth')) {
          return true;
        }
        if (req.nextUrl.pathname.startsWith('/onboarding')) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
);

export const config = {
  matcher: [
    '/profile/:path*',
    '/admin/:path*',
    '/',
  ]
};
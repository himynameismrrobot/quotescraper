import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Export middleware directly without wrapping in withAuth
export default withAuth(
  function middleware(req) {
    console.log("🔐 Middleware executing for:", req.nextUrl.pathname);
    console.log("🔑 Token exists:", !!req.nextauth?.token);
    console.log("🎫 Full token data:", req.nextauth?.token);
    console.log("🔐 Request cookies:", req.cookies);
    
    // Allow all requests to proceed to the next middleware/handler
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        console.log("🎫 Authorization check for:", req.nextUrl.pathname);
        console.log("🎟️ Token:", token);
        console.log("🔐 Request cookies:", req.cookies);

        // Always allow access to auth-related routes
        if (req.nextUrl.pathname.startsWith('/auth')) {
          return true;
        }

        // Allow access to onboarding with a token
        if (req.nextUrl.pathname.startsWith('/onboarding')) {
          return true;
        }

        // Allow access to newsfeed only if user has a token
        if (req.nextUrl.pathname === '/newsfeed') {
          // Check for session token in cookies
          const hasSessionToken = req.cookies.has('next-auth.session-token');
          console.log("🔑 Newsfeed access check - Has session token:", hasSessionToken);
          return hasSessionToken;
        }

        // Allow access to root path
        if (req.nextUrl.pathname === '/') {
          return true;
        }

        // Require token for all other routes
        return !!token;
      },
    },
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
      signIn: '/auth/signin',
    },
  }
);

// Only protect specific routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth (authentication routes)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth).*)',
  ],
};
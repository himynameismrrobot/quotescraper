import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Export middleware directly without wrapping in withAuth
export default withAuth(
  function middleware(req) {
    console.log("🔐 Middleware executing for:", req.nextUrl.pathname);
    console.log("🔑 Token exists:", !!req.nextauth?.token);
    console.log("🎫 Full token data:", req.nextauth?.token);
    console.log("🔐 Request cookies:", req.cookies);
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        console.log("🎫 Authorization check for:", req.nextUrl.pathname);
        console.log("🎟️ Token:", token);
        console.log("🔐 Request cookies:", req.cookies);

        // For API routes, return 401 instead of redirecting
        if (req.nextUrl.pathname.startsWith('/api/')) {
          const hasSessionToken = req.cookies.has('next-auth.session-token');
          if (!hasSessionToken) {
            return false; // This will return 401 for API routes
          }
          return true;
        }

        // Always allow access to auth-related routes
        if (req.nextUrl.pathname.startsWith('/auth')) {
          return true;
        }

        // Allow access to onboarding with a token
        if (req.nextUrl.pathname.startsWith('/onboarding')) {
          return true;
        }

        // Check for session token in cookies for protected routes
        const hasSessionToken = req.cookies.has('next-auth.session-token');

        // Protected routes that require authentication
        if (
          req.nextUrl.pathname === '/newsfeed' || 
          req.nextUrl.pathname === '/profile' ||
          req.nextUrl.pathname === '/admin' ||
          req.nextUrl.pathname.startsWith('/admin/') ||
          req.nextUrl.pathname.match(/^\/quote\/[^/]+$/)
        ) {
          console.log("🔑 Protected route access check - Has session token:", hasSessionToken);
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes - handle these separately)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/api/:path*'  // Add this line to specifically handle API routes
  ],
};
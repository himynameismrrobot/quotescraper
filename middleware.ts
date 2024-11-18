import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/utils/supabase/database.types';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();

  try {
    // Create a Supabase client
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.delete({
              name,
              ...options,
            });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.delete({
              name,
              ...options,
            });
          },
        },
      }
    );

    // Refresh session if needed
    await supabase.auth.getSession();

    // Skip auth check for public routes
    if (request.nextUrl.pathname.startsWith('/auth')) {
      return response;
    }

    // Check auth status
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // If no session and not on auth page, redirect to login
    if (!session && !request.nextUrl.pathname.startsWith('/auth')) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Check for admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user?.user_metadata?.is_admin) {
        return NextResponse.redirect(new URL('/newsfeed', request.url))
      }
    }

  } catch (e) {
    console.error('Middleware error:', e);
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|auth/signin|auth/error).*)',
  ],
}
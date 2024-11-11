import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Database } from '@/utils/supabase/database.types'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next()

  try {
    // Create a Supabase client configured to use cookies
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            // If the cookie is updated, update the response
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            // If the cookie is removed, update the response
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.delete({ name, ...options })
          },
        },
      }
    )

    // Skip auth check for public routes
    if (request.nextUrl.pathname.startsWith('/auth')) {
      return response
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    // Check for admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
      const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser()
      if (verifyError || !verifiedUser?.user_metadata?.is_admin) {
        return NextResponse.redirect(new URL('/newsfeed', request.url))
      }
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|auth/signin|auth/error).*)',
  ],
}
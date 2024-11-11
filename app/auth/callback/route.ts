import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ 
        cookies: async () => {
          const cookieStore = cookies()
          return {
            get: async (name: string) => {
              const cookie = await cookieStore.get(name)
              return cookie?.value
            },
            set: (name: string, value: string, options: any) => {
              cookieStore.set(name, value, options)
            },
            remove: (name: string, options: any) => {
              cookieStore.delete(name, options)
            },
          }
        }
      })
      
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code)
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL('/newsfeed', request.url))
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }
} 
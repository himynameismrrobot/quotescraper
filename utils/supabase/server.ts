import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = cookieStore.get(name)
          return cookie?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options as any)
          } catch (error) {
            // Handle cookie errors
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete(name, options as any)
          } catch (error) {
            // Handle cookie errors
          }
        },
      },
    }
  )
} 
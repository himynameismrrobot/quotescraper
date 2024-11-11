import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = headers()
  
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
} 
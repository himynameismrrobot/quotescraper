import { AuthStateProvider } from '@/components/AuthStateProvider'
import '@/styles/globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthStateProvider>
          {children}
        </AuthStateProvider>
      </body>
    </html>
  )
} 
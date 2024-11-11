'use client'

import { Toaster } from './ui/toaster'

interface EchoLayoutProps {
  children: React.ReactNode
}

export default function EchoLayout({ children }: EchoLayoutProps) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}

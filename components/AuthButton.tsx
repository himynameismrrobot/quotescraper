'use client'

import { createClient } from '@/utils/supabase/client'

export default function AuthButton() {
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <button onClick={handleSignOut}>
      Sign Out
    </button>
  )
} 
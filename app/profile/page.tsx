import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/signin')
  }

  return (
    <div>
      <h1>Profile</h1>
      <p>Email: {user.email}</p>
    </div>
  )
} 
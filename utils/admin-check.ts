import { createClient } from '@/utils/supabase/server'

export async function checkAdminAccess() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Unauthorized', status: 401 }
  }

  if (!user.user_metadata?.is_admin) {
    return { error: 'Forbidden', status: 403 }
  }

  return { user }
} 
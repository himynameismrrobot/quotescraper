import { useAuth } from '@/components/AuthStateProvider';
import { useSupabase } from '@/lib/providers/supabase-provider';

export function useSession() {
  const { user, loading } = useAuth();
  const { supabase } = useSupabase();

  return {
    session: user ? {
      access_token: user.access_token,
      user,
    } : null,
    loading,
    error: null,
  };
}

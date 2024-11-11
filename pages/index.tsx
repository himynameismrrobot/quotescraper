import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/AuthStateProvider';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/newsfeed');
      } else {
        router.push('/auth/signin');
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading) {
    return <div>Loading...</div>;
  }

  return null;
}
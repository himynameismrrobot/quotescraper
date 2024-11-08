import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
      return;
    }

    if (session?.user && !session.user.username) {
      router.replace('/onboarding');
      return;
    }

    router.replace('/newsfeed');
  }, [status, session, router]);

  // Show loading state while checking session
  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  // Don't render anything while redirecting
  return null;
}
'use client'

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/AuthStateProvider';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        router.push('/auth/signin');
        return;
      }

      try {
        console.log('Checking admin status for user:', user.id);
        const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();

        console.log('Admin check response:', { user: verifiedUser, error });

        if (error || !verifiedUser?.user_metadata?.is_admin) {
          console.error('Error checking admin status:', error);
          router.push('/newsfeed');
          return;
        }

        console.log('User is admin, setting state');
        setIsAdmin(true);
      } catch (error) {
        console.error('Error in admin check:', error);
        router.push('/newsfeed');
      }
    };

    if (!loading) {
      checkAdminStatus();
    }
  }, [user, loading, router]);

  // Show loading state
  if (loading || isAdmin === null) {
    return (
      <div className="flex h-screen bg-gray-100">
        <div className="m-auto">
          <div className="text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render anything if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-md">
        <nav className="mt-5">
          <Link href="/admin#organizations" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">
            Organizations
          </Link>
          <Link href="/admin#speakers" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">
            Speakers
          </Link>
          <Link href="/admin#urls" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">
            Monitored URLs
          </Link>
          <Link href="/admin#new-quotes" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">
            New Quotes
          </Link>
          <Link href="/admin#saved-quotes" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">
            Saved Quotes
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;

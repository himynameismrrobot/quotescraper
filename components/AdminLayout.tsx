import React from 'react';
import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
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

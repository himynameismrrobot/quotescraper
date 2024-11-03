import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from "./ui/button";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const currentHash = router.asPath.split('#')[1] || 'organizations';

  const navItems = [
    { name: 'Organizations', hash: 'organizations' },
    { name: 'Speakers', hash: 'speakers' },
    { name: 'URLs', hash: 'urls' },
    { name: 'New Quotes', hash: 'new-quotes' },
    { name: 'Saved Quotes', hash: 'saved-quotes' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-md">
        <nav className="mt-5">
          <ul>
            {navItems.map((item) => (
              <li key={item.hash} className="mb-2">
                <Button
                  variant={currentHash === item.hash ? "default" : "ghost"}
                  className="w-full justify-start"
                  asChild
                >
                  <Link href={`/admin#${item.hash}`}>
                    {item.name}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4">
        {children}
      </main>
    </div>
  );
};

export default Layout;

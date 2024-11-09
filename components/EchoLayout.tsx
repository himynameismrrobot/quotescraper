import React from 'react';
import Link from 'next/link';
import { Home, Search, User } from 'lucide-react';
import { Toaster } from "./ui/toaster";

interface EchoLayoutProps {
  children: React.ReactNode;
}

const EchoLayout: React.FC<EchoLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-4 pb-20 overflow-y-auto">
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-md">
        <div className="flex justify-around items-center h-16">
          <Link href="/" className="flex flex-col items-center text-gray-600">
            <Home size={24} />
            <span className="text-xs">Home</span>
          </Link>
          <Link href="/search" className="flex flex-col items-center text-gray-600">
            <Search size={24} />
            <span className="text-xs">Search</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center text-gray-600">
            <User size={24} />
            <span className="text-xs">Profile</span>
          </Link>
        </div>
      </nav>
      <Toaster />
    </div>
  );
};

export default EchoLayout;

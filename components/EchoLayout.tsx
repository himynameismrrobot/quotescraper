import React from 'react';
import { Toaster } from "./ui/toaster";

interface EchoLayoutProps {
  children: React.ReactNode;
}

const EchoLayout: React.FC<EchoLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {children}
      </main>
      <Toaster />
    </div>
  );
};

export default EchoLayout;

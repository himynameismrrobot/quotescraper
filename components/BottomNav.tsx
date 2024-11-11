'use client'

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Home, Search, User } from "lucide-react";

export default function BottomNav() {
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-t border-white/10">
      <div className="max-w-2xl mx-auto px-4 py-2 flex justify-around">
        <Button 
          variant="ghost" 
          size="lg"
          onClick={() => router.push('/newsfeed')}
          className="text-gray-300 hover:text-white hover:bg-white/10"
        >
          <Home className="h-6 w-6" />
        </Button>
        <Button 
          variant="ghost" 
          size="lg"
          onClick={() => router.push('/search')}
          className="text-gray-300 hover:text-white hover:bg-white/10"
        >
          <Search className="h-6 w-6" />
        </Button>
        <Button 
          variant="ghost" 
          size="lg"
          onClick={() => router.push('/profile')}
          className="text-gray-300 hover:text-white hover:bg-white/10"
        >
          <User className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
} 
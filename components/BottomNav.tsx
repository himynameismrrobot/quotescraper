import { useRouter } from "next/router";
import { Button } from "./ui/button";
import { Home, Search, User } from "lucide-react";

const BottomNav = () => {
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950/70 backdrop-blur-md border-t border-white/5 p-2 flex justify-around items-center z-0">
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-12 h-12 text-white hover:text-white hover:bg-white/10"
        onClick={() => router.push('/newsfeed')}
      >
        <Home className="h-6 w-6" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-12 h-12 text-white hover:text-white hover:bg-white/10"
        onClick={() => router.push('/search')}
      >
        <Search className="h-6 w-6" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="w-12 h-12 text-white hover:text-white hover:bg-white/10"
        onClick={() => router.push('/profile')}
      >
        <User className="h-6 w-6" />
      </Button>
    </nav>
  );
};

export default BottomNav; 
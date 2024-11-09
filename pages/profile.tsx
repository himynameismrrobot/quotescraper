import { useSession, signOut } from "next-auth/react";
import EchoLayout from "../components/EchoLayout";
import BottomNav from '../components/BottomNav';
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { LogOut } from "lucide-react";

const ProfilePage = () => {
  const { data: session } = useSession();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <EchoLayout>
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4 ring-2 ring-white/20">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback className="bg-white/10 text-white text-2xl">
                    {session?.user?.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {session?.user?.name}
                </h2>
                <p className="text-gray-400 mb-1">
                  {session?.user?.username || session?.user?.email?.split('@')[0]}
                </p>
                <p className="text-gray-300 mb-6">
                  {session?.user?.email}
                </p>
                <Button 
                  variant="ghost" 
                  onClick={handleSignOut}
                  className="text-gray-300 hover:text-white hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <BottomNav />
      </EchoLayout>
    </div>
  );
};

export default ProfilePage; 
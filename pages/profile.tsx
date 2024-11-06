import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import EchoLayout from "@/components/EchoLayout";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  return (
    <EchoLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={session?.user?.image || ''} />
            <AvatarFallback>{session?.user?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{session?.user?.name}</h1>
            <p className="text-gray-600">@{session?.user?.username}</p>
          </div>
        </div>

        <div className="pt-6">
          <Button 
            variant="destructive"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </EchoLayout>
  );
} 
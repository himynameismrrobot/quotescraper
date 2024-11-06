import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignIn() {
  const handleSignIn = async () => {
    console.log("🎯 Starting sign in process");
    await signIn('google', { 
      redirect: true
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-8 text-center">Welcome to Echo</h1>
        <Button 
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            {/* ... SVG paths ... */}
          </svg>
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
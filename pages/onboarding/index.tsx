import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import OnboardingFollowSuggestions from '@/components/OnboardingFollowSuggestions';

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    image: '',
  });

  useEffect(() => {
    console.log("Session status:", status, session);
    if (status === "unauthenticated") {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (status !== 'authenticated' || !session?.user?.email) {
      console.error('No session available');
      return;
    }
    
    try {
      console.log('Submitting form data:', formData);
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          email: session.user.email,
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save user data');
      }

      setStep(2);
    } catch (error) {
      console.error('Error saving user data:', error);
      alert(error instanceof Error ? error.message : 'Failed to save user data');
    }
  };

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  return (
    <div className="container max-w-2xl mx-auto py-8">
      {step === 1 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <h1 className="text-2xl font-bold">Complete Your Profile</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Profile Photo</label>
              <Avatar className="w-20 h-20">
                <AvatarImage src={formData.image} />
                <AvatarFallback>{formData.name?.[0]}</AvatarFallback>
              </Avatar>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                placeholder="Choose a unique username"
              />
            </div>
          </div>

          <Button type="submit">Continue</Button>
        </form>
      )}

      {step === 2 && <OnboardingFollowSuggestions />}
    </div>
  );
}
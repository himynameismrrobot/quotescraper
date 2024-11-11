import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import OnboardingFollowSuggestions from '@/components/OnboardingFollowSuggestions';
import { useAuth } from '@/components/AuthStateProvider';

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    image: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.user_metadata.name || '',
        username: '',
        image: user.user_metadata.avatar_url || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.email) {
      console.error('No user available');
      return;
    }
    
    try {
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: user.email,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save user data');
      }

      setStep(2);
    } catch (error) {
      console.error('Error saving user data:', error);
      alert(error instanceof Error ? error.message : 'Failed to save user data');
    }
  };

  if (loading) {
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
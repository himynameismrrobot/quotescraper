import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useSession } from 'next-auth/react';

interface Organization {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface Speaker {
  id: string;
  name: string;
  imageUrl: string | null;
  organization: Organization | null;
}

export default function OnboardingFollowSuggestions() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<'organizations' | 'speakers'>('organizations');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch organizations
    fetch('/api/organizations')
      .then(res => res.json())
      .then(data => setOrganizations(data))
      .catch(err => console.error('Error fetching organizations:', err));

    // Fetch speakers
    fetch('/api/speakers')
      .then(res => res.json())
      .then(data => setSpeakers(data))
      .catch(err => console.error('Error fetching speakers:', err));
  }, []);

  const handleFollow = async () => {
    if (!session) return;
    
    setIsSubmitting(true);
    try {
      // Save follows
      const response = await fetch('/api/user/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizations: Array.from(selectedOrgs),
          speakers: Array.from(selectedSpeakers),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save follows');
      }

      // Use replace instead of push to prevent back button from returning to onboarding
      await router.replace('/newsfeed');
    } catch (error) {
      console.error('Error saving follows:', error);
      alert('Failed to save follows. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'organizations') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Follow Organizations</h2>
          <p className="text-muted-foreground">Select organizations you want to follow</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {organizations.map((org) => (
            <Card key={org.id} className="p-4">
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage src={org.logoUrl || ''} alt={org.name} />
                  <AvatarFallback>{org.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{org.name}</div>
                </div>
                <Checkbox
                  checked={selectedOrgs.has(org.id)}
                  onCheckedChange={(checked) => {
                    const newSelected = new Set(selectedOrgs);
                    if (checked) {
                      newSelected.add(org.id);
                    } else {
                      newSelected.delete(org.id);
                    }
                    setSelectedOrgs(newSelected);
                  }}
                />
              </div>
            </Card>
          ))}
        </div>

        <Button 
          onClick={() => setStep('speakers')} 
          className="w-full"
          disabled={isSubmitting}
        >
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Follow Speakers</h2>
        <p className="text-muted-foreground">Select speakers you want to follow</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {speakers.map((speaker) => (
          <Card key={speaker.id} className="p-4">
            <div className="flex items-center space-x-4">
              <Avatar>
                <AvatarImage src={speaker.imageUrl || ''} alt={speaker.name} />
                <AvatarFallback>{speaker.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{speaker.name}</div>
                {speaker.organization && (
                  <div className="text-sm text-muted-foreground">
                    {speaker.organization.name}
                  </div>
                )}
              </div>
              <Checkbox
                checked={selectedSpeakers.has(speaker.id)}
                onCheckedChange={(checked) => {
                  const newSelected = new Set(selectedSpeakers);
                  if (checked) {
                    newSelected.add(speaker.id);
                  } else {
                    newSelected.delete(speaker.id);
                  }
                  setSelectedSpeakers(newSelected);
                }}
              />
            </div>
          </Card>
        ))}
      </div>

      <div className="flex space-x-4">
        <Button 
          variant="outline" 
          onClick={() => setStep('organizations')}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button 
          onClick={handleFollow} 
          className="flex-1"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Finish"}
        </Button>
      </div>
    </div>
  );
} 
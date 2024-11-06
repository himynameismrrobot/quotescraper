import React, { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import EchoLayout from '../components/EchoLayout';
import QuoteCard from '../components/QuoteCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

interface Quote {
  id: string;
  summary: string;
  rawQuoteText?: string;
  speakerName: string;
  speakerImage?: string;
  organizationLogo?: string;
  articleDate: string;
}

const NewsfeedPage: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeTab, setActiveTab] = useState("everyone");
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    console.log("Session status in newsfeed:", status, session);
    
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated" && !session.user.username) {
      router.push("/onboarding");
      return;
    }

    if (status === "authenticated") {
      fetchQuotes();
    }
  }, [status, session, router]);

  const fetchQuotes = async () => {
    try {
      const response = await fetch('/api/quotes');
      if (!response.ok) {
        throw new Error('Failed to fetch quotes');
      }
      const data = await response.json();
      setQuotes(data);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  };

  // Show loading state while checking authentication
  if (status === "loading") {
    return <div>Loading...</div>;
  }

  // Don't render anything while redirecting
  if (status === "unauthenticated" || (session?.user && !session.user.username)) {
    return null;
  }

  return (
    <EchoLayout>
      <div className="fixed top-0 left-0 right-0 bg-white z-10 px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold mb-4">Newsfeed</h1>
        <Tabs defaultValue="everyone">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="everyone" onClick={() => setActiveTab("everyone")}>Everyone</TabsTrigger>
            <TabsTrigger value="following" onClick={() => setActiveTab("following")}>Following</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="container mx-auto pt-32">
        <Tabs defaultValue="everyone">
          <TabsContent value="everyone">
            {quotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                id={quote.id}
                summary={quote.summary}
                speakerName={quote.speakerName}
                speakerImage={quote.speakerImage}
                organizationLogo={quote.organizationLogo}
                articleDate={quote.articleDate}
                likes={0}
                comments={0}
              />
            ))}
          </TabsContent>
          <TabsContent value="following">
            <p>You're not following anyone yet. Follow speakers to see their quotes here!</p>
          </TabsContent>
        </Tabs>
      </div>
    </EchoLayout>
  );
};

export default NewsfeedPage;

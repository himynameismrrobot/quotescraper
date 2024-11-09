import React, { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import EchoLayout from '../components/EchoLayout';
import QuoteCard from '../components/QuoteCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Home, Search, User } from "lucide-react";

interface Quote {
  id: string;
  summary: string;
  rawQuoteText?: string;
  speakerName: string;
  speakerImage?: string;
  organizationLogo?: string;
  articleDate: string;
  reactions?: {
    emoji: string;
    users: { id: string }[];
  }[];
  comments: number;
}

const NewsfeedPage = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const router = useRouter();

  const fetchQuotes = async (tab: string) => {
    try {
      const response = await fetch(`/api/quotes?tab=${tab}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quotes');
      }
      const data = await response.json();
      setQuotes(data);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  };

  useEffect(() => {
    fetchQuotes(activeTab);
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const renderQuotes = (quotes: Quote[]) => (
    <div className="space-y-4">
      {quotes.map((quote) => (
        <QuoteCard
          key={quote.id}
          id={quote.id}
          summary={quote.summary}
          speakerName={quote.speakerName}
          speakerImage={quote.speakerImage}
          organizationLogo={quote.organizationLogo}
          articleDate={quote.articleDate}
          comments={quote.comments}
          reactions={quote.reactions}
        />
      ))}
    </div>
  );

  return (
    <EchoLayout>
      <div className="container mx-auto px-4 pb-16">
        <Tabs defaultValue={activeTab} className="w-full" onValueChange={handleTabChange}>
          <div className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-sm z-10">
            <div className="container mx-auto px-4 py-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="following">Following</TabsTrigger>
              </TabsList>
            </div>
          </div>
          <div className="mt-14">
            <TabsContent value="all">
              {renderQuotes(quotes)}
            </TabsContent>
            <TabsContent value="following">
              {renderQuotes(quotes)}
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-2 flex justify-around items-center">
        <Button variant="ghost" size="icon" className="w-12 h-12" onClick={() => router.push('/newsfeed')}>
          <Home className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" className="w-12 h-12" onClick={() => router.push('/search')}>
          <Search className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" className="w-12 h-12" onClick={() => router.push('/profile')}>
          <User className="h-6 w-6" />
        </Button>
      </nav>
    </EchoLayout>
  );
};

export default NewsfeedPage;

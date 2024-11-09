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
    <div className="space-y-6 max-w-2xl mx-auto px-4">
      {quotes.map((quote) => (
        <QuoteCard
          key={quote.id}
          {...quote}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <EchoLayout>
        <div className="pb-16">
          <Tabs defaultValue={activeTab} className="w-full" onValueChange={handleTabChange}>
            <div className="fixed top-0 left-0 right-0 z-10 px-4 py-2">
              <div className="max-w-2xl mx-auto">
                <TabsList className="grid w-full grid-cols-2 bg-white/10 backdrop-blur-sm border border-white/20">
                  <TabsTrigger 
                    value="all" 
                    className="data-[state=active]:bg-white/20 text-white"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger 
                    value="following"
                    className="data-[state=active]:bg-white/20 text-white"
                  >
                    Following
                  </TabsTrigger>
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
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-950/90 backdrop-blur-md border-t border-white/5 p-2 flex justify-around items-center z-50">
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
      </EchoLayout>
    </div>
  );
};

export default NewsfeedPage;

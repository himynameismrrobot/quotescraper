import React, { useState, useEffect } from 'react';
import { useRouter } from "next/router";
import EchoLayout from '../components/EchoLayout';
import QuoteCard from '../components/QuoteCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Home, Search, User } from "lucide-react";
import BottomNav from '../components/BottomNav';
import { useAuth } from '@/components/AuthStateProvider';

interface Quote {
  id: string;
  summary: string;
  raw_quote_text: string;
  article_date: string;
  speaker: {
    id: string;
    name: string;
    image_url: string | null;
    organization: {
      id: string;
      name: string;
      logo_url: string | null;
    } | null;
  };
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
      console.log('Fetched quotes:', data);
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
          quote={quote}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <EchoLayout>
        <div className="pb-24">
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
        <BottomNav />
      </EchoLayout>
    </div>
  );
};

export default NewsfeedPage;

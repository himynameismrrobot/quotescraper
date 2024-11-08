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
  reactions?: {
    emoji: string;
    users: { id: string }[];
  }[];
}

const NewsfeedPage = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeTab, setActiveTab] = useState('all');

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
  }, [activeTab]); // Re-fetch when tab changes

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <EchoLayout>
      <div className="container mx-auto px-4">
        <Tabs defaultValue="all" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
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
                  comments={0}
                  reactions={quote.reactions}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="following">
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
                  comments={0}
                  reactions={quote.reactions}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </EchoLayout>
  );
};

export default NewsfeedPage;

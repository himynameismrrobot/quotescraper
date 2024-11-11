import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();
  const LIMIT = 20;

  const fetchQuotes = async (tab: string, currentOffset: number, append = false) => {
    if (loading) {
      console.log('Skipping fetch - already loading');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Fetching quotes:', { tab, currentOffset, append });
      
      const response = await fetch(`/api/quotes?tab=${tab}&limit=${LIMIT}&offset=${currentOffset}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quotes');
      }
      const data = await response.json();
      
      console.log('Fetched quotes:', { 
        newQuotesCount: data.quotes.length,
        hasMore: data.hasMore,
        total: data.total,
        currentOffset,
        nextOffset: currentOffset + data.quotes.length
      });

      setHasMore(data.hasMore);
      setQuotes(prev => append ? [...prev, ...data.quotes] : data.quotes);
      if (data.quotes.length > 0) {
        setOffset(currentOffset + data.quotes.length);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch when tab changes
  useEffect(() => {
    console.log('Tab changed, resetting and fetching initial quotes');
    setQuotes([]);
    setOffset(0);
    setHasMore(true);
    fetchQuotes(activeTab, 0);
  }, [activeTab]);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      if (loading || !hasMore) {
        console.log('Skipping scroll handler:', { loading, hasMore });
        return;
      }

      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const threshold = documentHeight - 800;
      
      console.log('Scroll metrics:', {
        scrollPosition,
        documentHeight,
        threshold,
        shouldFetch: scrollPosition > threshold,
        offset
      });

      if (scrollPosition > threshold) {
        console.log('Fetching more quotes:', { offset });
        fetchQuotes(activeTab, offset, true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, offset, activeTab]); // Add dependencies here

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const renderQuotes = (quotes: Quote[]) => (
    <div className="space-y-6 max-w-2xl mx-auto px-4">
      {quotes.map((quote) => (
        <QuoteCard
          key={`${quote.id}-${activeTab}`}
          quote={quote}
        />
      ))}
      {loading && (
        <div className="text-center py-4 text-gray-400">
          Loading more quotes...
        </div>
      )}
      {!hasMore && quotes.length > 0 && (
        <div className="text-center py-4 text-gray-400">
          No more quotes to load
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative">
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 -z-10" />
      <EchoLayout>
        <div className="pb-24">
          <Tabs defaultValue={activeTab} className="w-full" onValueChange={handleTabChange}>
            <div className="fixed top-0 left-0 right-0 z-10 bg-gradient-to-b from-gray-900 to-gray-900/80 backdrop-blur-xl border-b border-white/10">
              <div className="max-w-2xl mx-auto px-4 py-3">
                <TabsList className="grid w-full grid-cols-2 bg-white/10 border border-white/20">
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
            <div className="mt-16">
              <TabsContent value="all" className="mt-0">
                {renderQuotes(quotes)}
              </TabsContent>
              <TabsContent value="following" className="mt-0">
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

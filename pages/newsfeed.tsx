import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from "next/router";
import EchoLayout from '../components/EchoLayout';
import QuoteCard from '../components/QuoteCard';
import QuoteCardSkeleton from '../components/QuoteCardSkeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import BottomNav from '../components/BottomNav';
import { useAuth } from '@/components/AuthStateProvider';

interface Quote {
  id: string;
  summary: string;
  raw_quote_text: string;
  article_date: string;
  created_at: string;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();
  const LIMIT = 20;

  const fetchQuotes = useCallback(async (tab: string, currentOffset: number, append = false) => {
    if (append && loadingMore) {
      return;
    }
    
    try {
      append ? setLoadingMore(true) : setLoading(true);
      
      const response = await fetch(`/api/quotes?tab=${tab}&limit=${LIMIT}&offset=${currentOffset}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quotes');
      }
      const data = await response.json();

      setHasMore(data.hasMore);
      if (append) {
        setQuotes(prev => [...prev, ...data.quotes]);
      } else {
        setQuotes(data.quotes);
      }
      
      if (data.quotes.length > 0) {
        setOffset(currentOffset + data.quotes.length);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setQuotes([]);
    setOffset(0);
    setHasMore(true);
    setLoading(true);
    fetchQuotes(value, 0, false);
  };

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchQuotes(activeTab, 0, false);
  }, []);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      if (loading || loadingMore || !hasMore) {
        return;
      }

      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const threshold = documentHeight - 800;

      if (scrollPosition > threshold) {
        fetchQuotes(activeTab, offset, true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, offset, activeTab, fetchQuotes]);

  const renderQuotes = (quotes: Quote[]) => (
    <div className="space-y-6 max-w-2xl mx-auto px-4">
      {loading && quotes.length === 0 ? (
        Array.from({ length: 3 }).map((_, i) => (
          <QuoteCardSkeleton key={i} />
        ))
      ) : (
        <>
          {quotes.map((quote) => (
            <QuoteCard
              key={`${quote.id}-${activeTab}`}
              quote={quote}
            />
          ))}
          {loadingMore && (
            <div className="text-center py-4 text-gray-400">
              Loading more quotes...
            </div>
          )}
          {!hasMore && quotes.length > 0 && (
            <div className="text-center py-4 text-gray-400">
              No more quotes to load
            </div>
          )}
        </>
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

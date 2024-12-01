import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import EchoLayout from '../../components/EchoLayout';
import QuoteCard from '../../components/QuoteCard';
import { Card } from '../../components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import BottomNav from '../../components/BottomNav';
import { useAuth } from '@/components/AuthStateProvider';
import { getQuoteFromCache, setQuoteInCache, hasQuoteInCache } from '@/utils/cache';

// Define Quote type
interface Quote {
  id: string;
  raw_quote_text: string;
  summary: string;
  speaker: {
    id: string;
    name: string;
  };
  article_url: string;
  article_date?: string;
  reactions?: any[];
  [key: string]: any;
}

const QuoteDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchQuote = async () => {
      try {
        // Try to get from cache first
        if (hasQuoteInCache(id as string)) {
          setQuote(getQuoteFromCache(id as string));
          setLoading(false);
          // Refresh in background
          const response = await fetch(`/api/quotes/${id}`);
          if (response.ok) {
            const data = await response.json();
            setQuoteInCache(id as string, data);
            setQuote(data);
          }
          return;
        }

        // If not in cache, fetch normally
        const response = await fetch(`/api/quotes/${id}`);
        if (!response.ok) throw new Error('Failed to fetch quote');
        
        const data = await response.json();
        setQuoteInCache(id as string, data);
        setQuote(data);
      } catch (error) {
        console.error('Error fetching quote:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [id]);

  if (!quote && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <EchoLayout>
          <div className="max-w-2xl mx-auto px-4 py-6">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300 hover:text-white hover:bg-white/10 mb-4"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 p-6">
              <p className="text-white">Quote not found</p>
            </Card>
          </div>
          <BottomNav />
        </EchoLayout>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <EchoLayout>
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-white/10 mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {loading ? (
            <div className="space-y-4">
              <div className="w-full h-32 bg-white/10 rounded-lg animate-pulse" />
              <div className="w-3/4 h-6 bg-white/10 rounded animate-pulse" />
              <div className="w-1/2 h-6 bg-white/10 rounded animate-pulse" />
            </div>
          ) : quote ? (
            <QuoteCard quote={quote} showComments />
          ) : null}
        </div>
        <BottomNav />
      </EchoLayout>
    </div>
  );
};

export default QuoteDetailPage;

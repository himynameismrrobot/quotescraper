import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from "next/router";
import EchoLayout from '../components/EchoLayout';
import QuoteCard from '../components/QuoteCard';
import QuoteCardSkeleton from '../components/QuoteCardSkeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import BottomNav from '../components/BottomNav';
import { useAuth } from '@/components/AuthStateProvider';
import { Switch } from "@/components/ui/switch";
import { FileText } from 'lucide-react';
import { getQuoteFromCache, setQuoteInCache } from '@/utils/cache';

// Keep state between navigations
interface GlobalState {
  quotes: Quote[];
  offset: number;
  hasMore: boolean;
  activeTab: string;
  showRawQuotes: boolean;
  scrollY: number;
  lastQuoteClicked?: string;
}

const STORAGE_KEY = 'newsfeed_state';

const defaultState: GlobalState = {
  quotes: [],
  offset: 0,
  hasMore: true,
  activeTab: 'all',
  showRawQuotes: false,
  scrollY: 0
};

// Use sessionStorage to persist scroll position
const getGlobalState = (): GlobalState => {
  if (typeof window === 'undefined') {
    return defaultState;
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    console.log('📥 Reading from storage:', stored);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading from storage:', error);
  }

  return defaultState;
};

const setGlobalState = (state: Partial<GlobalState>) => {
  if (typeof window === 'undefined') return;

  try {
    const current = getGlobalState();
    const newState = { ...current, ...state };
    console.log('📤 Writing to storage:', newState);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    globalState = newState;
  } catch (error) {
    console.error('Error writing to storage:', error);
  }
};

let globalState = defaultState;

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

const PREFETCH_THRESHOLD = 800;
const SCROLL_DEBOUNCE = 150;

const NewsfeedPage = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showRawQuotes, setShowRawQuotes] = useState(false);
  const router = useRouter();
  const LIMIT = 20;
  const shouldRestoreScroll = useRef(false);
  const isRestoringScroll = useRef(false);
  const isInitialMount = useRef(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Initialize client-side state
  useEffect(() => {
    const storedState = getGlobalState();
    setQuotes(storedState.quotes);
    setActiveTab(storedState.activeTab);
    setOffset(storedState.offset);
    setHasMore(storedState.hasMore);
    setShowRawQuotes(storedState.showRawQuotes);
    globalState = storedState;

    // If we have a saved scroll position, restore it
    if (storedState.scrollY > 0) {
      window.scrollTo(0, storedState.scrollY);
    }
  }, []);

  // Handle navigation events
  useEffect(() => {
    const handleRouteChangeStart = () => {
      console.log('🚀 Route change start', {
        currentScroll: window.scrollY,
        isRestoring: isRestoringScroll.current
      });

      if (!isRestoringScroll.current) {
        setGlobalState({
          scrollY: window.scrollY,
          quotes,
          offset,
          hasMore,
          activeTab,
          showRawQuotes
        });
        console.log('💾 Saved scroll position:', window.scrollY);
      }
    };

    const handleRouteChangeComplete = (url: string) => {
      const isNewsfeed = url === '/' || url === '/newsfeed';
      const storedState = getGlobalState();
      
      console.log('✅ Route change complete', {
        url,
        isNewsfeed,
        savedScroll: storedState.scrollY,
        shouldRestore: isNewsfeed && storedState.scrollY > 0
      });

      if (isNewsfeed && storedState.scrollY > 0) {
        shouldRestoreScroll.current = true;
        console.log('🎯 Set restore flag to true');
        
        // Force scroll restoration after a short delay
        setTimeout(() => {
          window.scrollTo(0, storedState.scrollY);
          console.log('🔄 Forced scroll to:', storedState.scrollY);
        }, 100);
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router, quotes, offset, hasMore, activeTab, showRawQuotes]);

  // Initial data fetch
  useEffect(() => {
    if (quotes.length === 0) {
      console.log('🔄 Fetching initial quotes');
      setLoading(true);
      fetchQuotes(activeTab, 0, false);
    }
  }, [quotes.length, activeTab]);

  const prefetchQuoteDetails = useCallback(async (quoteId: string) => {
    if (getQuoteFromCache(quoteId)) return;

    try {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) throw new Error('Failed to fetch quote details');
      const data = await response.json();
      setQuoteInCache(quoteId, data);
    } catch (error) {
      console.error('Error prefetching quote:', error);
    }
  }, []);

  const handleQuoteClick = useCallback((quoteId: string) => {
    console.log('👆 Quote clicked:', {
      quoteId,
      currentScroll: window.scrollY
    });

    // Cache current quote data before navigation
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      setQuoteInCache(quoteId, quote);
    }

    // Save state with current scroll position
    setGlobalState({
      scrollY: window.scrollY,
      lastQuoteClicked: quoteId,
      quotes,
      offset,
      hasMore,
      activeTab,
      showRawQuotes
    });

    router.push(`/quote/${quoteId}`);
    
    // Prefetch full details in the background
    if (!getQuoteFromCache(quoteId)) {
      prefetchQuoteDetails(quoteId);
    }
  }, [router, prefetchQuoteDetails, quotes, offset, hasMore, activeTab, showRawQuotes]);

  const fetchQuotes = useCallback(async (tab: string, currentOffset: number, append = false) => {
    if (append && loadingMore) return;
    
    try {
      append ? setLoadingMore(true) : setLoading(true);
      
      const response = await fetch(`/api/quotes?tab=${tab}&limit=${LIMIT}&offset=${currentOffset}`);
      if (!response.ok) throw new Error('Failed to fetch quotes');
      
      const data = await response.json();
      setHasMore(data.hasMore);
      
      // Cache quotes as they come in
      data.quotes.forEach((quote: Quote) => {
        if (quote.id) {
          setQuoteInCache(quote.id, quote);
        }
      });

      setQuotes(prev => {
        const newQuotes = append ? [...prev, ...data.quotes] : data.quotes;
        // Remove duplicates based on ID
        const uniqueQuotes = Array.from(
          new Map(newQuotes.map((quote: Quote) => [quote.id, quote])).values()
        ) as Quote[];
        return uniqueQuotes;
      });

      if (data.quotes.length > 0) {
        setOffset(currentOffset + data.quotes.length);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [loadingMore]);

  const handleTabChange = useCallback((value: string) => {
    if (!shouldRestoreScroll.current) {
      setActiveTab(value);
      setQuotes([]);
      setOffset(0);
      setHasMore(true);
      setLoading(true);
      fetchQuotes(value, 0, false);
    }
  }, [fetchQuotes]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isScrolling = false;
    
    const handleScroll = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (isScrolling) return;
      
      isScrolling = true;
      timeoutId = setTimeout(() => {
        if (loading || loadingMore || !hasMore) {
          isScrolling = false;
          return;
        }

        const scrollPosition = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;
        const threshold = documentHeight - PREFETCH_THRESHOLD;

        if (scrollPosition > threshold) {
          fetchQuotes(activeTab, offset, true);
        }
        isScrolling = false;
      }, SCROLL_DEBOUNCE);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, loadingMore, hasMore, offset, activeTab, fetchQuotes]);

  const renderQuotes = useMemo(() => (
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
              showRawQuote={showRawQuotes}
              onQuoteClick={() => handleQuoteClick(quote.id)}
              onHover={() => prefetchQuoteDetails(quote.id)}
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
  ), [quotes, loading, loadingMore, hasMore, activeTab, showRawQuotes, handleQuoteClick, prefetchQuoteDetails]);

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 -z-10" />
      <EchoLayout>
        <div className="pb-24" ref={contentRef}>
          <Tabs defaultValue={activeTab} className="w-full" onValueChange={handleTabChange}>
            <div className="fixed top-0 left-0 right-0 z-10 bg-gradient-to-b from-gray-900 to-gray-900/80 backdrop-blur-xl border-b border-white/10">
              <div className="max-w-2xl mx-auto px-4">
                <div className="flex items-center justify-between py-2">
                  <TabsList className="grid w-[200px] grid-cols-2 bg-white/10 border border-white/20">
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
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-300">Summary</span>
                    <Switch
                      checked={showRawQuotes}
                      onCheckedChange={setShowRawQuotes}
                      className="data-[state=checked]:bg-white/20"
                    />
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4 text-gray-300" />
                      <span className="text-sm text-gray-300">Raw</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-16">
              <TabsContent value="all" className="mt-0">
                {renderQuotes}
              </TabsContent>
              <TabsContent value="following" className="mt-0">
                {renderQuotes}
              </TabsContent>
            </div>
          </Tabs>
        </div>
        <BottomNav />
      </EchoLayout>
    </>
  );
};

export default NewsfeedPage;

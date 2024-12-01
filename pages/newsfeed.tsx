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
const SCROLL_THRESHOLD = 800;

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

  // Create a ref for the observer
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Add new state for tracking restoration
  const [isRestoringQuotes, setIsRestoringQuotes] = useState(false);
  const restorationComplete = useRef(false);

  // Initialize client-side state
  useEffect(() => {
    const storedState = getGlobalState();
    setIsRestoringQuotes(true);
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

    // Only fetch if we have no quotes at all (fresh start)
    if (storedState.quotes.length === 0) {
      console.log('🔄 Fresh start - fetching initial quotes');
      setLoading(true);
      fetchQuotes(storedState.activeTab, 0, false);
    } else {
      // Mark restoration as complete since we have quotes
      restorationComplete.current = true;
      setIsRestoringQuotes(false);
    }
  }, []);

  // Add this effect to handle scroll restoration after quotes render
  useEffect(() => {
    // Only attempt scroll restoration if we have quotes and should restore scroll
    if (quotes.length > 0 && shouldRestoreScroll.current) {
      const storedState = getGlobalState();
      if (storedState.scrollY > 0) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          window.scrollTo(0, storedState.scrollY);
          shouldRestoreScroll.current = false;
        });
      }
    }
  }, [quotes]); // Only run when quotes change

  // Handle navigation events
  useEffect(() => {
    const handleRouteChangeStart = () => {
      if (!isRestoringScroll.current) {
        setGlobalState({
          scrollY: window.scrollY,
          quotes,
          offset,
          hasMore,
          activeTab,
          showRawQuotes
        });
      }
    };

    const handleRouteChangeComplete = async (url: string) => {
      const isNewsfeed = url === '/' || url === '/newsfeed';
      const storedState = getGlobalState();
      
      if (isNewsfeed && storedState.scrollY > 0) {
        shouldRestoreScroll.current = true;
        setIsRestoringQuotes(true);
        
        // Restore the saved state first
        setQuotes(storedState.quotes);
        setOffset(storedState.offset);
        setHasMore(storedState.hasMore);
        setActiveTab(storedState.activeTab);
        setShowRawQuotes(storedState.showRawQuotes);
        
        // Mark restoration as complete since we have quotes
        restorationComplete.current = true;
        setIsRestoringQuotes(false);
        
        // Scroll restoration will happen in the quotes effect above
        
        // If we need more quotes, fetch them silently in the background
        const viewportHeight = window.innerHeight;
        const scrollPosition = storedState.scrollY;
        const estimatedQuotesNeeded = Math.ceil((scrollPosition + viewportHeight) / 300);
        
        if (estimatedQuotesNeeded > storedState.quotes.length && storedState.hasMore) {
          const nextBatch = await fetch(
            `/api/quotes?tab=${storedState.activeTab}&limit=${LIMIT}&offset=${storedState.offset}`
          ).then(res => res.json());
          
          if (nextBatch.quotes.length > 0) {
            // Cache the new quotes
            nextBatch.quotes.forEach((quote: Quote) => {
              if (quote.id) {
                setQuoteInCache(quote.id, quote);
              }
            });
            
            // Update state while preserving scroll
            const combinedQuotes = [...storedState.quotes, ...nextBatch.quotes];
            const uniqueQuotes = Array.from(
              new Map(combinedQuotes.map(quote => [quote.id, quote])).values()
            );
            
            setQuotes(uniqueQuotes as Quote[]);
            setOffset(storedState.offset + nextBatch.quotes.length);
            setHasMore(nextBatch.hasMore);
          }
        }
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router, quotes, offset, hasMore, activeTab, showRawQuotes]);

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
    if (append && loadingMore) {
      console.log('🛑 Skipping fetch - already loading more');
      return;
    }
    
    try {
      append ? setLoadingMore(true) : setLoading(true);
      console.log('📊 Fetching quotes:', { 
        tab, 
        offset: currentOffset, 
        append,
        currentQuotes: quotes.length
      });
      
      const response = await fetch(`/api/quotes?tab=${tab}&limit=${LIMIT}&offset=${currentOffset}`);
      if (!response.ok) throw new Error('Failed to fetch quotes');
      
      const data = await response.json();
      console.log('📥 Received quotes:', { 
        count: data.quotes.length,
        hasMore: data.hasMore,
        newOffset: currentOffset + data.quotes.length
      });

      setHasMore(data.hasMore);
      
      // Cache quotes as they come in
      data.quotes.forEach((quote: Quote) => {
        if (quote.id) {
          setQuoteInCache(quote.id, quote);
        }
      });

      setQuotes(prev => {
        if (append) {
          // When appending, combine old and new quotes
          const combined = [...prev, ...data.quotes];
          // Remove duplicates based on ID
          const uniqueQuotes = Array.from(
            new Map(combined.map(quote => [quote.id, quote])).values()
          ) as Quote[];
          console.log('📝 Updated quotes:', {
            prevCount: prev.length,
            newCount: uniqueQuotes.length,
            added: uniqueQuotes.length - prev.length
          });
          return uniqueQuotes;
        } else {
          // When replacing, just use new quotes
          return data.quotes;
        }
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
    setActiveTab(value);
    setQuotes([]);
    setOffset(0);
    setHasMore(true);
    setLoading(true);
    fetchQuotes(value, 0, false);
  }, [fetchQuotes]);

  // Handle infinite scroll
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const handleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        const scrollPosition = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;
        const threshold = documentHeight - SCROLL_THRESHOLD;

        console.log('📜 Scroll check:', {
          position: scrollPosition,
          documentHeight,
          threshold,
          shouldLoad: scrollPosition > threshold,
          loading,
          loadingMore,
          hasMore
        });

        if (scrollPosition > threshold && !loading && !loadingMore && hasMore) {
          console.log('🔄 Loading more quotes', {
            currentOffset: offset,
            currentCount: quotes.length
          });
          fetchQuotes(activeTab, offset, true);
        }
      }, SCROLL_DEBOUNCE);
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [loading, loadingMore, hasMore, offset, activeTab, quotes.length, fetchQuotes]);

  // Render quotes with loading states
  const renderQuotes = useMemo(() => (
    <div className="space-y-6 max-w-2xl mx-auto px-4">
      {(loading && quotes.length === 0) || (isRestoringQuotes && !restorationComplete.current) ? (
        Array.from({ length: Math.ceil(window.innerHeight / 300) }).map((_, i) => (
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
          {loadingMore && !isRestoringQuotes && restorationComplete.current && (
            <div className="text-center py-4 text-gray-400">
              Loading more quotes...
            </div>
          )}
          {!hasMore && quotes.length > 0 && (
            <div className="text-center py-4 text-gray-400">
              No more quotes to load
            </div>
          )}
          {/* Intersection Observer sentinel */}
          <div 
            ref={(el) => {
              if (observerRef.current) {
                observerRef.current.disconnect();
              }

              if (!el || loading || loadingMore || !hasMore || isRestoringQuotes || !restorationComplete.current) {
                observerRef.current = null;
                return;
              }

              observerRef.current = new IntersectionObserver(
                (entries) => {
                  if (entries[0].isIntersecting && !isRestoringQuotes && restorationComplete.current) {
                    fetchQuotes(activeTab, offset, true);
                  }
                },
                { rootMargin: '200px' }
              );

              observerRef.current.observe(el);
            }}
            className="h-10"
          />
        </>
      )}
    </div>
  ), [quotes, loading, loadingMore, hasMore, activeTab, showRawQuotes, handleQuoteClick, prefetchQuoteDetails, offset, fetchQuotes, isRestoringQuotes]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

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

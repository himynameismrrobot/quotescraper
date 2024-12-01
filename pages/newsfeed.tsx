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
import { getQuoteFromCache, setQuoteInCache, hasQuoteInCache } from '@/utils/cache';

// At the top of the file, after the imports
if (typeof window !== 'undefined') {
  // Prevent automatic scroll restoration
  history.scrollRestoration = 'manual';
}

// Keep state between navigations
interface GlobalState {
  quotes: Quote[];
  offset: number;
  hasMore: boolean;
  activeTab: TabOption;
  showRawQuotes: boolean;
  scrollPosition: number;
}

const defaultState: GlobalState = {
  quotes: [],
  offset: 0,
  hasMore: true,
  activeTab: 'all',
  showRawQuotes: false,
  scrollPosition: 0
};

// Constants for storage keys
const STORAGE_KEY = 'newsfeed_state';

// Always return a valid GlobalState
const getGlobalState = (): GlobalState => {
  try {
    // Check if this is a page refresh
    if (typeof window !== 'undefined') {
      const navEntry = window.performance?.getEntriesByType('navigation')?.[0] as PerformanceNavigationTiming;
      console.log('Navigation Type:', navEntry?.type);
      if (navEntry?.type === 'reload') {
        // Clear stored state on refresh
        sessionStorage.removeItem(STORAGE_KEY);
        return defaultState;
      }
    }

    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;
    
    const state = JSON.parse(stored);
    return {
      quotes: state.quotes || [],
      offset: state.offset || 0,
      hasMore: state.hasMore ?? true,
      activeTab: state.activeTab || 'all',
      showRawQuotes: state.showRawQuotes || false,
      scrollPosition: state.scrollPosition ?? 0
    };
  } catch (error) {
    console.error('Error reading from storage:', error);
    return defaultState;
  }
};

const saveGlobalState = (state: GlobalState) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error writing to storage:', error);
  }
};

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
  comment_count: number;
}

const LIMIT = 20;
const PREFETCH_THRESHOLD = 800;
const SCROLL_DEBOUNCE = 150;
const SCROLL_THRESHOLD = 800;

// Add type definition at the top
type TabOption = 'all' | 'liked' | 'commented';

// Add a new helper function at the top level
const validateHasMore = async (offset: number, tab: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `/api/quotes/check-more?offset=${offset}&tab=${tab}&limit=${LIMIT}`
    );
    const data = await response.json();
    return data.hasMore;
  } catch (error) {
    console.error('Error validating hasMore:', error);
    return true; // Assume there's more on error to prevent false negatives
  }
};

const NewsfeedPage = () => {
  // Auth and router hooks
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [scrollPosition, setScrollPosition] = useState(0);

  // State hooks
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<TabOption>('all');
  const [showRawQuotes, setShowRawQuotes] = useState(false);

  // Add scrollRestored state
  const [scrollRestored, setScrollRestored] = useState(false);

  // Log auth state changes
  useEffect(() => {
    console.log('🔑 Auth state changed:', { 
      authLoading, 
      hasUser: !!user,
      quotesLoading: loading,
      quoteCount: quotes.length 
    });
  }, [authLoading, user, loading, quotes.length]);

  // Save state before navigation
  useEffect(() => {
    const handleRouteChangeStart = () => {
      const currentState = {
        quotes,
        offset,
        hasMore,
        activeTab,
        showRawQuotes,
        scrollPosition: window.scrollY
      };
      console.log('💾 Saving state before navigation:', { scrollY: window.scrollY, quotes: quotes.length });
      saveGlobalState(currentState);
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [quotes, offset, hasMore, activeTab, showRawQuotes]);

  // Initialize client-side state
  useEffect(() => {
    const initializeQuotes = async () => {
      if (!user || authLoading) {
        console.log('⏳ Waiting for auth...');
        return;
      }

      try {
        const storedState = getGlobalState();
        
        // Log the stored state for debugging
        console.log('Stored State:', storedState);

        if (storedState.quotes?.length > 0) {
          console.log('📥 Restoring previous state', { 
            scrollPosition: storedState.scrollPosition,
            quotes: storedState.quotes.length 
          });
          
          setQuotes(storedState.quotes);
          setOffset(storedState.offset);
          setActiveTab(storedState.activeTab);
          setShowRawQuotes(storedState.showRawQuotes);
          
          const validatedHasMore = await validateHasMore(
            storedState.offset,
            storedState.activeTab
          );
          setHasMore(validatedHasMore);
          
          // Set scrollRestored to false to trigger restoration later
          setScrollRestored(false);
        } else {
          console.log('🔄 Starting fresh quote fetch');
          sessionStorage.removeItem(STORAGE_KEY);
          setLoading(true);
          await fetchQuotes('all', 0, false);
        }
      } catch (error) {
        console.error('Error initializing quotes:', error);
        setLoading(true);
        await fetchQuotes('all', 0, false);
      }
    };

    initializeQuotes();
  }, [user, authLoading]);

  // Add new effect for scroll restoration
  useEffect(() => {
    if (!scrollRestored && quotes.length > 0) {
      const storedState = getGlobalState();
      console.log('🧭 Restoring scroll position:', storedState.scrollPosition);
      window.scrollTo(0, storedState.scrollPosition || 0);
      setScrollRestored(true);
    }
  }, [quotes, scrollRestored]);

  // Handle infinite scroll
  const loadMoreQuotes = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      await fetchQuotes(activeTab, offset, true);
    } catch (error) {
      console.error('Error loading more quotes:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, activeTab, offset]);

  // Refs
  const restorationComplete = useRef(false);
  const shouldRestoreScroll = useRef(false);
  const isRestoringScroll = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Callbacks
  const fetchQuotes = useCallback(async (tab: string, startOffset: number, append: boolean = true) => {
    try {
      console.log('🔍 Fetching quotes:', { tab, startOffset, append, loading, loadingMore });
      
      if (loadingMore && append) {
        console.log('⏳ Already loading more quotes, skipping fetch');
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const response = await fetch(
        `/api/quotes?tab=${tab}&limit=${LIMIT}&offset=${startOffset}`
      );
      const data = await response.json();

      console.log('📥 Received quotes:', { 
        count: data.quotes?.length,
        hasMore: data.hasMore,
        append,
        currentCount: quotes.length
      });

      if (data.quotes) {
        // Cache the new quotes
        data.quotes.forEach((quote: Quote) => {
          if (quote.id) {
            setQuoteInCache(quote.id, quote);
          }
        });

        setQuotes(prev => {
          if (!append) return data.quotes;
          
          // When appending, add new quotes and remove duplicates
          const combinedQuotes = [...prev, ...data.quotes];
          const uniqueQuotes = Array.from(
            new Map(combinedQuotes.map(quote => [quote.id, quote])).values()
          ) as Quote[];
          
          // Update offset based on actual number of unique quotes
          const newOffset = startOffset + data.quotes.length;
          setOffset(newOffset);
          
          return uniqueQuotes;
        });
        
        // Update hasMore based on API response
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('❌ Error fetching quotes:', error);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [quotes.length, loading, loadingMore]);

  // Handle tab changes
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabOption);
    setQuotes([]);
    setOffset(0);
    setHasMore(true);
    setLoading(true);
    fetchQuotes(value as TabOption, 0, false);
  }, [fetchQuotes]);

  // Log component state changes
  useEffect(() => {
    console.log('📊 Component state:', {
      loading,
      loadingMore,
      hasMore,
      quoteCount: quotes.length,
      offset,
      restorationComplete: restorationComplete.current
    });
  }, [loading, loadingMore, hasMore, quotes.length, offset]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Add effect to handle route changes
  useEffect(() => {
    const handleRouteChange = () => {
      // Reset loading state when route changes
      setLoading(true);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  // Restore scroll position when returning to the page
  useEffect(() => {
    if (!loading && quotes.length > 0) {
      const storedState = getGlobalState();
      if (storedState.scrollPosition) {
        window.scrollTo(0, storedState.scrollPosition);
      }
    }
  }, [loading, quotes.length]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <EchoLayout>
          <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="space-y-4">
              <div className="w-full h-32 bg-white/10 rounded-lg animate-pulse" />
              <div className="w-3/4 h-6 bg-white/10 rounded animate-pulse" />
              <div className="w-1/2 h-6 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </EchoLayout>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  // Render quotes with loading states
  const renderQuotes = (
    <div className="space-y-6 max-w-2xl mx-auto px-4">
      {loading && quotes.length === 0 ? (
        Array.from({ length: Math.ceil(window.innerHeight / 300) }).map((_, i) => (
          <QuoteCardSkeleton key={i} />
        ))
      ) : (
        <>
          {quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              showRawQuote={showRawQuotes}
              onQuoteClick={() => router.push(`/quote/${quote.id}`)}
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
          {/* Updated Intersection Observer sentinel */}
          <div 
            ref={(el) => {
              if (observerRef.current) {
                observerRef.current.disconnect();
              }

              if (!el || loading || loadingMore) {
                observerRef.current = null;
                return;
              }

              observerRef.current = new IntersectionObserver(
                (entries) => {
                  if (entries[0].isIntersecting && hasMore) {
                    loadMoreQuotes();
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
  );

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

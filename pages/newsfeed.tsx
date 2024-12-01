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
  comment_count: number;
}

const LIMIT = 20;
const PREFETCH_THRESHOLD = 800;
const SCROLL_DEBOUNCE = 150;
const SCROLL_THRESHOLD = 800;

const NewsfeedPage = () => {
  // Auth and router hooks
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // State hooks
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showRawQuotes, setShowRawQuotes] = useState(false);
  const [isRestoringQuotes, setIsRestoringQuotes] = useState(false);
  
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
          let newQuotes;
          if (append) {
            // When appending, add new quotes to the end
            const combinedQuotes = [...prev, ...data.quotes];
            // Remove duplicates while preserving order
            newQuotes = Array.from(
              new Map(combinedQuotes.map(quote => [quote.id, quote])).values()
            ) as Quote[];
          } else {
            // When replacing, just use the new quotes (they're already sorted from API)
            newQuotes = data.quotes;
          }
          
          console.log('📊 Updating quotes:', {
            action: append ? 'append' : 'replace',
            prevCount: prev.length,
            newCount: newQuotes.length,
            firstQuoteDate: newQuotes[0]?.created_at,
            lastQuoteDate: newQuotes[newQuotes.length - 1]?.created_at
          });
          
          return newQuotes;
        });
        
        setOffset(startOffset + data.quotes.length);
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

  const handleTabChange = useCallback((value: string) => {
    console.log('📑 Tab changed:', value);
    setActiveTab(value);
    setQuotes([]);
    setOffset(0);
    setHasMore(true);
    setLoading(true);
    fetchQuotes(value, 0, false);
  }, [fetchQuotes]);

  // Effects
  useEffect(() => {
    console.log('🔑 Auth state changed:', { 
      authLoading, 
      hasUser: !!user, 
      quotesLoading: loading,
      quoteCount: quotes.length 
    });

    if (!authLoading && !user) {
      console.log('👉 Redirecting to signin');
      router.push('/auth/signin');
    }
  }, [authLoading, user, router, loading, quotes.length]);

  useEffect(() => {
    console.log('📊 Component state:', {
      loading,
      loadingMore,
      hasMore,
      quoteCount: quotes.length,
      offset,
      isRestoringQuotes,
      restorationComplete: restorationComplete.current
    });
  }, [loading, loadingMore, hasMore, quotes.length, offset, isRestoringQuotes]);

  // Initialize client-side state
  useEffect(() => {
    // Don't do anything if still checking auth
    if (authLoading) {
      console.log('⏳ Waiting for auth...');
      return;
    }

    // Redirect if not authenticated
    if (!user) {
      console.log('👉 Redirecting to signin');
      router.push('/auth/signin');
      return;
    }

    // Only run initialization once
    if (restorationComplete.current) {
      return;
    }

    const initializeQuotes = async () => {
      try {
        // Check if this is a fresh page load vs navigation
        const isPageReload = window.performance?.navigation?.type === 1;

        if (isPageReload) {
          console.log('🧹 Page was refreshed - clearing cache and session storage');
          sessionStorage.removeItem(STORAGE_KEY);
          localStorage.clear(); // This clears the quote cache
          setQuotes([]);
          setOffset(0);
          setHasMore(true);
          setLoading(true);
          await fetchQuotes('all', 0, false);
        } else {
          // Normal navigation - restore state if available
          const storedState = getGlobalState();
          console.log('💾 Checking stored state:', {
            hasStoredState: !!storedState,
            storedQuoteCount: storedState.quotes?.length
          });

          if (storedState.quotes?.length > 0) {
            console.log('↩️ Restoring state from navigation');
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
          } else {
            // No stored state, fetch fresh
            console.log('🔄 Starting fresh quote fetch');
            setLoading(true);
            await fetchQuotes('all', 0, false);
          }
        }
      } catch (error) {
        console.error('Error initializing quotes:', error);
      } finally {
        restorationComplete.current = true;
        setLoading(false);
      }
    };

    initializeQuotes();
  }, [authLoading, user]); // Only depend on auth state

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
              onQuoteClick={() => router.push(`/quote/${quote.id}`)}
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

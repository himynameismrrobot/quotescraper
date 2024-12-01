// Simple in-memory cache for quotes
export const quoteCache = new Map<string, any>();

// Helper functions for quote cache management
export const getQuoteFromCache = (id: string) => {
  return quoteCache.get(id);
};

export const setQuoteInCache = (id: string, quote: any) => {
  quoteCache.set(id, quote);
};

export const hasQuoteInCache = (id: string) => {
  return quoteCache.has(id);
}; 
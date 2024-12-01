// Simple persistent cache for quotes using localStorage
const CACHE_KEY = 'quote_cache';

// Helper functions for quote cache management
export const getQuoteFromCache = (id: string) => {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return cache[id];
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
};

export const setQuoteInCache = (id: string, quote: any) => {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[id] = quote;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
};

export const hasQuoteInCache = (id: string) => {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return id in cache;
  } catch (error) {
    console.error('Error checking cache:', error);
    return false;
  }
};

// Update specific fields of a cached quote
export const updateQuoteFieldsInCache = (id: string, fields: Partial<any>) => {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    if (id in cache) {
      cache[id] = { ...cache[id], ...fields };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.error('Error updating cache:', error);
  }
};

// Clear cache for testing/debugging
export const clearQuoteCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}; 
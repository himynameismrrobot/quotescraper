import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { Database } from "@/types/supabase";

export interface Article {
  url: string;
  headline: string;
  parentUrl: string;
}

export interface Quote {
  text: string;
  speaker: string;
  summary: string;
  date: string | null;
  articleUrl: string;
  articleHeadline: string;
  parentUrl: string;
}

export interface Config {
  similarityThreshold: number;
  maxParallelExtractions: number;
  supabaseClient: Database;
}

// Define the state of our workflow
export const QuoteScraperState = Annotation.Root({
  // Messages passed between nodes
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => {
      // Ensure x and y are arrays of BaseMessage
      const xMessages = Array.isArray(x) ? x : [x];
      const yMessages = Array.isArray(y) ? y : [y];
      return xMessages.concat(yMessages);
    },
    default: () => [],
  }),
  // Articles found in the initial crawl
  articles: Annotation<Article[]>({
    reducer: (x, y) => (x || []).concat(y || []),
    default: () => [],
  }),
  // Articles that haven't been processed yet
  filteredArticles: Annotation<Article[]>({
    reducer: (x, y) => (x || []).concat(y || []),
    default: () => [],
  }),
  // Quotes that need validation
  pendingQuotes: Annotation<Quote[]>({
    reducer: (x, y) => (x || []).concat(y || []),
    default: () => [],
  }),
  // Quotes that have been validated
  validatedQuotes: Annotation<Quote[]>({
    reducer: (x, y) => (x || []).concat(y || []),
    default: () => [],
  }),
  // Configuration
  config: Annotation<Config>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({
      similarityThreshold: 0.85,
      maxParallelExtractions: 5,
      supabaseClient: null,
    }),
  }),
});

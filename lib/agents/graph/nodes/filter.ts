import { AIMessage } from "@langchain/core/messages";
import { QuoteScraperState } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Create a tool for filtering articles
const filterArticlesTool = tool(async ({ articles, supabaseClient }) => {
  try {
    // Get existing quotes
    const { data: existingQuotes } = await supabaseClient
      .from('staged_quotes')
      .select('article_url');

    const existingUrls = new Set(existingQuotes?.map(q => q.article_url) || []);

    // Filter out articles that have already been processed
    const filteredArticles = articles.filter(article => !existingUrls.has(article.url));

    return filteredArticles;
  } catch (error) {
    console.error('Error in filter tool:', error);
    return [];
  }
}, {
  name: "filter_articles",
  description: "Filter out articles that have already been processed",
  schema: z.object({
    articles: z.array(z.object({
      url: z.string(),
      headline: z.string(),
    })),
    supabaseClient: z.any(),
  }),
});

// Create the filter node
const tools = [filterArticlesTool];
export const filterNode = new ToolNode({
  tools,
  async function(state: typeof QuoteScraperState.State) {
    const { articles, config } = state;
    
    if (!articles || articles.length === 0) {
      return {
        messages: {
          content: [
            new AIMessage({
              content: "No articles to filter.",
              additional_kwargs: {},
            })
          ]
        },
        filteredArticles: [],
      };
    }

    try {
      const filteredArticles = await filterArticlesTool.invoke({
        articles,
        supabaseClient: config.supabaseClient,
      });

      return {
        messages: {
          content: [
            new AIMessage({
              content: `Filtered down to ${filteredArticles.length} new articles.`,
              additional_kwargs: {},
            })
          ]
        },
        filteredArticles,
      };
    } catch (error) {
      console.error('Error in filter node:', error);
      return {
        messages: {
          content: [
            new AIMessage({
              content: "Error filtering articles.",
              additional_kwargs: {},
            })
          ]
        },
        filteredArticles: [],
      };
    }
  }
});

// Create the routing function
export function routeFilter(state: typeof QuoteScraperState.State) {
  if (!state.messages || state.messages.length === 0) {
    console.error("No messages in state");
    return "__end__";
  }

  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage) {
    console.error("Last message not found");
    return "__end__";
  }
  
  // If we have filtered articles, move to the next step
  if (state.filteredArticles && state.filteredArticles.length > 0) {
    return "quote_extraction";
  }
  
  // Otherwise end
  return "__end__";
}

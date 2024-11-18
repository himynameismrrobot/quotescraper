import { AIMessage } from "@langchain/core/messages";
import { QuoteScraperState } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Create a tool for storing quotes
const storeQuotesTool = tool(async ({ quotes, supabaseClient }) => {
  try {
    if (!quotes || quotes.length === 0) return 0;

    // Store quotes in Supabase
    const { data, error } = await supabaseClient
      .from('staged_quotes')
      .insert(quotes.map(quote => ({
        raw_quote_text: quote.text,
        speaker: quote.speaker,
        summary: quote.summary,
        article_date: quote.date,
        article_url: quote.articleUrl,
        article_headline: quote.articleHeadline,
        parent_url: quote.parentUrl,
        quality_score: quote.quality,
      })))
      .select();

    if (error) {
      console.error('Error storing quotes:', error);
      return 0;
    }

    return data.length;
  } catch (error) {
    console.error('Error in store quotes tool:', error);
    return 0;
  }
}, {
  name: "store_quotes",
  description: "Store validated quotes in the database",
  schema: z.object({
    quotes: z.array(z.object({
      text: z.string(),
      speaker: z.string(),
      summary: z.string(),
      date: z.string().nullable(),
      articleUrl: z.string(),
      articleHeadline: z.string(),
      parentUrl: z.string(),
      quality: z.number(),
    })),
    supabaseClient: z.any(),
  }),
});

// Create the storage node
const tools = [storeQuotesTool];
export const storageNode = new ToolNode({
  tools,
  async function(state: typeof QuoteScraperState.State) {
    const { validatedQuotes, config } = state;
    
    if (!validatedQuotes || validatedQuotes.length === 0) {
      return {
        messages: {
          content: state.messages.content.concat([new AIMessage("No quotes to store.")]),
        },
      };
    }

    try {
      // Store quotes
      const storedCount = await storeQuotesTool.invoke({
        quotes: validatedQuotes,
        supabaseClient: config.supabaseClient,
      });

      return {
        messages: {
          content: state.messages.content.concat([new AIMessage(`Successfully stored ${storedCount} quotes.`)]),
        },
      };
    } catch (error) {
      console.error('Error in storage node:', error);
      return {
        messages: {
          content: state.messages.content.concat([new AIMessage("Error storing quotes.")]),
        },
      };
    }
  }
});

// Create the routing function
export function routeStorage(state: typeof QuoteScraperState.State) {
  const lastMessage = state.messages.content[state.messages.content.length - 1];
  return lastMessage instanceof AIMessage ? "__end__" : "tools";
}

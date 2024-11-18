import { AIMessage } from "@langchain/core/messages";
import { QuoteScraperState } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { OpenAIEmbeddings } from "@langchain/openai";
import { cosineDistance } from "@/lib/utils/similarity";

// Create a tool for deduplicating quotes
const deduplicateQuotesTool = tool(async ({ quotes, similarityThreshold }) => {
  try {
    if (!quotes || quotes.length === 0) return [];

    // Initialize embeddings model
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
    });

    // Get embeddings for all quotes
    const quoteTexts = quotes.map(q => q.text);
    const embeddingVectors = await embeddings.embedDocuments(quoteTexts);

    // Create a map to store unique quotes
    const uniqueQuotes = new Map();

    // Process each quote
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i];
      const currentEmbedding = embeddingVectors[i];
      let isDuplicate = false;

      // Compare with existing unique quotes
      for (const [key, existingQuote] of uniqueQuotes.entries()) {
        const existingEmbedding = embeddingVectors[existingQuote.index];
        const similarity = 1 - cosineDistance(currentEmbedding, existingEmbedding);

        if (similarity >= similarityThreshold) {
          isDuplicate = true;
          // Keep the quote with higher quality score
          if (quote.quality > existingQuote.quote.quality) {
            uniqueQuotes.set(key, { quote, index: i });
          }
          break;
        }
      }

      // If not a duplicate, add to unique quotes
      if (!isDuplicate) {
        uniqueQuotes.set(quote.text, { quote, index: i });
      }
    }

    // Return the unique quotes
    return Array.from(uniqueQuotes.values()).map(({ quote }) => quote);
  } catch (error) {
    console.error('Error in deduplicate quotes tool:', error);
    return quotes; // Return original quotes if deduplication fails
  }
}, {
  name: "deduplicate_quotes",
  description: "Remove duplicate quotes based on semantic similarity",
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
    similarityThreshold: z.number(),
  }),
});

// Create the deduplication node
const tools = [deduplicateQuotesTool];
export const deduplicationNode = new ToolNode({
  tools,
  async function(state: typeof QuoteScraperState.State) {
    const { validatedQuotes, config } = state;
    
    if (!validatedQuotes || validatedQuotes.length === 0) {
      return {
        messages: {
          content: state.messages.content.concat([new AIMessage("No quotes to deduplicate.")]),
        },
        validatedQuotes: [],
      };
    }

    try {
      // Deduplicate quotes
      const uniqueQuotes = await deduplicateQuotesTool.invoke({
        quotes: validatedQuotes,
        similarityThreshold: config.similarityThreshold,
      });

      return {
        messages: {
          content: state.messages.content.concat([new AIMessage(`Deduplicated to ${uniqueQuotes.length} unique quotes from ${validatedQuotes.length} total quotes.`)]),
        },
        validatedQuotes: uniqueQuotes,
      };
    } catch (error) {
      console.error('Error in deduplication node:', error);
      return {
        messages: {
          content: state.messages.content.concat([new AIMessage("Error deduplicating quotes.")]),
        },
        validatedQuotes,
      };
    }
  }
});

// Create the routing function
export function routeDeduplication(state: typeof QuoteScraperState.State) {
  const lastMessage = state.messages.content[state.messages.content.length - 1];
  return lastMessage instanceof AIMessage ? "__end__" : "tools";
}

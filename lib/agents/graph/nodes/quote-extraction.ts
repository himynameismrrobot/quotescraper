import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { QuoteScraperState } from "../state";
import { getMarkdownFromUrl } from "@/lib/utils/jina";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Create a tool for extracting quotes from an article
const extractQuotesTool = tool(async ({ url, headline, parentUrl }) => {
  try {
    const markdown = await getMarkdownFromUrl(url);

    const prompt = `Extract all quotes from the following article. For each quote, provide:
    1. The exact quote text
    2. The speaker's name
    3. A brief summary of the quote's context
    4. The article's date (if mentioned)

    Article:
    ${markdown}

    Respond in JSON format like this:
    {
      "quotes": [
        {
          "text": "quote text",
          "speaker": "speaker name",
          "summary": "brief context",
          "date": "YYYY-MM-DD or null if not found"
        }
      ]
    }`;

    const model = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0,
    });

    const response = await model.invoke([new HumanMessage(prompt)]);
    
    try {
      const result = JSON.parse(response.content);
      return result.quotes.map(quote => ({
        ...quote,
        articleUrl: url,
        articleHeadline: headline,
        parentUrl: parentUrl
      }));
    } catch (error) {
      console.error('Error parsing quote extraction response:', error);
      return [];
    }
  } catch (error) {
    console.error('Error in extract quotes tool:', error);
    return [];
  }
}, {
  name: "extract_quotes",
  description: "Extract quotes from an article",
  schema: z.object({
    url: z.string(),
    headline: z.string(),
    parentUrl: z.string(),
  }),
});

// Create the quote extraction node
const tools = [extractQuotesTool];
export const quoteExtractionNode = new ToolNode({
  tools,
  async function(state: typeof QuoteScraperState.State) {
    const { filteredArticles } = state;
    
    if (!filteredArticles || filteredArticles.length === 0) {
      return {
        messages: {
          content: [
            new AIMessage({
              content: "No articles to extract quotes from.",
              additional_kwargs: {},
            })
          ]
        },
        pendingQuotes: [],
      };
    }

    try {
      // Extract quotes from each article
      const allQuotes = await Promise.all(
        filteredArticles.map(async (article) => {
          const quotes = await extractQuotesTool.invoke({
            url: article.url,
            headline: article.headline,
            parentUrl: article.url,
          });
          return quotes;
        })
      );

      // Flatten the array of arrays
      const pendingQuotes = allQuotes.flat();

      return {
        messages: {
          content: [
            new AIMessage({
              content: `Extracted ${pendingQuotes.length} quotes from ${filteredArticles.length} articles.`,
              additional_kwargs: {},
            })
          ]
        },
        pendingQuotes,
      };
    } catch (error) {
      console.error('Error in quote extraction node:', error);
      return {
        messages: {
          content: [
            new AIMessage({
              content: "Error extracting quotes.",
              additional_kwargs: {},
            })
          ]
        },
        pendingQuotes: [],
      };
    }
  }
});

// Create the routing function
export function routeQuoteExtraction(state: typeof QuoteScraperState.State) {
  if (!state.messages || state.messages.length === 0) {
    console.error("No messages in state");
    return "__end__";
  }

  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage) {
    console.error("Last message not found");
    return "__end__";
  }

  // If we have pending quotes, move to the next step
  if (state.pendingQuotes && state.pendingQuotes.length > 0) {
    return "quote_validation";
  }

  // Otherwise end
  return "__end__";
}

// Create a function to fan out articles for parallel processing
export function fanOutArticles(state: typeof QuoteScraperState.State) {
  const { filteredArticles = [], config } = state;
  const maxBatchSize = config?.maxParallelExtractions || 5;
  
  // Create batches of articles
  const batches: typeof filteredArticles[] = [];
  for (let i = 0; i < filteredArticles.length; i += maxBatchSize) {
    batches.push(filteredArticles.slice(i, i + maxBatchSize));
  }

  // Map each batch to a state object
  return batches.map(batch => ({
    messages: {
      content: state.messages.content.concat([
        new AIMessage(
          JSON.stringify({
            type: "extract_quotes",
            articles: batch,
          })
        ),
      ]),
    },
    articles: state.articles,
    filteredArticles: state.filteredArticles,
    pendingQuotes: state.pendingQuotes,
    validatedQuotes: state.validatedQuotes,
    config: state.config,
  }));
}

export async function quoteExtractionNodeAsync(state: typeof QuoteScraperState.State) {
  const lastMessage = state.messages.content[state.messages.content.length - 1];
  const content = JSON.parse(lastMessage.content);

  if (content.type === 'extract_quotes') {
    const articles = content.articles;
    const pendingQuotes = [];

    for (const article of articles) {
      // Extract quotes from article
      const quotes = await extractQuotesTool.invoke({
        url: article.url,
        headline: article.headline,
        parentUrl: article.url,
      });
      pendingQuotes.push(...quotes);
    }

    return {
      messages: {
        content: state.messages.content.concat([
          new AIMessage(`Extracted ${pendingQuotes.length} quotes from ${articles.length} articles.`),
        ]),
      },
      articles: state.articles,
      filteredArticles: state.filteredArticles,
      pendingQuotes: state.pendingQuotes.concat(pendingQuotes),
      validatedQuotes: state.validatedQuotes,
      config: state.config,
    };
  }

  return state;
}

async function extractQuotesFromArticle(article: any) {
  // Implement quote extraction logic
  return [];
}

export function routeQuoteExtractionAsync(state: typeof QuoteScraperState.State) {
  const lastMessage = state.messages.content[state.messages.content.length - 1];
  const content = JSON.parse(lastMessage.content);

  if (content.type === 'extract_quotes') {
    return 'quote_extraction';
  }

  return 'quote_validation';
}

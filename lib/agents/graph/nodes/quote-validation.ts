import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { QuoteScraperState } from "../state";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Create a tool for validating quotes
const validateQuotesTool = tool(async ({ quotes }) => {
  try {
    const prompt = `Validate the following quotes and assign a quality score (0-1) based on:
    1. Clarity and completeness
    2. Attribution accuracy
    3. Contextual relevance
    4. Uniqueness and insight value

    Quotes:
    ${JSON.stringify(quotes, null, 2)}

    Respond in JSON format with the validated quotes and their quality scores:
    {
      "validatedQuotes": [
        {
          "text": "quote text",
          "speaker": "speaker name",
          "summary": "brief context",
          "date": "YYYY-MM-DD or null",
          "articleUrl": "url",
          "articleHeadline": "headline",
          "parentUrl": "url",
          "quality": 0.95
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
      return result.validatedQuotes;
    } catch (error) {
      console.error('Error parsing quote validation response:', error);
      return [];
    }
  } catch (error) {
    console.error('Error in validate quotes tool:', error);
    return [];
  }
}, {
  name: "validate_quotes",
  description: "Validate quotes and assign quality scores",
  schema: z.object({
    quotes: z.array(z.object({
      text: z.string(),
      speaker: z.string(),
      summary: z.string(),
      date: z.string().nullable(),
      articleUrl: z.string(),
      articleHeadline: z.string(),
      parentUrl: z.string(),
    })),
  }),
});

// Create the quote validation node
const tools = [validateQuotesTool];
export const quoteValidationNode = new ToolNode({
  tools,
  async function(state: typeof QuoteScraperState.State) {
    const { pendingQuotes } = state;
    
    if (!pendingQuotes || pendingQuotes.length === 0) {
      return {
        messages: {
          content: state.messages.content.concat([new AIMessage("No quotes to validate.")]),
        },
        validatedQuotes: [],
      };
    }

    try {
      // Validate quotes
      const validatedQuotes = await validateQuotesTool.invoke({
        quotes: pendingQuotes,
      });

      return {
        messages: {
          content: state.messages.content.concat([new AIMessage(`Validated ${validatedQuotes.length} quotes.`)]),
        },
        validatedQuotes,
      };
    } catch (error) {
      console.error('Error in quote validation node:', error);
      return {
        messages: {
          content: state.messages.content.concat([new AIMessage("Error validating quotes.")]),
        },
        validatedQuotes: [],
      };
    }
  }
});

// Create the routing function
export function routeQuoteValidation(state: typeof QuoteScraperState.State) {
  const lastMessage = state.messages.content[state.messages.content.length - 1];
  return lastMessage instanceof AIMessage ? "__end__" : "tools";
}

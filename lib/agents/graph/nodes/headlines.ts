import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { QuoteScraperState } from "../state";
import { getMarkdownFromUrl } from "@/lib/utils/jina";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Helper function to safely log objects
function safeLog(prefix: string, obj: any) {
  console.log(`\n[Headlines] ${prefix}:`, JSON.stringify(obj, (key, value) => {
    if (key === 'supabaseClient') return '[Supabase Client]';
    if (key === 'model') return '[Model Instance]';
    return value;
  }, 2));
}

// Create a tool for getting markdown content from JinaAI
const getMarkdownTool = tool(async ({ url }) => {
  try {
    safeLog('Getting markdown from URL', { url });
    const markdown = await getMarkdownFromUrl(url);
    safeLog('Markdown response', { length: markdown.length });
    return markdown;
  } catch (error) {
    console.error('Error getting markdown:', error);
    return "";
  }
}, {
  name: "get_markdown",
  description: "Get markdown content from a URL using JinaAI",
  schema: z.object({
    url: z.string().describe("URL to fetch markdown from"),
  }),
});

// Create a tool for finding headlines with quotes
const findHeadlinesTool = tool(async ({ markdown, parentUrl }) => {
  try {
    safeLog('Finding headlines for URL', { parentUrl, markdownLength: markdown.length });
    const prompt = `Given the following markdown content from ${parentUrl}, extract all article URLs and their headlines.
    Return the results in this exact format:
    {
      "articles": [
        {
          "url": "article_url",
          "headline": "article_headline"
        }
      ]
    }
    If no articles are found, return { "articles": [] }
    
    Article text:
    ${markdown}`;

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    });

    const response = await model.invoke([new HumanMessage(prompt)]);
    safeLog('Model response for headlines', { content: response.content });
    
    try {
      const result = JSON.parse(response.content);
      safeLog('Parsed headlines result', result);
      return result;
    } catch (error) {
      console.error("Error parsing headlines response:", error);
      return { articles: [] };
    }
  } catch (error) {
    console.error('Error in find headlines tool:', error);
    return { articles: [] };
  }
}, {
  name: "find_headlines",
  description: "Find article URLs and headlines in markdown content",
  schema: z.object({
    markdown: z.string(),
    parentUrl: z.string(),
  }),
});

// Create the tools array
const tools = [getMarkdownTool, findHeadlinesTool];

// Create the model and bind tools
const model = new ChatOpenAI({
  temperature: 0,
}).bindTools(tools);

// Create the headlines agent node
export const headlinesNode = new ToolNode(tools);

// Function to call the model
export async function callModel(state: typeof QuoteScraperState.State) {
  safeLog('Entering callModel with state', {
    hasMessages: state.messages?.length > 0,
    messageCount: state.messages?.length,
    lastMessage: state.messages?.[state.messages.length - 1]
  });

  const { messages } = state;
  if (!messages?.length) {
    safeLog('No messages in state');
    return {
      messages: [
        new AIMessage({
          content: "No messages in state. Please provide URLs to process.",
        })
      ]
    };
  }

  // Handle case where message content is an array
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && typeof lastMessage.content === 'object' && Array.isArray(lastMessage.content)) {
    const lastContent = lastMessage.content[lastMessage.content.length - 1];
    if (lastContent?.kwargs?.content) {
      // Create a new message with the correct content
      messages[messages.length - 1] = new HumanMessage({
        content: lastContent.kwargs.content
      });
    }
  }

  safeLog('Processing messages', { 
    messages: messages.map(m => ({
      type: m instanceof BaseMessage ? m.constructor.name : 'Unknown',
      content: m.content
    }))
  });

  const result = await model.invoke(messages);
  safeLog('Model response', { 
    type: result instanceof BaseMessage ? result.constructor.name : 'Unknown',
    content: result.content 
  });

  return {
    messages: [result]
  };
}

// Function to route messages
export function routeHeadlines(state: typeof QuoteScraperState.State) {
  safeLog('Entering routeHeadlines with state', {
    hasMessages: state.messages?.length > 0,
    messageCount: state.messages?.length,
    lastMessage: state.messages?.[state.messages.length - 1],
    hasArticles: state.articles?.length > 0,
    articleCount: state.articles?.length
  });

  const { messages } = state;
  if (!messages?.length) {
    console.error("No messages in state");
    return "__end__";
  }

  const lastMessage = messages[messages.length - 1];
  safeLog('Last message in route', {
    content: lastMessage.content,
    hasToolCalls: !!lastMessage.tool_calls?.length,
    toolCallCount: lastMessage.tool_calls?.length
  });

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    safeLog('Routing to tools node', { toolCalls: lastMessage.tool_calls });
    return "tools";
  }

  // If we have articles in the state, continue to filter
  if (state.articles?.length > 0) {
    safeLog('Routing to filter node', { articleCount: state.articles.length });
    return "filter";
  }
  
  // Otherwise end
  safeLog('Routing to end');
  return "__end__";
}

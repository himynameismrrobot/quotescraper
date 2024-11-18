import { StateGraph, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { BinaryOperator } from '@langchain/langgraph/dist/channels';

// Initialize OpenAI model
const model = new ChatOpenAI({ temperature: 0 });

// Add type definitions
interface GraphState {
  messages: BaseMessage[];
  scratchpad: string[];
  supabase: any;
  urls: any[];
  current_url_index: number;
  logs: string[];
  articles: any[];
}

// Define our tools using the DynamicTool class
const tools = [
  new DynamicTool({
    name: 'fetch_urls',
    description: 'Fetch URLs from the database. Returns a list of URLs to process.',
    func: async (input: string) => {
      console.log('fetchUrls: Starting function with input:', input);
      
      try {
        const response = {
          action: 'fetch_urls',
          status: 'success',
          urls: [
            { url: 'http://example.com' },
            { url: 'http://example.org' }
          ]
        };

        return new AIMessage({
          content: JSON.stringify(response),
          additional_kwargs: {
            tool_calls: [{
              id: `fetch_urls_${Date.now()}`,
              type: 'function',
              function: {
                name: 'fetch_urls',
                arguments: input
              }
            }]
          }
        });
      } catch (error) {
        return new AIMessage({
          content: JSON.stringify({
            action: 'fetch_urls',
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        });
      }
    }
  }),
  new DynamicTool({
    name: 'extract_articles',
    description: 'Extract articles from a URL. Input should be a URL to process.',
    func: async (input: string) => {
      try {
        const { url } = JSON.parse(input);
        
        if (!url) {
          throw new Error('No URL provided');
        }

        const response = {
          action: 'extract_articles',
          status: 'success',
          url,
          article: {
            url,
            content: 'Extracted content here'
          }
        };

        return new AIMessage({
          content: JSON.stringify(response),
          additional_kwargs: {
            tool_calls: [{
              id: `extract_articles_${Date.now()}`,
              type: 'function',
              function: {
                name: 'extract_articles',
                arguments: input
              }
            }]
          }
        });
      } catch (error) {
        return new AIMessage({
          content: JSON.stringify({
            action: 'extract_articles',
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        });
      }
    }
  })
];

// Create the agent using createReactAgent
const agent = createReactAgent({
  llm: model,
  tools,
  prompt: `You are an agent designed to crawl URLs and extract articles.
    Your goal is to:
    1. Fetch URLs from the database using the fetch_urls tool
    2. Extract articles from each URL using the extract_articles tool
    3. Save the articles
    4. Update timestamps
    
    Process one URL at a time and ensure each article is properly extracted before moving to the next URL.
    
    Available tools:
    - fetch_urls: Use this first to get the list of URLs to process
    - extract_articles: Use this for each URL to extract its content
    
    Respond with your next action or the final result.`
});

// Create and configure the graph
export function createCrawlerGraph(supabase: any) {
  console.log('Creating graph...');

  const workflow = new StateGraph<GraphState>({
    channels: {
      messages: {
        value: (a: BaseMessage[], b: BaseMessage[]) => b,
        default: () => []
      },
      scratchpad: {
        value: (a: string[], b: string[]) => b,
        default: () => []
      },
      supabase: {
        value: (a: any, b: any) => b,
        default: () => supabase
      },
      urls: {
        value: (a: any[] | undefined, b: any[]) => b,
        default: () => []
      },
      current_url_index: {
        value: (a: number | undefined, b: number) => b,
        default: () => 0
      },
      logs: {
        value: (a: string[] | undefined, b: string[]) => b,
        default: () => []
      },
      articles: {
        value: (a: any[] | undefined, b: any[]) => b,
        default: () => []
      }
    }
  });

  // Create tool execution node
  const toolExecutor = new ToolNode({ tools });

  // Add nodes with proper names
  workflow.addNode("__start__", async () => ({
    messages: [new HumanMessage("Start the URL crawling process")]
  }));
  
  workflow.addNode("agent", agent);
  workflow.addNode("tools", toolExecutor);

  // Configure the flow with proper conditional edges
  workflow.addConditionalEdges(
    "__start__",
    (state) => "agent"
  );

  workflow.addConditionalEdges(
    "agent",
    (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.content.includes("finish")) {
        return "end";
      }
      return "tools";
    },
    {
      tools: "tools",
      end: END
    }
  );

  // From tools back to agent
  workflow.addEdge("tools", "agent");

  console.log('Compiling graph...');
  return workflow.compile();
}

// Example invocation for debugging
async function runCrawler() {
  const supabaseMock = {
    from: () => ({
      select: async () => ({
        data: [{ url: 'http://example.com' }, { url: 'http://example.org' }],
        error: null,
      }),
    }),
  };

  const crawlerGraph = createCrawlerGraph(supabaseMock);
  console.log('Running crawler...');
  
  const result = await crawlerGraph.invoke({
    messages: [new HumanMessage("Start the URL crawling process")],
    scratchpad: [],
    supabase: supabaseMock,
    urls: [],
    current_url_index: 0,
    logs: [],
    articles: []
  }, {
    configurable: {
      thread_id: `crawler_${Date.now()}`,
      checkpoint_ns: "url_crawler"
    }
  });
  
  console.log('Crawler result:', result);
}

runCrawler().catch(console.error);

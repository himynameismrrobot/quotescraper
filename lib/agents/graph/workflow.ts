import { StateGraph } from "@langchain/langgraph";
import { QuoteScraperState } from "./state";
import { headlinesNode, routeHeadlines, callModel } from "./nodes/headlines";
import { filterNode, routeFilter } from "./nodes/filter";
import { quoteExtractionNode, routeQuoteExtraction, fanOutArticles } from "./nodes/quote-extraction";
import { quoteValidationNode, routeQuoteValidation } from "./nodes/quote-validation";
import { deduplicationNode, routeDeduplication } from "./nodes/deduplication";
import { storageNode, routeStorage } from "./nodes/storage";
import { MemorySaver } from "@langchain/langgraph";
import { AIMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { Database } from "@/types/supabase";

export interface WorkflowConfig {
  similarityThreshold: number;
  maxParallelExtractions: number;
  supabaseClient: Database;
  threadId: string;
}

// Helper function to safely stringify objects with circular references
function safeStringify(obj: any, space: number = 2): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (key === 'supabaseClient') return '[Supabase Client]';
    if (key === 'model') return '[Model Instance]';
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }, space);
}

// Helper function to safely log objects
function safeLog(prefix: string, obj: any) {
  console.log(`\n[Workflow] ${prefix}:`, safeStringify(obj));
}

export async function createQuoteScraperWorkflow(config: WorkflowConfig) {
  const safeConfig = {
    similarityThreshold: config.similarityThreshold,
    maxParallelExtractions: config.maxParallelExtractions,
    threadId: config.threadId,
  };
  console.log("\n[Workflow] Creating workflow with config:", safeStringify(safeConfig));
  
  // Create the workflow graph
  const workflow = new StateGraph(QuoteScraperState)
    // Add nodes
    .addNode("agent", callModel)
    .addNode("headlines", headlinesNode)
    .addNode("filter", filterNode)
    .addNode("quote_extraction", quoteExtractionNode)
    .addNode("quote_validation", quoteValidationNode)
    .addNode("deduplication", deduplicationNode)
    .addNode("storage", storageNode)
    
    // Add edges for sequential processing
    .addEdge("__start__", "agent")
    .addEdge("agent", "headlines")
    .addConditionalEdges("headlines", routeHeadlines)
    .addEdge("headlines", "filter")
    .addConditionalEdges("filter", routeFilter)
    
    // Add parallel processing for quote extraction
    .addNode("fan_out", fanOutArticles)
    .addEdge("filter", "fan_out")
    .addEdge("fan_out", "quote_extraction")
    .addConditionalEdges("quote_extraction", routeQuoteExtraction)
    
    // Continue with sequential processing
    .addEdge("quote_extraction", "quote_validation")
    .addConditionalEdges("quote_validation", routeQuoteValidation)
    .addEdge("quote_validation", "deduplication")
    .addConditionalEdges("deduplication", routeDeduplication)
    .addEdge("deduplication", "storage")
    .addConditionalEdges("storage", routeStorage);

  console.log("\n[Workflow] Workflow graph created");

  // Initialize memory to persist state between runs
  const checkpointer = new MemorySaver();
  console.log("\n[Workflow] Memory saver initialized");

  // Compile the workflow
  console.log("\n[Workflow] Compiling workflow");
  const app = workflow.compile({
    checkpointer,
    configurable: {
      similarityThreshold: config.similarityThreshold,
      maxParallelExtractions: config.maxParallelExtractions,
      supabaseClient: config.supabaseClient,
      thread_id: config.threadId,
      checkpoint_ns: "quote_scraper",
    },
  });
  console.log("\n[Workflow] Workflow compiled");

  return app;
}

export async function runWorkflow(
  app: ReturnType<typeof createQuoteScraperWorkflow>,
  monitoredUrls: string[],
  config: WorkflowConfig
) {
  safeLog('Starting workflow with URLs', { monitoredUrls });

  // Create initial state with messages
  const initialState = {
    messages: [
      new HumanMessage({
        content: JSON.stringify({
          type: "start_crawl",
          urls: monitoredUrls
        })
      })
    ],
    articles: [],
    filteredArticles: [],
    pendingQuotes: [],
    validatedQuotes: [],
    config: {
      similarityThreshold: config.similarityThreshold,
      maxParallelExtractions: config.maxParallelExtractions,
      supabaseClient: config.supabaseClient,
    },
  };

  safeLog('Initial state', initialState);

  // Run the workflow with thread_id and checkpoint_ns
  const finalState = await app.invoke(initialState, {
    configurable: {
      thread_id: config.threadId,
      checkpoint_ns: "quote_scraper",
    },
  });

  safeLog('Final state', finalState);
  return finalState;
}

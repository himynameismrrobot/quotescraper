import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createQuoteScraperWorkflow } from '@/lib/agents/graph/workflow';
import { Database } from '@/types/supabase';
import { AIMessage } from '@langchain/core/messages';

export async function POST(request: Request) {
  try {
    // Get the request body
    const { urls, config } = await request.json();

    // Get the bearer token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the token
    const { data: { user }, error: verifyError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (verifyError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Initialize workflow state first
    const initialState = {
      messages: {
        content: [
          new AIMessage("Starting workflow..."),
          new AIMessage(JSON.stringify({ type: "start_crawl", urls })),
        ],
      },
      articles: [],
      filteredArticles: [],
      pendingQuotes: [],
      validatedQuotes: [],
      config: {
        similarityThreshold: config.similarityThreshold,
        maxParallelExtractions: config.maxParallelExtractions,
        supabaseClient: supabase,
      },
    };

    // Create and run workflow after state is ready
    const workflow = await createQuoteScraperWorkflow({
      ...config,
      supabaseClient: supabase,
    });

    // Run the workflow with the initial state
    const result = await workflow.invoke(initialState, {
      configurable: {
        thread_id: config.threadId,
        checkpoint_ns: "quote_scraper",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in workflow route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

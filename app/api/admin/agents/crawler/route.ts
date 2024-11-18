import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { createQuoteScraperWorkflow, runWorkflow } from '@/lib/agents/graph/workflow'

export async function POST(req: Request) {
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  const writeToStream = async (message: string, data?: any) => {
    console.log('Writing to stream:', message, data || '')
    await writer.write(
      encoder.encode(
        JSON.stringify({
          node: 'system',
          values: { logs: [message] },
          timestamp: new Date().toISOString(),
          data
        }) + '\n'
      )
    )
  }

  try {
    await writeToStream('Starting crawler agent...')
    
    const cookieStore = cookies()
    console.log('Got cookie store')
    
    const supabase = createRouteHandlerClient<Database>({ 
      cookies: () => Promise.resolve(cookieStore)
    })
    console.log('Created Supabase client')

    await writeToStream('Checking authentication...')
    const authHeader = req.headers.get('Authorization')
    console.log('Got auth header:', authHeader ? 'Present' : 'Missing')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header')
    }
    const token = authHeader.split(' ')[1]

    const { data: { user }, error: sessionError } = await supabase.auth.getUser(token)
    console.log('Auth check result:', { userId: user?.id, error: sessionError })

    if (sessionError || !user) {
      console.error('Session error:', sessionError)
      throw new Error('Invalid session')
    }

    await writeToStream('Getting monitored URLs...')
    const { data: monitoredUrls } = await supabase
      .from('monitored_urls')
      .select('url')

    if (!monitoredUrls || monitoredUrls.length === 0) {
      throw new Error('No monitored URLs found')
    }

    const urls = monitoredUrls.map(u => u.url)
    await writeToStream('Found monitored URLs', { count: urls.length })

    // Create and run the LangGraph workflow
    const workflow = await createQuoteScraperWorkflow({
      similarityThreshold: 0.85,
      maxParallelExtractions: 3,
      supabaseClient: supabase,
    })

    await writeToStream('Created workflow, starting execution...')

    const finalState = await runWorkflow(workflow, urls)

    await writeToStream('Workflow completed', {
      articles: finalState.articles.length,
      filteredArticles: finalState.filteredArticles.length,
      pendingQuotes: finalState.pendingQuotes.length,
      validatedQuotes: finalState.validatedQuotes.length,
    })

    writer.close()
    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in crawler route:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    await writeToStream('Error: ' + errorMessage)
    writer.close()
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
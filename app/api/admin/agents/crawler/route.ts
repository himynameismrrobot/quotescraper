import { NextResponse } from 'next/server'
import { createCrawlerGraph } from '@/lib/agents/url-crawler'

export async function POST() {
  try {
    const graph = createCrawlerGraph()
    
    const finalState = await graph.invoke({})

    return NextResponse.json({ 
      success: true,
      logs: finalState.logs
    })

  } catch (error) {
    console.error('Crawler agent error:', error)
    return NextResponse.json(
      { error: 'Failed to run crawler agent' },
      { status: 500 }
    )
  }
} 
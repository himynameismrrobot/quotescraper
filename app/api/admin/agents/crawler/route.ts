import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Database } from '@/types/supabase'
import { extractArticleLinks } from '@/lib/crawler'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    // Get monitored URLs from database
    const { data: urls, error: urlError } = await supabase
      .from('monitored_urls')
      .select('*')
      .eq('active', true)

    if (urlError) throw urlError

    // Log the start of crawler run
    const { error: logError } = await supabase
      .from('agent_logs')
      .insert({
        agent: 'url_crawler',
        status: 'started',
        details: { urls_to_crawl: urls.length }
      })

    if (logError) throw logError

    // Process each URL
    for (const url of urls) {
      try {
        // Extract article links
        const articles = await extractArticleLinks(url.url)
        
        // Store new articles
        const { error: insertError } = await supabase
          .from('staged_articles')
          .insert(
            articles.map(article => ({
              url: article.url,
              headline: article.headline,
              parent_url: url.url,
              discovered_at: new Date().toISOString()
            }))
          )
          .select()

        if (insertError) throw insertError

        // Update last crawl timestamp
        const { error: updateError } = await supabase
          .from('monitored_urls')
          .update({ last_crawled_at: new Date().toISOString() })
          .eq('id', url.id)

        if (updateError) throw updateError

        // Log success for this URL
        await supabase
          .from('agent_logs')
          .insert({
            agent: 'url_crawler',
            status: 'success',
            details: {
              url: url.url,
              articles_found: articles.length
            }
          })

      } catch (error) {
        // Log error for this specific URL but continue with others
        await supabase
          .from('agent_logs')
          .insert({
            agent: 'url_crawler',
            status: 'error',
            details: {
              url: url.url,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
      }
    }

    // Log completion
    await supabase
      .from('agent_logs')
      .insert({
        agent: 'url_crawler',
        status: 'completed',
        details: { urls_processed: urls.length }
      })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Crawler agent error:', error)
    return NextResponse.json(
      { error: 'Failed to run crawler agent' },
      { status: 500 }
    )
  }
} 
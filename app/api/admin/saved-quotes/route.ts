import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/utils/admin-check'

export async function GET() {
  try {
    // Check admin access
    const { error: adminError, status } = await checkAdminAccess()
    if (adminError) {
      return NextResponse.json({ error: adminError }, { status })
    }

    const supabase = await createClient()
    
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select(`
        id,
        summary,
        raw_quote_text,
        speaker:speakers!inner(name),
        article_date,
        article_url,
        article_headline,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    const transformedQuotes = quotes.map(quote => ({
      id: quote.id,
      summary: quote.summary,
      raw_quote_text: quote.raw_quote_text,
      speaker_name: quote.speaker.name,
      article_date: quote.article_date,
      article_url: quote.article_url,
      article_headline: quote.article_headline,
      created_at: quote.created_at
    }))

    return NextResponse.json(transformedQuotes)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved quotes' },
      { status: 500 }
    )
  }
} 
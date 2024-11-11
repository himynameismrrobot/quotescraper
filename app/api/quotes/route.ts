import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    
    // First, get total count for pagination
    const { count } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })

    // Then get the quotes for current page
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select(`
        id,
        summary,
        raw_quote_text,
        article_date,
        article_url,
        article_headline,
        parent_monitored_url,
        parent_monitored_url_logo,
        created_at,
        updated_at,
        speaker:speakers(
          *,
          organization:organizations(*)
        ),
        reactions:quote_reactions(
          *,
          users:quote_reactions_users(
            user:users(*)
          )
        ),
        comments:comments!quote_id(count)
      `)
      .order('article_date', { ascending: false }) // Sort by article_date instead of created_at
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Transform the data to match the expected format
    const transformedQuotes = quotes.map(quote => ({
      ...quote,
      reactions: quote.reactions?.map(reaction => ({
        emoji: reaction.emoji,
        users: reaction.users?.map(u => ({ id: u.user.id })) || []
      })) || [],
      comments: quote.comments?.[0]?.count || 0
    }));

    // Add pagination metadata
    const hasMore = Boolean(count && offset + quotes.length < count);

    return NextResponse.json({
      quotes: transformedQuotes,
      hasMore,
      total: count
    })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const json = await request.json()
    
    const { data: quote, error } = await supabase
      .from('quotes')
      .insert([
        {
          summary: json.summary,
          raw_quote_text: json.rawQuoteText,
          article_date: json.articleDate,
          article_url: json.articleUrl,
          article_headline: json.articleHeadline,
          speaker_id: json.speakerId,
          parent_monitored_url: json.articleUrl,
          content_vector: json.contentVector,
          summary_vector: json.summaryVector
        }
      ])
      .select(`
        *,
        speaker:speakers(
          *,
          organization:organizations(*)
        ),
        reactions:quote_reactions(
          *,
          users:quote_reactions_users(
            user:users(*)
          )
        ),
        comments:comments(count)
      `)
      .single()

    if (error) throw error

    // Transform the data to match the expected format
    const transformedQuote = {
      ...quote,
      reactions: quote.reactions?.map(reaction => ({
        emoji: reaction.emoji,
        users: reaction.users?.map(u => ({ id: u.user.id })) || []
      })) || [],
      comments: quote.comments?.length || 0
    }

    return NextResponse.json(transformedQuote)
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
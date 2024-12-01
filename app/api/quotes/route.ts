import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    console.log('Quotes API called');
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    const tab = searchParams.get('tab') || 'all'
    
    console.log('Query params:', { limit, offset, tab });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError

    // Base query for all quotes
    let quotesQuery = supabase
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
        comment_count,
        speaker:speakers!inner(
          id,
          name,
          image_url,
          organization:organizations(
            id,
            name,
            logo_url
          )
        ),
        reactions:quote_reactions(
          emoji,
          users:quote_reactions_users(
            user_id
          )
        )
      `, { count: 'exact' })

    // Apply tab filters
    if (tab === 'following' && user) {
      // First get the user's follows
      const { data: follows } = await supabase
        .from('following')
        .select('speaker_id, org_id')
        .eq('user_id', user.id)

      if (follows && follows.length > 0) {
        const speakerIds = follows
          .filter(f => f.speaker_id)
          .map(f => f.speaker_id)

        const orgIds = follows
          .filter(f => f.org_id)
          .map(f => f.org_id)

        if (speakerIds.length > 0 || orgIds.length > 0) {
          if (speakerIds.length > 0 && orgIds.length > 0) {
            // If we have both speaker and org follows, use two separate queries and union them
            const speakerQuotes = supabase
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
                comment_count,
                speaker:speakers!inner(
                  id,
                  name,
                  image_url,
                  organization:organizations(
                    id,
                    name,
                    logo_url
                  )
                ),
                reactions:quote_reactions(
                  emoji,
                  users:quote_reactions_users(
                    user_id
                  )
                )
              `)
              .in('speaker.id', speakerIds)

            const orgQuotes = supabase
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
                comment_count,
                speaker:speakers!inner(
                  id,
                  name,
                  image_url,
                  organization:organizations(
                    id,
                    name,
                    logo_url
                  )
                ),
                reactions:quote_reactions(
                  emoji,
                  users:quote_reactions_users(
                    user_id
                  )
                )
              `)
              .in('speaker.organization_id', orgIds)

            const [speakerResults, orgResults] = await Promise.all([
              speakerQuotes,
              orgQuotes
            ])

            // Combine and deduplicate results
            const allQuotes = [
              ...(speakerResults.data || []),
              ...(orgResults.data || [])
            ]

            // Remove duplicates based on quote ID
            const uniqueQuotes = Array.from(
              new Map(allQuotes.map(quote => [quote.id, quote])).values()
            )

            // Sort by created_at
            const sortedQuotes = uniqueQuotes.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )

            // Paginate manually
            const paginatedQuotes = sortedQuotes.slice(offset, offset + limit)

            return NextResponse.json({
              quotes: paginatedQuotes.map(quote => ({
                ...quote,
                reactions: quote.reactions?.map(reaction => ({
                  emoji: reaction.emoji,
                  users: reaction.users?.map(u => ({ id: u.user_id })) || []
                })) || [],
                comments: quote.comment_count || 0
              })),
              hasMore: offset + limit < sortedQuotes.length,
              total: sortedQuotes.length
            })
          } else if (speakerIds.length > 0) {
            quotesQuery = quotesQuery.in('speaker.id', speakerIds)
          } else {
            quotesQuery = quotesQuery.in('speaker.organization_id', orgIds)
          }
        } else {
          // If no follows, return no results
          quotesQuery = quotesQuery.eq('id', 'no-results')
        }
      } else {
        // If no follows, return no results
        quotesQuery = quotesQuery.eq('id', 'no-results')
      }
    }

    // Only execute the regular query if we haven't already returned results
    const { data: quotes, error, count } = await quotesQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Query error:', error)
      throw error
    }

    // Transform the data
    const transformedQuotes = quotes?.map(quote => ({
      ...quote,
      reactions: quote.reactions?.map(reaction => ({
        emoji: reaction.emoji,
        users: reaction.users?.map(u => ({ id: u.user_id })) || []
      })) || [],
      comments: quote.comment_count || 0
    })) || []

    return NextResponse.json({
      quotes: transformedQuotes,
      hasMore: Boolean(count && offset + limit < count),
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
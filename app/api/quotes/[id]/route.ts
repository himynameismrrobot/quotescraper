import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const params = await context.params
    const id = params.id
    
    // Use Promise.all to make parallel requests
    const [quoteResult, commentsResult] = await Promise.all([
      supabase
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
        .eq('id', id)
        .single(),

      supabase
        .from('comments')
        .select(`
          id,
          text,
          created_at,
          user:users!inner(
            id,
            name,
            image
          )
        `)
        .eq('quote_id', id)
        .order('created_at', { ascending: false })
    ])

    if (quoteResult.error) throw quoteResult.error
    if (!quoteResult.data) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      )
    }

    // Transform and combine the data
    const transformedData = {
      ...quoteResult.data,
      reactions: quoteResult.data.reactions?.map(reaction => ({
        emoji: reaction.emoji,
        users: reaction.users?.map(u => ({ id: u.user_id })) || []
      })) || [],
      comments: commentsResult.data || []
    }

    return NextResponse.json(transformedData)
  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const params = await context.params
    const id = params.id
    const json = await request.json()
    
    const { data: quote, error } = await supabase
      .from('quotes')
      .update({
        summary: json.summary,
        raw_quote_text: json.rawQuoteText,
        article_date: json.articleDate,
        article_url: json.articleUrl,
        article_headline: json.articleHeadline,
        speaker_id: json.speakerId,
        parent_monitored_url: json.articleUrl,
        content_vector: json.contentVector,
        summary_vector: json.summaryVector
      })
      .eq('id', id)
      .select(`
        *,
        speaker:speakers(
          *,
          organization:organizations(*)
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json(quote)
  } catch (error) {
    console.error('Error updating quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const params = await context.params
    const id = params.id
    
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id)

    if (error) throw error

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
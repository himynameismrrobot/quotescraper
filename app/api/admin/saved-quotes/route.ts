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
    
    const { data: quotes, error: dbError } = await supabase
      .from('quotes')
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
        )
      `)
      .order('article_date', { ascending: false })

    if (dbError) throw dbError

    // Transform the data to match the expected format
    const transformedQuotes = quotes?.map(quote => ({
      id: quote.id,
      summary: quote.summary,
      raw_quote_text: quote.raw_quote_text,
      article_date: quote.article_date,
      article_url: quote.article_url,
      article_headline: quote.article_headline,
      speaker_name: quote.speaker.name,
      reactions: quote.reactions?.map(reaction => ({
        emoji: reaction.emoji,
        users: reaction.users?.map(u => ({ id: u.user.id })) || []
      })) || []
    }));

    return NextResponse.json(transformedQuotes)
  } catch (error) {
    console.error('Error fetching saved quotes:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
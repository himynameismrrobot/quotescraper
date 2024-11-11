import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/utils/admin-check'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin access
    const { error: adminError, status } = await checkAdminAccess()
    if (adminError) {
      return NextResponse.json({ error: adminError }, { status })
    }

    const supabase = await createClient()
    
    const { data: quote, error: dbError } = await supabase
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
      .eq('id', params.id)
      .single()

    if (dbError) throw dbError
    if (!quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      )
    }

    // Transform the data to match the expected format
    const transformedQuote = {
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
    };

    return NextResponse.json(transformedQuote)
  } catch (error) {
    console.error('Error fetching saved quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin access
    const { error: adminError, status } = await checkAdminAccess()
    if (adminError) {
      return NextResponse.json({ error: adminError }, { status })
    }

    const supabase = await createClient()
    
    const { error: dbError } = await supabase
      .from('quotes')
      .delete()
      .eq('id', params.id)

    if (dbError) throw dbError

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting saved quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
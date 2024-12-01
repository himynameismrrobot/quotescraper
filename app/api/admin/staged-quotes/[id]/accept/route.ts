import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/utils/admin-check'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin access
    const { error: adminError, status } = await checkAdminAccess()
    if (adminError) {
      return NextResponse.json({ error: adminError }, { status })
    }

    const params = await context.params
    const supabase = await createClient()

    // First, get the staged quote
    const { data: stagedQuote, error: fetchError } = await supabase
      .from('quote_staging')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError) throw fetchError
    if (!stagedQuote) {
      return NextResponse.json(
        { error: 'Staged quote not found' },
        { status: 404 }
      )
    }

    // Check if speaker exists
    const { data: speaker, error: speakerError } = await supabase
      .from('speakers')
      .select('*')
      .eq('name', stagedQuote.speaker_name)
      .single()

    if (speakerError && speakerError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw speakerError
    }

    if (!speaker) {
      return NextResponse.json(
        { message: 'Speaker not found. Please add the speaker first.' },
        { status: 400 }
      )
    }

    // Insert into saved quotes
    const { error: insertError } = await supabase
      .from('quotes')
      .insert([{
        summary: stagedQuote.summary,
        raw_quote_text: stagedQuote.raw_quote_text,
        speaker_id: speaker.id,
        article_date: stagedQuote.article_date,
        article_url: stagedQuote.article_url,
        article_headline: stagedQuote.article_headline,
        content_vector: stagedQuote.content_vector,
        summary_vector: stagedQuote.summary_vector,
        parent_monitored_url: stagedQuote.parent_monitored_url
      }])

    if (insertError) throw insertError

    // Delete from staged quotes
    const { error: deleteError } = await supabase
      .from('quote_staging')
      .delete()
      .eq('id', params.id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error accepting quote:', error)
    return NextResponse.json(
      { error: 'Failed to accept quote' },
      { status: 500 }
    )
  }
}
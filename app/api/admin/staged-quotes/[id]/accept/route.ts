import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // First get the staged quote
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

    // Find the speaker
    const { data: speaker, error: speakerError } = await supabase
      .from('speakers')
      .select('id')
      .eq('name', stagedQuote.speaker_name)
      .single()

    if (speakerError || !speaker) {
      return NextResponse.json(
        { message: 'Speaker not found. Please add the speaker first.' },
        { status: 400 }
      )
    }

    // Create the saved quote
    const { data: savedQuote, error: saveError } = await supabase
      .from('quotes')
      .insert([{
        summary: stagedQuote.summary,
        raw_quote_text: stagedQuote.raw_quote_text,
        article_date: stagedQuote.article_date,
        article_url: stagedQuote.article_url,
        article_headline: stagedQuote.article_headline,
        speaker_id: speaker.id,
        parent_monitored_url: stagedQuote.parent_monitored_url,
        parent_monitored_url_logo: stagedQuote.parent_monitored_url_logo,
        content_vector: stagedQuote.content_vector,
        summary_vector: stagedQuote.summary_vector
      }])
      .select()
      .single()

    if (saveError) throw saveError

    // Delete the staged quote
    const { error: deleteError } = await supabase
      .from('quote_staging')
      .delete()
      .eq('id', params.id)

    if (deleteError) throw deleteError

    return NextResponse.json(savedQuote)
  } catch (error) {
    console.error('Error accepting staged quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
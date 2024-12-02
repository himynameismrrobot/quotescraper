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
    
    // First get all staged quotes
    const { data: stagedQuotes, error: dbError } = await supabase
      .from('quote_staging')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('Database Error:', dbError)
      throw dbError
    }

    // Then get similar quotes for each quote that has a similar_to_staged_quote_id
    const quotesWithSimilar = await Promise.all(
      stagedQuotes.map(async (quote) => {
        let similarQuote = null;

        // If it has a similar staged quote reference
        if (quote.similar_to_staged_quote_id) {
          const { data: similarStaged } = await supabase
            .from('quote_staging')
            .select('*')
            .eq('id', quote.similar_to_staged_quote_id)
            .single()

          if (similarStaged) {
            similarQuote = {
              ...similarStaged,
              speaker: { name: similarStaged.speaker_name }
            };
          }
        }
        // If it has a similar saved quote reference
        else if (quote.similar_to_quote_id) {
          const { data: similarSaved } = await supabase
            .from('quotes')
            .select(`
              *,
              speaker:speakers (
                id,
                name
              )
            `)
            .eq('id', quote.similar_to_quote_id)
            .single()

          if (similarSaved) {
            similarQuote = similarSaved;
          }
        }

        return {
          ...quote,
          similar_staged_quote: quote.similar_to_staged_quote_id ? similarQuote : null,
          similar_saved_quote: quote.similar_to_quote_id ? similarQuote : null
        };
      })
    );

    return NextResponse.json(quotesWithSimilar)
  } catch (error) {
    console.error('Error fetching staged quotes:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
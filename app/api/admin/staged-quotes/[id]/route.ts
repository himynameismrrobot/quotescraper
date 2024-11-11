import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/utils/admin-check'

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    // Check admin access
    const { error: adminError, status } = await checkAdminAccess()
    if (adminError) {
      return NextResponse.json({ error: adminError }, { status })
    }

    const supabase = await createClient()
    const id = await context.params.id
    
    const { data: quote, error: dbError } = await supabase
      .from('quote_staging')
      .select('*')
      .eq('id', id)
      .single()

    if (dbError) throw dbError
    if (!quote) {
      return NextResponse.json(
        { error: 'Staged quote not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(quote)
  } catch (error) {
    console.error('Error fetching staged quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    // Check admin access
    const { error: adminError, status } = await checkAdminAccess()
    if (adminError) {
      return NextResponse.json({ error: adminError }, { status })
    }

    const supabase = await createClient()
    const json = await request.json()
    const id = await context.params.id
    
    const { data: quote, error: dbError } = await supabase
      .from('quote_staging')
      .update({
        summary: json.summary,
        raw_quote_text: json.rawQuoteText,
        article_date: json.articleDate,
        speaker_name: json.speakerName
      })
      .eq('id', id)
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json(quote)
  } catch (error) {
    console.error('Error updating staged quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const id = await context.params.id

    const { error } = await supabase
      .from('quote_staging')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to delete staged quote' }, { status: 500 })
  }
} 
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/utils/admin-check'

export async function GET(
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
    
    const { data: quote, error: dbError } = await supabase
      .from('quote_staging')
      .select('*')
      .eq('id', params.id)
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
    const json = await request.json()
    
    // First check if the quote exists
    const { data: existingQuote, error: fetchError } = await supabase
      .from('quote_staging')
      .select()
      .eq('id', params.id)
      .single()

    if (fetchError) {
      console.error('Database error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch quote from database' },
        { status: 500 }
      )
    }

    if (!existingQuote) {
      return NextResponse.json(
        { error: 'Staged quote not found' },
        { status: 404 }
      )
    }

    // Validate the input
    if (!json || typeof json !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Check if any fields are being updated
    const updates: any = {}
    if ('summary' in json) updates.summary = json.summary
    if ('raw_quote_text' in json) updates.raw_quote_text = json.raw_quote_text
    if ('article_date' in json) updates.article_date = json.article_datenpm r
    if ('speaker_name' in json) updates.speaker_name = json.speaker_name

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update the quote and return the updated row
    const { data, error: updateError } = await supabase
      .from('quote_staging')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Database error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update quote in database' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
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

    const { error: dbError } = await supabase
      .from('quote_staging')
      .delete()
      .eq('id', params.id)

    if (dbError) throw dbError

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting staged quote:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
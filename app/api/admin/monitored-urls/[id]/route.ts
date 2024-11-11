import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/utils/admin-check'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin access
    const { error, status } = await checkAdminAccess()
    if (error) {
      return NextResponse.json({ error }, { status })
    }

    const supabase = await createClient()
    
    const { data: monitoredUrl, error: dbError } = await supabase
      .from('monitored_urls')
      .select('*')
      .eq('id', params.id)
      .single()

    if (dbError) throw dbError
    if (!monitoredUrl) {
      return NextResponse.json(
        { error: 'Monitored URL not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(monitoredUrl)
  } catch (error) {
    console.error('Error fetching monitored URL:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check admin access
    const { error, status } = await checkAdminAccess()
    if (error) {
      return NextResponse.json({ error }, { status })
    }

    const supabase = await createClient()
    const json = await request.json()
    
    const { data: monitoredUrl, error: dbError } = await supabase
      .from('monitored_urls')
      .update({
        url: json.url,
        logo_url: json.logoUrl,
        last_crawled_at: json.lastCrawledAt
      })
      .eq('id', params.id)
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json(monitoredUrl)
  } catch (error) {
    console.error('Error updating monitored URL:', error)
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
    const { error, status } = await checkAdminAccess()
    if (error) {
      return NextResponse.json({ error }, { status })
    }

    const supabase = await createClient()
    
    const { error: dbError } = await supabase
      .from('monitored_urls')
      .delete()
      .eq('id', params.id)

    if (dbError) throw dbError

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting monitored URL:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
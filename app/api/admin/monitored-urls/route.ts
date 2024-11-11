import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/utils/admin-check'

export async function GET() {
  try {
    // Check admin access
    const { error, status } = await checkAdminAccess()
    if (error) {
      return NextResponse.json({ error }, { status })
    }

    const supabase = await createClient()
    
    const { data: monitoredUrls, error: dbError } = await supabase
      .from('monitored_urls')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    return NextResponse.json(monitoredUrls)
  } catch (error) {
    console.error('Error fetching monitored URLs:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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
      .insert([{
        url: json.url,
        logo_url: json.logoUrl,
        last_crawled_at: null
      }])
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json(monitoredUrl)
  } catch (error) {
    console.error('Error creating monitored URL:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
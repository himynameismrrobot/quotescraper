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
    
    // Remove the join with monitored_urls since the relationship doesn't exist
    const { data: stagedQuotes, error: dbError } = await supabase
      .from('quote_staging')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    return NextResponse.json(stagedQuotes)
  } catch (error) {
    console.error('Error fetching staged quotes:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
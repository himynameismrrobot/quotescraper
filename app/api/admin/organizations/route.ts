import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        logo_url,
        created_at,
        updated_at
      `)
      .order('name')

    if (error) throw error

    const transformedData = data.map(org => ({
      ...org,
      logo_url: org.logo_url
    }))

    return NextResponse.json(transformedData)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { error } = await supabase
      .from('organizations')
      .insert([body])

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to add organization' }, { status: 500 })
  }
} 
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    
    let query = supabase
      .from('speakers')
      .select(`
        *,
        organization:organizations(*)
      `)
      .order('name')
    
    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    const { data: speakers, error } = await query

    if (error) throw error

    return NextResponse.json(speakers)
  } catch (error) {
    console.error('Error fetching speakers:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const json = await request.json()
    
    const { data: speaker, error } = await supabase
      .from('speakers')
      .insert([
        {
          name: json.name,
          image_url: json.imageUrl,
          organization_id: json.organizationId
        }
      ])
      .select(`
        *,
        organization:organizations(*)
      `)
      .single()

    if (error) throw error

    return NextResponse.json(speaker)
  } catch (error) {
    console.error('Error creating speaker:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
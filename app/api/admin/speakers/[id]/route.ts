import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: speaker, error } = await supabase
      .from('speakers')
      .select(`
        *,
        organization:organizations(
          id,
          name,
          logo_url
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error
    if (!speaker) {
      return NextResponse.json(
        { error: 'Speaker not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(speaker)
  } catch (error) {
    console.error('Error fetching speaker:', error)
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
    const supabase = await createClient()
    const json = await request.json()
    
    const { data: speaker, error } = await supabase
      .from('speakers')
      .update({
        name: json.name,
        image_url: json.imageUrl,
        organization_id: json.organizationId || null
      })
      .eq('id', params.id)
      .select(`
        *,
        organization:organizations(
          id,
          name,
          logo_url
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json(speaker)
  } catch (error) {
    console.error('Error updating speaker:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/utils/admin-check'

export async function GET(request: Request) {
  try {
    // Check admin access
    const { error, status } = await checkAdminAccess()
    if (error) {
      return NextResponse.json({ error }, { status })
    }

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

    const { data: speakers, error: dbError } = await query
    if (dbError) throw dbError

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
    // Check admin access
    const { error, status } = await checkAdminAccess()
    if (error) {
      return NextResponse.json({ error }, { status })
    }

    const supabase = await createClient()
    const json = await request.json()
    
    const { data: speaker, error: dbError } = await supabase
      .from('speakers')
      .insert([{
        name: json.name,
        image_url: json.imageUrl,
        organization_id: json.organizationId || null
      }])
      .select(`
        *,
        organization:organizations(*)
      `)
      .single()

    if (dbError) throw dbError

    return NextResponse.json(speaker)
  } catch (error) {
    console.error('Error creating speaker:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    // Check admin access
    const { error, status } = await checkAdminAccess()
    if (error) {
      return NextResponse.json({ error }, { status })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const { error: dbError } = await supabase
      .from('speakers')
      .delete()
      .eq('id', id)

    if (dbError) throw dbError

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting speaker:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
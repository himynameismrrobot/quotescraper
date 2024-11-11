import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const id = await params.id
    
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users(*)
      `)
      .eq('quote_id', id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      comments: comments || [],
      hasMore: false,
      total: comments?.length || 0
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const json = await request.json()
    const id = await params.id
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert([
        {
          text: json.text,
          quote_id: id,
          user_id: session.user.id
        }
      ])
      .select(`
        *,
        user:users(*)
      `)
      .single()

    if (error) throw error

    return NextResponse.json(comment)
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const params = await context.params
    const id = params.id
    
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users(*),
        reactions:comment_reactions(
          id,
          emoji,
          users:comment_reactions_users(
            user_id
          )
        )
      `)
      .eq('quote_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const transformedComments = comments?.map(comment => ({
      ...comment,
      reactions: comment.reactions?.map(reaction => ({
        emoji: reaction.emoji,
        users: reaction.users?.map(u => ({ id: u.user_id })) || []
      })) || []
    }));

    return NextResponse.json({
      comments: transformedComments || [],
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const params = await context.params
    const id = params.id
    
    const json = await request.json()
    
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
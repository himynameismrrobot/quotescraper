import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const id = await context.params.id
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.error('Auth error:', userError); // Debug log
      throw userError;
    }
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { emoji } = await request.json()
    console.log('Processing reaction:', { id, emoji, userId: user.id }); // Debug log

    // First check if reaction already exists
    const { data: existingReaction } = await supabase
      .from('comment_reactions')
      .select('id')
      .eq('comment_id', id)
      .eq('emoji', emoji)
      .single()

    let reactionId: string

    if (existingReaction) {
      reactionId = existingReaction.id
      console.log('Found existing reaction:', reactionId); // Debug log
    } else {
      // Create new reaction
      const { data: newReaction, error: reactionError } = await supabase
        .from('comment_reactions')
        .insert({
          comment_id: id,
          emoji: emoji
        })
        .select('id')
        .single()

      if (reactionError) {
        console.error('Reaction creation error:', reactionError); // Debug log
        throw reactionError;
      }
      if (!newReaction) throw new Error('Failed to create reaction')
      
      reactionId = newReaction.id
      console.log('Created new reaction:', reactionId); // Debug log
    }

    // Add user to reaction
    const { error: userReactionError } = await supabase
      .from('comment_reactions_users')
      .insert({
        comment_reaction_id: reactionId,
        user_id: user.id
      })

    if (userReactionError && userReactionError.code !== '23505') { // Ignore unique constraint violations
      console.error('User reaction error:', userReactionError); // Debug log
      throw userReactionError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding reaction:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const id = await context.params.id
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { emoji } = await request.json()

    // Get the reaction ID
    const { data: reaction } = await supabase
      .from('comment_reactions')
      .select('id')
      .eq('comment_id', id)
      .eq('emoji', emoji)
      .single()

    if (reaction) {
      // Remove user from reaction
      const { error: deleteError } = await supabase
        .from('comment_reactions_users')
        .delete()
        .match({
          comment_reaction_id: reaction.id,
          user_id: user.id
        })

      if (deleteError) throw deleteError

      // Check if this was the last user
      const { count } = await supabase
        .from('comment_reactions_users')
        .select('*', { count: 'exact', head: true })
        .eq('comment_reaction_id', reaction.id)

      // If no users left, delete the reaction
      if (count === 0) {
        const { error: reactionDeleteError } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('id', reaction.id)

        if (reactionDeleteError) throw reactionDeleteError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing reaction:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
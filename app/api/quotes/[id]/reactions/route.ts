import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = await params.id
  try {
    const supabase = await createClient()
    
    const { data: reactions, error } = await supabase
      .from('quote_reactions')
      .select(`
        *,
        users:quote_reactions_users(
          user:users(*)
        )
      `)
      .eq('quote_id', id)

    if (error) throw error

    return NextResponse.json(reactions)
  } catch (error) {
    console.error('Error fetching reactions:', error)
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
    const { emoji } = await request.json()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if reaction already exists
    const { data: existingReaction } = await supabase
      .from('quote_reactions')
      .select('id')
      .eq('quote_id', id)
      .eq('emoji', emoji)
      .single()

    if (existingReaction) {
      // Add user to existing reaction
      const { error: userError } = await supabase
        .from('quote_reactions_users')
        .insert([
          {
            quote_reaction_id: existingReaction.id,
            user_id: session.user.id
          }
        ])
        .select()

      if (userError) throw userError
    } else {
      // Create new reaction and add user
      const { data: newReaction, error: reactionError } = await supabase
        .from('quote_reactions')
        .insert([
          {
            quote_id: id,
            emoji: emoji
          }
        ])
        .select()
        .single()

      if (reactionError) throw reactionError

      const { error: userError } = await supabase
        .from('quote_reactions_users')
        .insert([
          {
            quote_reaction_id: newReaction.id,
            user_id: session.user.id
          }
        ])

      if (userError) throw userError
    }

    // Get updated reactions
    const { data: reactions } = await supabase
      .from('quote_reactions')
      .select(`
        emoji,
        users:quote_reactions_users(
          user_id
        )
      `)
      .eq('quote_id', id)

    const transformedReactions = reactions?.map(reaction => ({
      emoji: reaction.emoji,
      users: reaction.users?.map(u => ({ id: u.user_id })) || []
    })) || []

    return NextResponse.json(transformedReactions)
  } catch (error) {
    console.error('Error adding reaction:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const params = await context.params
    const id = params.id
    const { searchParams } = new URL(request.url)
    const emoji = searchParams.get('emoji')
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get reaction ID
    const { data: reaction } = await supabase
      .from('quote_reactions')
      .select('id')
      .eq('quote_id', id)
      .eq('emoji', emoji)
      .single()

    if (reaction) {
      // Remove user from reaction
      const { error: deleteError } = await supabase
        .from('quote_reactions_users')
        .delete()
        .eq('quote_reaction_id', reaction.id)
        .eq('user_id', session.user.id)

      if (deleteError) throw deleteError

      // Check if any users left for this reaction
      const { count, error: countError } = await supabase
        .from('quote_reactions_users')
        .select('*', { count: 'exact' })
        .eq('quote_reaction_id', reaction.id)

      if (countError) throw countError

      // If no users left, delete the reaction
      if (count === 0) {
        const { error: reactionError } = await supabase
          .from('quote_reactions')
          .delete()
          .eq('id', reaction.id)

        if (reactionError) throw reactionError
      }
    }

    // Get updated reactions
    const { data: reactions } = await supabase
      .from('quote_reactions')
      .select(`
        emoji,
        users:quote_reactions_users(
          user_id
        )
      `)
      .eq('quote_id', id)

    const transformedReactions = reactions?.map(reaction => ({
      emoji: reaction.emoji,
      users: reaction.users?.map(u => ({ id: u.user_id })) || []
    })) || []

    return NextResponse.json(transformedReactions)
  } catch (error) {
    console.error('Error removing reaction:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
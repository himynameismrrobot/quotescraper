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
  { params }: { params: { id: string } }
) {
  const id = await params.id
  try {
    const supabase = await createClient()
    const json = await request.json()
    
    // Get authenticated user from auth.users
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user exists in public.users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingUser) {
      console.log('User exists in auth but not in public schema:', user.id);
      return NextResponse.json(
        { error: 'User not found in public schema' },
        { status: 404 }
      )
    }

    // Check if user has already reacted with this emoji
    const { data: existingReaction } = await supabase
      .from('quote_reactions')
      .select('id')
      .eq('quote_id', id)
      .eq('emoji', json.emoji)
      .single()

    let reactionId: string

    if (!existingReaction) {
      // Create new reaction
      const { data: newReaction, error: reactionError } = await supabase
        .from('quote_reactions')
        .insert([
          {
            emoji: json.emoji,
            quote_id: id
          }
        ])
        .select()
        .single()

      if (reactionError) {
        console.error('Error creating reaction:', reactionError)
        return NextResponse.json(
          { error: 'Failed to create reaction' },
          { status: 500 }
        )
      }
      reactionId = newReaction.id
    } else {
      reactionId = existingReaction.id
    }

    // Check if user has already associated with this reaction
    const { data: existingAssociation } = await supabase
      .from('quote_reactions_users')
      .select('*')
      .eq('quote_reaction_id', reactionId)
      .eq('user_id', user.id)
      .single()

    if (!existingAssociation) {
      // Create user association
      const { error: userAssocError } = await supabase
        .from('quote_reactions_users')
        .insert([
          {
            quote_reaction_id: reactionId,
            user_id: user.id
          }
        ])

      if (userAssocError) {
        console.error('Error creating user association:', userAssocError)
        return NextResponse.json(
          { error: 'Failed to associate user with reaction' },
          { status: 500 }
        )
      }
    }

    // Get updated reaction data
    const { data: updatedReaction, error: getError } = await supabase
      .from('quote_reactions')
      .select(`
        *,
        users:quote_reactions_users(
          user:users(*)
        )
      `)
      .eq('id', reactionId)
      .single()

    if (getError) throw getError

    return NextResponse.json(updatedReaction)
  } catch (error) {
    console.error('Error creating reaction:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = await params.id
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const emoji = searchParams.get('emoji')
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // First, get the reaction
    const { data: reaction } = await supabase
      .from('quote_reactions')
      .select('id')
      .eq('quote_id', id)
      .eq('emoji', emoji)
      .single()

    if (reaction) {
      // Remove the user association
      const { error: deleteError } = await supabase
        .from('quote_reactions_users')
        .delete()
        .eq('quote_reaction_id', reaction.id)
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Error removing reaction:', deleteError)
        return NextResponse.json(
          { error: 'Failed to remove reaction' },
          { status: 500 }
        )
      }

      // Check if this was the last user for this reaction
      const { data: remainingUsers } = await supabase
        .from('quote_reactions_users')
        .select('id')
        .eq('quote_reaction_id', reaction.id)

      if (!remainingUsers?.length) {
        // Delete the reaction if no users are left
        await supabase
          .from('quote_reactions')
          .delete()
          .eq('id', reaction.id)
      }
    }

    // Get updated quote data
    const { data: updatedQuote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        speaker:speakers(
          *,
          organization:organizations(*)
        ),
        reactions:quote_reactions(
          *,
          users:quote_reactions_users(
            user:users(*)
          )
        )
      `)
      .eq('id', id)
      .single()

    if (quoteError) throw quoteError

    // Transform the reactions data
    const transformedQuote = {
      ...updatedQuote,
      reactions: updatedQuote.reactions?.map(reaction => ({
        emoji: reaction.emoji,
        users: reaction.users?.map(u => ({ id: u.user.id })) || []
      })) || []
    }

    return NextResponse.json(transformedQuote)
  } catch (error) {
    console.error('Error removing reaction:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
} 
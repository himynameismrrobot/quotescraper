import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user?.email) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { name, username, image } = req.body;

    // Check if username is taken
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        name,
        username,
        image: image || user.user_metadata.avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error in onboarding:', error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Error updating user profile'
    });
  }
} 
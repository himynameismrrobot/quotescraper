import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    console.log('Session in onboarding API:', session);
    
    if (!session?.user?.email) {
      console.log('No session or email found');
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { name, username, image } = req.body;
    console.log('Received data:', { name, username, image });

    // Check if username is already taken
    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (existingUser) {
      console.log('Username already taken:', username);
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Update user profile
    console.log('Updating user profile for email:', session.user.email);
    const updatedUser = await prisma.user.update({
      where: { 
        email: session.user.email 
      },
      data: {
        name,
        username,
        image: image || session.user.image,
      },
    });

    console.log('Updated user:', updatedUser);
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error in onboarding:', error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Error updating user profile',
      error: error instanceof Error ? error.stack : 'Unknown error'
    });
  }
} 
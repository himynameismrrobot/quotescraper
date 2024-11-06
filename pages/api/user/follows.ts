import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { organizations, speakers } = req.body;

    // Create follows in a transaction to ensure all or nothing
    await prisma.$transaction(async (tx) => {
      // Add organization follows
      if (organizations?.length) {
        await Promise.all(organizations.map((orgId: string) =>
          tx.following.create({
            data: {
              userId: session.user.id,
              orgId: orgId,
            },
          })
        ));
      }

      // Add speaker follows
      if (speakers?.length) {
        await Promise.all(speakers.map((speakerId: string) =>
          tx.following.create({
            data: {
              userId: session.user.id,
              speakerId: speakerId,
            },
          })
        ));
      }
    });

    res.status(200).json({ message: 'Follows saved successfully' });
  } catch (error) {
    console.error('Error saving follows:', error);
    res.status(500).json({ message: 'Error saving follows' });
  }
} 
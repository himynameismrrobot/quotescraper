import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    console.log('Full session data from server:', {
      session,
      user: session?.user,
      userId: session?.user?.id,
      email: session?.user?.email
    });
    
    if (!session?.user?.id) {
      console.log('No user ID in session');
      return res.status(401).json({ 
        message: 'Unauthorized - No user ID',
        session: session,
        user: session?.user 
      });
    }

    const { id } = req.query;
    const quoteId = String(id);
    console.log('Processing reaction for quote:', quoteId);

    if (req.method === 'POST') {
      const { emoji } = req.body;
      console.log('Adding reaction:', { emoji, quoteId, userId: session.user.id });

      // Verify the quote exists
      const quote = await prisma.savedQuote.findUnique({
        where: { id: quoteId }
      });

      if (!quote) {
        console.log('Quote not found:', quoteId);
        return res.status(404).json({ message: 'Quote not found' });
      }

      try {
        // Find or create the reaction
        const reaction = await prisma.quoteReaction.upsert({
          where: {
            quoteId_emoji: {
              quoteId,
              emoji,
            },
          },
          create: {
            emoji,
            quote: { connect: { id: quoteId } },
            users: { connect: { id: session.user.id } },
          },
          update: {
            users: { connect: { id: session.user.id } },
          },
          include: {
            users: true,
          },
        });

        console.log('Reaction created/updated:', reaction);
        res.status(200).json(reaction);
      } catch (error) {
        console.error('Prisma error:', error);
        res.status(500).json({ 
          message: 'Database error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else if (req.method === 'DELETE') {
      const { emoji } = req.body;
      console.log('Removing reaction:', { emoji, quoteId, userId: session.user.id });

      try {
        // Find the reaction
        const reaction = await prisma.quoteReaction.findUnique({
          where: {
            quoteId_emoji: {
              quoteId,
              emoji,
            },
          },
          include: {
            users: true,
          },
        });

        if (!reaction) {
          return res.status(404).json({ message: 'Reaction not found' });
        }

        // Remove the user from the reaction
        const updatedReaction = await prisma.quoteReaction.update({
          where: {
            quoteId_emoji: {
              quoteId,
              emoji,
            },
          },
          data: {
            users: {
              disconnect: { id: session.user.id },
            },
          },
          include: {
            users: true,
          },
        });

        // If no users are left, delete the reaction
        if (updatedReaction.users.length === 0) {
          await prisma.quoteReaction.delete({
            where: {
              quoteId_emoji: {
                quoteId,
                emoji,
              },
            },
          });
        }

        console.log('Reaction updated:', updatedReaction);
        res.status(200).json(updatedReaction);
      } catch (error) {
        console.error('Prisma error:', error);
        res.status(500).json({ 
          message: 'Database error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } else {
      res.setHeader('Allow', ['POST', 'DELETE']);
      res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
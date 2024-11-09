import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.query;
    const commentId = String(id);

    if (req.method === 'POST') {
      const { emoji } = req.body;

      // Verify the comment exists
      const comment = await prisma.comment.findUnique({
        where: { id: commentId }
      });

      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      // Find or create the reaction
      const reaction = await prisma.commentReaction.upsert({
        where: {
          commentId_emoji: {
            commentId,
            emoji,
          },
        },
        create: {
          emoji,
          comment: { connect: { id: commentId } },
          users: { connect: { id: session.user.id } },
        },
        update: {
          users: { connect: { id: session.user.id } },
        },
        include: {
          users: true,
        },
      });

      res.status(200).json(reaction);
    } else if (req.method === 'DELETE') {
      const { emoji } = req.body;

      // Find the reaction
      const reaction = await prisma.commentReaction.findUnique({
        where: {
          commentId_emoji: {
            commentId,
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
      const updatedReaction = await prisma.commentReaction.update({
        where: {
          commentId_emoji: {
            commentId,
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
        await prisma.commentReaction.delete({
          where: {
            commentId_emoji: {
              commentId,
              emoji,
            },
          },
        });
      }

      res.status(200).json(updatedReaction);
    } else {
      res.setHeader('Allow', ['POST', 'DELETE']);
      res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Error handling comment reaction:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
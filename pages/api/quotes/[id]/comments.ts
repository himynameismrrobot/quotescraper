import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const { id } = req.query;
    const quoteId = String(id);
    const page = Number(req.query.page) || 1;
    const pageSize = 10;

    if (req.method === 'GET') {
      const comments = await prisma.comment.findMany({
        where: {
          quoteId: quoteId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          reactions: {
            include: {
              users: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: pageSize,
        skip: (page - 1) * pageSize,
      });

      const totalComments = await prisma.comment.count({
        where: {
          quoteId: quoteId,
        },
      });

      res.status(200).json({
        comments,
        hasMore: totalComments > page * pageSize,
        total: totalComments,
      });
    } else if (req.method === 'POST') {
      if (!session?.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { text } = req.body;

      if (!text?.trim()) {
        return res.status(400).json({ message: 'Comment text is required' });
      }

      const comment = await prisma.comment.create({
        data: {
          text: text.trim(),
          quote: { connect: { id: quoteId } },
          user: { connect: { id: session.user.id } },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          reactions: {
            include: {
              users: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      res.status(201).json(comment);
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Error handling comment:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
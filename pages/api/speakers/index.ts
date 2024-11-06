import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { name, organizationId, imageUrl } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Speaker name is required' });
      }

      const speaker = await prisma.speaker.create({
        data: {
          name,
          organizationId: organizationId || null,
          imageUrl: imageUrl || null,
        },
      });

      res.status(201).json(speaker);
    } catch (error) {
      console.error('Error creating speaker:', error);
      res.status(500).json({ message: 'Error creating speaker' });
    }
  } else if (req.method === 'GET') {
    try {
      const speakers = await prisma.speaker.findMany({
        include: {
          organization: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      res.status(200).json(speakers);
    } catch (error) {
      console.error('Error fetching speakers:', error);
      res.status(500).json({ message: 'Error fetching speakers' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 
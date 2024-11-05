import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { name, organizationId, imageUrl } = req.body;

      const speaker = await prisma.speaker.create({
        data: {
          name,
          organizationId,
          imageUrl,
        },
      });

      res.status(201).json(speaker);
    } catch (error) {
      console.error('Error creating speaker:', error);
      res.status(500).json({ message: 'Error creating speaker' });
    }
  } else if (req.method === 'GET') {
    // Existing GET logic remains the same
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 
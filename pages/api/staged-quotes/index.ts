import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const stagedQuotes = await prisma.quoteStaging.findMany({
        orderBy: {
          articleDate: 'desc',
        },
      });

      // Format dates consistently
      const formattedQuotes = stagedQuotes.map(quote => ({
        ...quote,
        articleDate: quote.articleDate.toISOString(),
      }));

      res.status(200).json(formattedQuotes);
    } catch (error) {
      console.error('Error fetching staged quotes:', error);
      res.status(500).json({ message: 'Error fetching staged quotes' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 
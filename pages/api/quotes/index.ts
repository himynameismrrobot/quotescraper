import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const quotes = await prisma.savedQuote.findMany({
        include: {
          speaker: {
            include: {
              organization: true,
            },
          },
        },
        orderBy: {
          articleDate: 'desc', // Changed from createdAt to articleDate
        },
      });

      const formattedQuotes = quotes.map((quote) => ({
        id: quote.id,
        summary: quote.summary,
        rawQuoteText: quote.rawQuoteText,
        speakerName: quote.speaker.name,
        speakerImage: quote.speaker.imageUrl,
        organizationLogo: quote.speaker.organization?.logoUrl,
        articleDate: quote.articleDate.toISOString(),
      }));

      res.status(200).json(formattedQuotes);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: 'Error fetching quotes' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const savedQuotes = await prisma.savedQuote.findMany({
      include: {
        speaker: true,
      },
    });

    const formattedQuotes = savedQuotes.map((quote) => ({
      id: quote.id,
      summary: quote.summary,
      rawQuoteText: quote.rawQuoteText,
      speakerName: quote.speaker.name,
      articleDate: quote.articleDate.toISOString(),
      articleUrl: quote.articleUrl,
      articleHeadline: quote.articleHeadline || quote.articleUrl, // Use URL as fallback
    }));

    res.status(200).json(formattedQuotes);
  } catch (error) {
    console.error('Error fetching saved quotes:', error);
    res.status(500).json({ message: 'An error occurred while fetching saved quotes' });
  }
}

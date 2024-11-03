import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const quote = await prisma.savedQuote.findUnique({
        where: { id: String(id) },
        include: {
          speaker: {
            include: {
              organization: true,
            },
          },
        },
      });

      if (!quote) {
        return res.status(404).json({ message: 'Quote not found' });
      }

      // Fetch the monitored URL associated with this quote
      const monitoredUrl = await prisma.monitoredURL.findFirst({
        where: { url: quote.articleUrl },
      });

      const formattedQuote = {
        id: quote.id,
        rawQuoteText: quote.rawQuoteText,
        speakerName: quote.speaker.name,
        speakerImage: quote.speaker.imageUrl,
        organizationLogo: quote.speaker.organization?.logoUrl,
        articleDate: quote.articleDate.toISOString(),
        articleUrl: quote.articleUrl,
        parentMonitoredUrl: monitoredUrl?.url || quote.articleUrl,
        parentMonitoredUrlLogo: monitoredUrl?.logoUrl,
      };

      res.status(200).json(formattedQuote);
    } catch (error) {
      console.error('Error fetching quote:', error);
      res.status(500).json({ message: 'Error fetching quote' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

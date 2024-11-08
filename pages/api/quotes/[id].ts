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

      console.log('Article URL from quote:', quote.articleUrl);
      
      try {
        const articleOrigin = new URL(quote.articleUrl).origin;
        console.log('Article origin:', articleOrigin);
      } catch (error) {
        console.error('Error parsing URL:', error);
      }

      try {
        const articleUrl = new URL(quote.articleUrl);
        const articlePath = articleUrl.host + articleUrl.pathname;
        console.log('Article path for matching:', articlePath);

        // Fetch the monitored URL associated with this quote's URL
        const monitoredUrl = await prisma.monitoredURL.findFirst({
          where: { 
            OR: [
              { url: quote.articleUrl },
              { url: { contains: articlePath } },
              { 
                url: {
                  contains: articleUrl.host // Match just the domain
                }
              }
            ]
          },
        });

        console.log('Found monitored URL:', monitoredUrl);

        const formattedQuote = {
          id: quote.id,
          rawQuoteText: quote.rawQuoteText,
          speakerName: quote.speaker.name,
          speakerImage: quote.speaker.imageUrl,
          organizationLogo: quote.speaker.organization?.logoUrl,
          articleDate: quote.articleDate.toISOString(),
          articleUrl: quote.articleUrl,
          articleHeadline: quote.articleHeadline,
          parentMonitoredUrl: monitoredUrl?.url || quote.articleUrl,
          parentMonitoredUrlLogo: monitoredUrl?.logoUrl,
        };

        console.log('Formatted quote response:', formattedQuote);

        res.status(200).json(formattedQuote);
      } catch (error) {
        console.error('Error fetching quote:', error);
        res.status(500).json({ message: 'Error fetching quote' });
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
      res.status(500).json({ message: 'Error fetching quote' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

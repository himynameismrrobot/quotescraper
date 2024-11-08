import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { getSession } from 'next-auth/react';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const session = await getSession({ req });
      const tab = req.query.tab as string;
      
      if (tab === 'following' && session?.user?.email) {
        // Get user's follows
        const userFollows = await prisma.following.findMany({
          where: {
            user: {
              email: session.user.email
            }
          },
          select: {
            speakerId: true,
            orgId: true
          }
        });

        // Get speakers from followed organizations
        const followedOrgSpeakers = await prisma.speaker.findMany({
          where: {
            organizationId: {
              in: userFollows.map(f => f.orgId).filter(Boolean) as string[]
            }
          },
          select: {
            id: true
          }
        });

        // Combine directly followed speakers and speakers from followed orgs
        const allFollowedSpeakerIds = [
          ...userFollows.map(f => f.speakerId).filter(Boolean) as string[],
          ...followedOrgSpeakers.map(s => s.id)
        ];

        // Get quotes from followed speakers
        const quotes = await prisma.savedQuote.findMany({
          where: {
            speakerId: {
              in: allFollowedSpeakerIds
            }
          },
          include: {
            speaker: {
              include: {
                organization: true,
              },
            },
          },
          orderBy: {
            articleDate: 'desc',
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
      } else {
        // Return all quotes if not on following tab
        const quotes = await prisma.savedQuote.findMany({
          include: {
            speaker: {
              include: {
                organization: true,
              },
            },
          },
          orderBy: {
            articleDate: 'desc',
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
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: 'Error fetching quotes' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

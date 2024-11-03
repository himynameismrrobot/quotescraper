import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    // Fetch the staged quote
    const stagedQuote = await prisma.quoteStaging.findUnique({
      where: { id: String(id) },
    });

    if (!stagedQuote) {
      return res.status(404).json({ message: 'Staged quote not found' });
    }

    // Find the speaker
    const speaker = await prisma.speaker.findFirst({
      where: { name: stagedQuote.speakerName },
    });

    if (!speaker) {
      return res.status(400).json({ message: 'Speaker not found. Please add the speaker first.' });
    }

    // Create the saved quote
    const savedQuote = await prisma.savedQuote.create({
      data: {
        summary: stagedQuote.summary,
        rawQuoteText: stagedQuote.rawQuoteText,
        articleDate: stagedQuote.articleDate,
        articleUrl: stagedQuote.articleUrl,
        articleHeadline: stagedQuote.articleHeadline,
        speaker: { connect: { id: speaker.id } },
      },
    });

    // Delete the staged quote
    await prisma.quoteStaging.delete({
      where: { id: String(id) },
    });

    res.status(200).json(savedQuote);
  } catch (error) {
    console.error('Error accepting quote:', error);
    res.status(500).json({ message: 'An error occurred while accepting the quote' });
  }
}

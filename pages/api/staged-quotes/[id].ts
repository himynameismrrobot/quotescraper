import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  switch (req.method) {
    case 'PATCH':
      return updateStagedQuote(req, res, String(id));
    case 'DELETE':
      return deleteStagedQuote(req, res, String(id));
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}

async function updateStagedQuote(req: NextApiRequest, res: NextApiResponse, id: string) {
  const { summary, rawQuoteText } = req.body;
  try {
    const updatedQuote = await prisma.quoteStaging.update({
      where: { id },
      data: { summary, rawQuoteText },
    });
    res.status(200).json(updatedQuote);
  } catch (error) {
    res.status(500).json({ message: 'Error updating staged quote', error });
  }
}

async function deleteStagedQuote(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    await prisma.quoteStaging.delete({
      where: { id },
    });
    res.status(200).json({ message: 'Staged quote deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting staged quote', error });
  }
}

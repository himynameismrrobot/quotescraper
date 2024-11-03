import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getStagedQuotes(req, res);
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}

async function getStagedQuotes(req: NextApiRequest, res: NextApiResponse) {
  try {
    const stagedQuotes = await prisma.quoteStaging.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(stagedQuotes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching staged quotes', error });
  }
}

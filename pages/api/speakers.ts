import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getSpeakers(req, res);
    case 'POST':
      return createSpeaker(req, res);
    case 'DELETE':
      return deleteSpeaker(req, res);
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}

async function getSpeakers(req: NextApiRequest, res: NextApiResponse) {
  try {
    const speakers = await prisma.speaker.findMany({
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(speakers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching speakers', error });
  }
}

async function createSpeaker(req: NextApiRequest, res: NextApiResponse) {
  const { name, imageUrl, organizationId } = req.body;
  try {
    const speaker = await prisma.speaker.create({
      data: { 
        name, 
        imageUrl, 
        organizationId: organizationId || undefined 
      },
      include: { organization: true },
    });
    res.status(201).json(speaker);
  } catch (error) {
    res.status(500).json({ message: 'Error creating speaker', error });
  }
}

async function deleteSpeaker(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  try {
    await prisma.speaker.delete({
      where: { id: String(id) },
    });
    res.status(200).json({ message: 'Speaker deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting speaker', error });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getMonitoredUrls(req, res);
    case 'POST':
      return createMonitoredUrl(req, res);
    case 'DELETE':
      return deleteMonitoredUrl(req, res);
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}

async function getMonitoredUrls(req: NextApiRequest, res: NextApiResponse) {
  try {
    const monitoredUrls = await prisma.monitoredURL.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(monitoredUrls);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monitored URLs', error });
  }
}

async function createMonitoredUrl(req: NextApiRequest, res: NextApiResponse) {
  const { url, logoUrl } = req.body;
  try {
    const monitoredUrl = await prisma.monitoredURL.create({
      data: { url, logoUrl },
    });
    res.status(201).json(monitoredUrl);
  } catch (error) {
    res.status(500).json({ message: 'Error creating monitored URL', error });
  }
}

async function deleteMonitoredUrl(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  try {
    await prisma.monitoredURL.delete({
      where: { id: String(id) },
    });
    res.status(200).json({ message: 'Monitored URL deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting monitored URL', error });
  }
}

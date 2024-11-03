import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getOrganizations(req, res);
    case 'POST':
      return createOrganization(req, res);
    case 'DELETE':
      return deleteOrganization(req, res);
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}

async function getOrganizations(req: NextApiRequest, res: NextApiResponse) {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(organizations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching organizations', error });
  }
}

async function createOrganization(req: NextApiRequest, res: NextApiResponse) {
  const { name, logoUrl } = req.body;
  try {
    const organization = await prisma.organization.create({
      data: { name, logoUrl },
    });
    res.status(201).json(organization);
  } catch (error) {
    res.status(500).json({ message: 'Error creating organization', error });
  }
}

async function deleteOrganization(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  try {
    await prisma.organization.delete({
      where: { id: String(id) },
    });
    res.status(200).json({ message: 'Organization deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting organization', error });
  }
}

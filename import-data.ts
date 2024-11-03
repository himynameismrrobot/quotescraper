import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface OrganizationRow {
  id: string;
  name: string;
  logoUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface SpeakerRow {
  id: string;
  name: string;
  imageUrl: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

async function importOrganizations(): Promise<void> {
  const organizations: OrganizationRow[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream('organizations.csv')
      .pipe(csv())
      .on('data', (row: OrganizationRow) => {
        organizations.push(row);
      })
      .on('end', async () => {
        for (const org of organizations) {
          await prisma.organization.create({
            data: {
              id: org.id,
              name: org.name,
              logoUrl: org.logoUrl,
              createdAt: new Date(org.createdAt),
              updatedAt: new Date(org.updatedAt),
            },
          });
        }
        console.log('Organizations imported successfully');
        resolve();
      })
      .on('error', reject);
  });
}

async function importSpeakers(): Promise<void> {
  const speakers: SpeakerRow[] = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream('speakers.csv')
      .pipe(csv())
      .on('data', (row: SpeakerRow) => {
        speakers.push(row);
      })
      .on('end', async () => {
        for (const speaker of speakers) {
          await prisma.speaker.create({
            data: {
              id: speaker.id,
              name: speaker.name,
              imageUrl: speaker.imageUrl,
              organizationId: speaker.organizationId,
              createdAt: new Date(speaker.createdAt),
              updatedAt: new Date(speaker.updatedAt),
            },
          });
        }
        console.log('Speakers imported successfully');
        resolve();
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    await importOrganizations();
    await importSpeakers();
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from the playerScraper directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Initialize Prisma client with debug logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function uploadSpeakers() {
  try {
    // Read the CSV file
    const filePath = path.join(__dirname, 'output', 'all_players.csv');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Parse CSV content (skip header row)
    const rows = fileContent.split('\n').slice(1);
    
    console.log(`Found ${rows.length} players to process`);
    
    // Process each row
    for (const row of rows) {
      if (!row.trim()) continue; // Skip empty rows
      
      const [teamName, playerName, playerImageUrl] = row.split(',');
      
      console.log(`Processing player: ${playerName} from team: ${teamName}`);

      try {
        // Check if speaker already exists
        const existingSpeaker = await prisma.speaker.findUnique({
          where: { name: playerName }
        });
        
        if (existingSpeaker) {
          console.log(`Speaker already exists: ${playerName}`);
          continue;
        }

        // Look up the organization by team name
        const organization = await prisma.organization.findFirst({
          where: { name: teamName }
        });

        if (!organization) {
          console.log(`Organization not found for team: ${teamName}`);
          // Create the organization if it doesn't exist
          const newOrganization = await prisma.organization.create({
            data: {
              name: teamName,
            }
          });
          console.log(`Created new organization: ${teamName}`);

          // Create new speaker with organization
          await prisma.speaker.create({
            data: {
              name: playerName,
              imageUrl: playerImageUrl,
              organizationId: newOrganization.id
            }
          });
        } else {
          // Create new speaker with existing organization
          await prisma.speaker.create({
            data: {
              name: playerName,
              imageUrl: playerImageUrl,
              organizationId: organization.id
            }
          });
        }
        
        console.log(`Added new speaker: ${playerName} with organization: ${teamName}`);
      } catch (error) {
        console.error(`Error processing player ${playerName}:`, error);
      }
    }
    
    console.log('Upload completed successfully');
    
  } catch (error) {
    console.error('Error during upload:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the upload
uploadSpeakers();
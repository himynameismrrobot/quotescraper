import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PlayerData {
  teamName: string;
  playerName: string;
  playerImageUrl: string;
}

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
      
      // Check if speaker already exists
      const existingSpeaker = await prisma.speaker.findUnique({
        where: { name: playerName }
      });
      
      if (existingSpeaker) {
        console.log(`Speaker already exists: ${playerName}`);
        continue;
      }
      
      // Create new speaker
      await prisma.speaker.create({
        data: {
          name: playerName,
          imageUrl: playerImageUrl
        }
      });
      
      console.log(`Added new speaker: ${playerName}`);
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
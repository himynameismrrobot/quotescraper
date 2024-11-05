import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import https from 'https';

// Load .env from the playerScraper directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Configure OpenAI with custom HTTPS agent
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  httpAgent: new https.Agent({
    rejectUnauthorized: false, // Only use this in development
    secureProtocol: 'TLSv1_2_method'
  })
});
puppeteer.use(StealthPlugin());

interface PlayerData {
  teamName: string;
  playerName: string;
  playerImageUrl: string;
}

// Function to split content into much smaller chunks
function splitIntoChunks(text: string, maxChunkSize: number = 4000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  // Split by player elements
  const playerElements = text.match(/<a[^>]*href="\/player\/[^"]*"[^>]*>[\s\S]*?<\/a>/g) || [];
  
  for (const element of playerElements) {
    if ((currentChunk + element).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = element;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + element;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  console.log(`Split content into ${chunks.length} chunks of approximately ${maxChunkSize} characters each`);
  return chunks;
}

// Function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function extractPlayersWithAI(html: string, teamName: string): Promise<PlayerData[]> {
  try {
    // More aggressive HTML cleaning
    const cleanedHtml = html
      .replace(/<header[^>]*>.*?<\/header>/gs, '')
      .replace(/<footer[^>]*>.*?<\/footer>/gs, '')
      .replace(/<nav[^>]*>.*?<\/nav>/gs, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<iframe.*?<\/iframe>/gs, '')
      .replace(/<link.*?>/gs, '')
      .replace(/<meta.*?>/gs, '')
      // Only keep player-related elements
      .match(/<a[^>]*href="\/player\/[^"]*"[^>]*>[\s\S]*?<\/a>/g) || [];

    // Join the player elements with newlines
    const playerElements = cleanedHtml.join('\n');
    console.log('Extracted player elements:', playerElements);

    // Split into smaller chunks
    const chunks = splitIntoChunks(playerElements);
    console.log(`Split content into ${chunks.length} chunks`);

    let allPlayers: PlayerData[] = [];

    // Process each chunk with delay and retries
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1} of ${chunks.length} (${chunks[i].length} characters)`);
      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        try {
          // Add longer delay between chunks
          if (i > 0) {
            await delay(5000); // 15 second delay between chunks
          }

          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "You are a helpful assistant that extracts football player data from HTML content. Extract player names and IDs from href attributes in the format /player/name/ID. Always respond with valid JSON in this format: {\"players\": [{\"playerName\": string, \"playerId\": string}]}"
              },
              {
                role: "user",
                content: `Extract player information from these HTML elements. Return a JSON object with a 'players' array containing objects with 'playerName' and 'playerId' properties. Here's the HTML: ${chunks[i]}`
              }
            ],
            temperature: 0.3,
            max_tokens: 500
          });

          const content = response.choices[0].message?.content || '{"players": []}';
          console.log(`Chunk ${i + 1} OpenAI Response:`, content);

          try {
            const parsedResponse = JSON.parse(content);
            const formattedPlayers = parsedResponse.players.map((player: any) => ({
              teamName,
              playerName: player.playerName,
              playerImageUrl: `https://api.sofascore.app/api/v1/player/${player.playerId}/image`
            }));
            allPlayers = [...allPlayers, ...formattedPlayers];
            success = true;
          } catch (error) {
            console.error(`Error parsing chunk ${i + 1} response:`, error);
            retries--;
          }
        } catch (error) {
          console.error(`Error processing chunk ${i + 1}:`, error);
          if (error.error?.type === 'tokens' || error.error?.code === 'rate_limit_exceeded') {
            console.log('Rate limit hit, waiting 60 seconds before retry...');
            await delay(60000); // Wait 60 seconds on rate limit
          }
          retries--;
          if (retries === 0) {
            console.error(`Failed to process chunk ${i + 1} after all retries`);
          }
        }
      }
    }

    // Remove duplicates based on playerName
    const uniquePlayers = Array.from(
      new Map(allPlayers.map(player => [player.playerName, player])).values()
    );

    console.log(`Found ${uniquePlayers.length} unique players across all chunks`);
    return uniquePlayers;
  } catch (error) {
    console.error('Error extracting players with AI:', error);
    return [];
  }
}

async function scrapeTeamPlayers(url: string = 'https://www.sofascore.com/team/football/wolverhampton/3'): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-accelerated-2d-canvas',
      '--hide-scrollbars'
    ]
  });

  try {
    console.log('Starting player scrape...');
    const page = await browser.newPage();
    
    const userAgent = new UserAgent();
    await page.setUserAgent(userAgent.toString());
    
    console.log(`Navigating to ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Extract the page content
    const pageContent = await page.content();
    console.log('Page content extracted, sending to OpenAI...');

    // Use OpenAI to extract player data
    const players = await extractPlayersWithAI(pageContent, 'Wolves');
    console.log(`Found ${players.length} players using AI`);

    // Log each player found
    players.forEach(player => {
      console.log(`- ${player.playerName}: ${player.playerImageUrl}`);
    });

    // Create CSV content
    const csvContent = [
      ['Team Name', 'Player Name', 'Player Image URL'],
      ...players.map(player => [
        player.teamName,
        player.playerName,
        player.playerImageUrl
      ])
    ].map(row => row.join(',')).join('\n');

    // Write to CSV file
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `player_data_${timestamp}.csv`;
    const filePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(filePath, csvContent);
    console.log(`Data saved to ${fileName}`);

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

module.exports = {
  startScrape: async () => {
    console.log('Starting player data scrape...');
    await scrapeTeamPlayers();
    console.log('Scrape completed');
  }
};

// Can be called from terminal:
// import { startScrape } from './playerScraper';
// startScrape(); 
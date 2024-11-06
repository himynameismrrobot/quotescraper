import { NextApiRequest, NextApiResponse } from 'next';
import { crawlSpecificArticle } from '../../lib/crawler';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  // Create logs directory if it doesn't exist
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }

  // Create a log file with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logsDir, `crawl-${timestamp}.log`);
  
  const writeToLog = (message: string) => {
    fs.appendFileSync(logFile, message + '\n');
    console.log(message);
  };

  writeToLog('\n=== STARTING CRAWL FOR SPECIFIC ARTICLE ===');
  writeToLog('URL: ' + url);

  try {
    await crawlSpecificArticle(url, writeToLog);
    writeToLog('Article crawl completed successfully');
  } catch (error) {
    writeToLog('Error during article crawl: ' + error);
    writeToLog('Full error object: ' + JSON.stringify(error, null, 2));
  } finally {
    writeToLog('=== CRAWL COMPLETE ===\n');
    res.status(200).json({ message: 'Crawl completed' });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { crawlWebsite } from '../../lib/crawler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  console.log('Starting crawl API handler for URL:', url);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  const sendLog = (message: string) => {
    console.log('Sending log:', message); // Add this line
    res.write(`data: ${message}\n\n`);
    // Flush the response to ensure the client receives the message immediately
    if (res.flush) {
      res.flush();
    }
  };

  try {
    console.log('About to call crawlWebsite function');
    sendLog('Starting crawl process...');
    await crawlWebsite(url, sendLog);
    console.log('crawlWebsite function completed');
    sendLog('Crawl completed');
  } catch (error) {
    console.error('Error during crawl:', error);
    sendLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Log the full error object
    console.log('Full error object:', error);
  } finally {
    console.log('Ending crawl API handler');
    res.end();
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import { crawlSpecificArticle } from '../../lib/crawler';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  console.log('\n=== STARTING CRAWL FOR SPECIFIC ARTICLE ===');
  console.log('URL:', url);

  const sendLog = (message: string) => {
    // Log to terminal instead of trying to send to UI
    console.log(message);
  };

  try {
    await crawlSpecificArticle(url, sendLog);
    console.log('Article crawl completed successfully');
  } catch (error) {
    console.error('Error during article crawl:', error);
    console.error('Full error object:', error);
  } finally {
    console.log('=== CRAWL COMPLETE ===\n');
    res.status(200).json({ message: 'Crawl completed' });
  }
}

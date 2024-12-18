import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const updates = req.body;
    try {
      console.log('Received PATCH request with updates:', updates);
      
      if ('articleDate' in updates) {
        if (!updates.articleDate) {
          console.log('Invalid date: empty value');
          return res.status(400).json({ message: 'Invalid date format' });
        }
        updates.articleDate = new Date(updates.articleDate);
        console.log('Converted date:', updates.articleDate);
      }

      const updatedQuote = await prisma.quoteStaging.update({
        where: { id: String(id) },
        data: updates,
      });

      const formattedQuote = {
        ...updatedQuote,
        articleDate: updatedQuote.articleDate.toISOString(),
      };

      console.log('Successfully updated quote:', formattedQuote);
      res.status(200).json(formattedQuote);
    } catch (error) {
      console.error('Error updating staged quote:', error);
      res.status(500).json({ message: 'Error updating staged quote' });
    }
  } else if (req.method === 'DELETE') {
    try {
      await prisma.quoteStaging.delete({
        where: { id: String(id) },
      });
      res.status(200).json({ message: 'Quote deleted successfully' });
    } catch (error) {
      console.error('Error deleting staged quote:', error);
      res.status(500).json({ message: 'Error deleting staged quote' });
    }
  } else {
    res.setHeader('Allow', ['PATCH', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

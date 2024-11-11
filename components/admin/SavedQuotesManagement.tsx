import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { SavedQuote } from '@/types/admin';

const sortQuotes = (quotes: SavedQuote[]): SavedQuote[] => {
  return [...quotes].sort((a, b) => {
    // Sort by created_at date (newest first)
    const dateComparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateComparison !== 0) return dateComparison;

    // Then, sort by article headline
    const headlineComparison = (a.article_headline || '').localeCompare(b.article_headline || '');
    if (headlineComparison !== 0) return headlineComparison;

    // Finally, sort by speaker name
    return a.speaker_name.localeCompare(b.speaker_name);
  });
};

const SavedQuotesManagement: React.FC = () => {
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);

  useEffect(() => {
    fetchSavedQuotes();
  }, []);

  const fetchSavedQuotes = async () => {
    try {
      const response = await fetch('/api/admin/saved-quotes');
      if (!response.ok) {
        throw new Error('Failed to fetch saved quotes');
      }
      const data = await response.json();
      setSavedQuotes(data);
    } catch (error) {
      console.error('Error fetching saved quotes:', error);
    }
  };

  const handleDeleteQuote = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/saved-quotes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete quote');
      }
      fetchSavedQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved Quotes</CardTitle>
        <CardDescription>View and manage saved quotes</CardDescription>
      </CardHeader>
      <CardContent>
        {savedQuotes.length === 0 ? (
          <p>No saved quotes found.</p>
        ) : (
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Article Date</TableHead>
                <TableHead className="w-64">Article</TableHead>
                <TableHead className="w-32">Speaker Name</TableHead>
                <TableHead className="w-1/3">Quote Summary</TableHead>
                <TableHead className="w-2/5">Raw Quote Text</TableHead>
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortQuotes(savedQuotes).map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="w-24 whitespace-nowrap">
                    {new Date(quote.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="w-64">
                    <div className="w-64 overflow-hidden">
                      <a 
                        href={quote.article_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline block"
                      >
                        {quote.article_headline}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="w-32 whitespace-nowrap">{quote.speaker_name}</TableCell>
                  <TableCell className="w-1/3">{quote.summary}</TableCell>
                  <TableCell className="w-2/5">{quote.raw_quote_text}</TableCell>
                  <TableCell className="w-24">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDeleteQuote(quote.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedQuotesManagement; 
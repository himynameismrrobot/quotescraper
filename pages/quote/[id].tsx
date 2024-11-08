import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import EchoLayout from '../../components/EchoLayout';
import QuoteCard from '../../components/QuoteCard';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowLeft, Link as LinkIcon } from 'lucide-react';

interface Quote {
  id: string;
  summary: string;
  rawQuoteText: string;
  speakerName: string;
  speakerImage?: string;
  organizationLogo?: string;
  articleDate: string;
  articleUrl: string;
  articleHeadline?: string;
  parentMonitoredUrl: string;
  parentMonitoredUrlLogo?: string;
}

const QuoteDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (id) {
      fetchQuote();
    }
  }, [id]);

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/quotes/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }
      const data = await response.json();
      console.log('Quote data:', data);
      setQuote(data);
    } catch (error) {
      console.error('Error fetching quote:', error);
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement comment submission logic here
    console.log('Submitted comment:', comment);
    setComment('');
  };

  if (!quote) {
    return <div>Loading...</div>;
  }

  return (
    <EchoLayout>
      <div className="container mx-auto px-4">
        <Button 
          variant="ghost" 
          onClick={() => router.back()} 
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="max-w-[600px] mx-auto">
          <QuoteCard
            id={quote.id}
            summary={quote.rawQuoteText} // Use rawQuoteText as the summary for the detail view
            speakerName={quote.speakerName}
            speakerImage={quote.speakerImage}
            organizationLogo={quote.organizationLogo}
            articleDate={quote.articleDate}
            likes={0}
            comments={0}
          />
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {quote.parentMonitoredUrlLogo ? (
                  <img 
                    src={quote.parentMonitoredUrlLogo} 
                    alt="Source Logo" 
                    className="w-8 h-8 object-contain"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                    <LinkIcon className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <a 
                  href={quote.articleUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-500 hover:underline flex-1"
                >
                  {quote.articleHeadline || quote.articleUrl}
                </a>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCommentSubmit} className="mb-4">
                <Input
                  type="text"
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mb-2"
                />
                <Button type="submit">Submit Comment</Button>
              </form>
              {/* Add comment list here when implemented */}
              <p>Comments will be displayed here.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </EchoLayout>
  );
};

export default QuoteDetailPage;

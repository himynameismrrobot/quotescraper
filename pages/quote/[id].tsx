import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import EchoLayout from '../../components/EchoLayout';
import QuoteCard from '../../components/QuoteCard';
import CommentList from '../../components/comments/CommentList';
import CommentInput from '../../components/comments/CommentInput';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
  reactions?: {
    emoji: string;
    users: { id: string }[];
  }[];
}

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  reactions: {
    emoji: string;
    users: { id: string }[];
  }[];
}

const QuoteDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [totalComments, setTotalComments] = useState(0);

  useEffect(() => {
    if (id) {
      fetchQuote();
      fetchComments(1, true);
      
      // Scroll to comments section if hash is present
      if (window.location.hash === '#comments') {
        setTimeout(() => {
          document.querySelector('#comments')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [id]);

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/quotes/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }
      const data = await response.json();
      setQuote(data);
    } catch (error) {
      console.error('Error fetching quote:', error);
    }
  };

  const fetchComments = async (pageNum: number, reset: boolean = false) => {
    if (!id || isLoadingComments) return;

    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/quotes/${id}/comments?page=${pageNum}`);
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      const data = await response.json();
      
      setComments(prev => reset ? data.comments : [...prev, ...data.comments]);
      setHasMore(data.hasMore);
      setTotalComments(data.total);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingComments) {
      fetchComments(page + 1);
    }
  };

  const handleCommentAdded = () => {
    // Refresh comments from the beginning
    fetchComments(1, true);
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
            summary={quote.rawQuoteText}
            speakerName={quote.speakerName}
            speakerImage={quote.speakerImage}
            organizationLogo={quote.organizationLogo}
            articleDate={quote.articleDate}
            comments={totalComments}
            reactions={quote.reactions}
            className="mb-4"
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
              <CardTitle id="comments">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <CommentInput 
                  quoteId={quote.id} 
                  onCommentAdded={handleCommentAdded}
                />
              </div>
              <CommentList 
                comments={comments}
                onLoadMore={handleLoadMore}
                hasMore={hasMore}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </EchoLayout>
  );
};

export default QuoteDetailPage;

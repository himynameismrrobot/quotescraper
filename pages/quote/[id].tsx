import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import EchoLayout from '../../components/EchoLayout';
import QuoteCard from '../../components/QuoteCard';
import CommentList from '../../components/comments/CommentList';
import CommentInput from '../../components/comments/CommentInput';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Link as LinkIcon, Home, Search, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import Link from 'next/link';
import ReactionButton from '../../components/reactions/ReactionButton';
import ReactionPill from '../../components/reactions/ReactionPill';
import { useSession } from 'next-auth/react';
import BottomNav from '../../components/BottomNav';

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
  const { data: session } = useSession();
  const userId = session?.user?.id;

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

  const handleReactionSelect = async (emoji: string) => {
    // ... existing reaction handling code ...
  };

  const handleReactionClick = async (emoji: string) => {
    // ... existing reaction click code ...
  };

  if (!quote) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <EchoLayout>
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 text-gray-300 hover:text-white hover:bg-white/10"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center mb-4">
                <div className="avatar-click-area">
                  <Avatar className="mr-3 h-12 w-12 ring-2 ring-white/20">
                    <AvatarImage src={quote.speakerImage} alt={quote.speakerName} />
                    <AvatarFallback className="text-lg bg-white/10 text-white">
                      {quote.speakerName[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <Link href={`/speaker/${encodeURIComponent(quote.speakerName)}`}>
                    <span className="font-bold hover:underline text-lg text-white">
                      {quote.speakerName}
                    </span>
                  </Link>
                  <p className="text-sm text-gray-300">
                    {new Date(quote.articleDate).toLocaleDateString()}
                  </p>
                </div>
                {quote.organizationLogo && (
                  <div className="ml-auto">
                    <img 
                      src={quote.organizationLogo} 
                      alt="Organization" 
                      className="w-10 h-10 rounded-full"
                    />
                  </div>
                )}
              </div>
              <p className="text-lg mb-4 text-gray-100">{quote.summary}</p>
              {quote.rawQuoteText && (
                <p className="text-gray-300 mb-4">"{quote.rawQuoteText}"</p>
              )}
              <div className="flex items-center gap-4">
                {quote.reactions?.map((reaction) => (
                  <ReactionPill
                    key={reaction.emoji}
                    emoji={reaction.emoji}
                    count={reaction.users.length}
                    isUserReaction={reaction.users.some(u => u.id === userId)}
                    onClick={() => handleReactionClick(reaction.emoji)}
                  />
                ))}
                <ReactionButton 
                  quoteId={quote.id} 
                  onReactionSelect={handleReactionSelect}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl mb-6">
            <CardHeader>
              <CardTitle className="text-white">Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                {quote.parentMonitoredUrlLogo && (
                  <img 
                    src={quote.parentMonitoredUrlLogo} 
                    alt="Source" 
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <a 
                    href={quote.articleUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-white hover:underline block"
                  >
                    {quote.articleHeadline || quote.parentMonitoredUrl}
                  </a>
                  <p className="text-sm text-gray-300">
                    {new URL(quote.parentMonitoredUrl).hostname}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <CommentInput quoteId={quote.id} onCommentAdded={handleCommentAdded} />
                <div className="h-[500px] overflow-y-auto pr-2">
                  <CommentList 
                    comments={comments}
                    onLoadMore={handleLoadMore}
                    hasMore={hasMore}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <BottomNav />
      </EchoLayout>
    </div>
  );
};

export default QuoteDetailPage;

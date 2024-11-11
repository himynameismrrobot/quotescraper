import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import EchoLayout from '../../components/EchoLayout';
import QuoteCard from '../../components/QuoteCard';
import CommentList from '../../components/comments/CommentList';
import CommentInput from '../../components/comments/CommentInput';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Link as LinkIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import Link from 'next/link';
import ReactionButton from '../../components/reactions/ReactionButton';
import ReactionPill from '../../components/reactions/ReactionPill';
import BottomNav from '../../components/BottomNav';
import { useAuth } from '@/components/AuthStateProvider';

interface Quote {
  id: string;
  summary: string;
  raw_quote_text: string;
  article_date: string;
  article_url: string;
  article_headline?: string;
  parent_monitored_url: string;
  parent_monitored_url_logo?: string;
  speaker: {
    id: string;
    name: string;
    image_url: string | null;
    organization: {
      id: string;
      name: string;
      logo_url: string | null;
    } | null;
  };
  reactions?: {
    emoji: string;
    users: { id: string }[];
  }[];
}

interface Comment {
  id: string;
  text: string;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  reactions?: {
    emoji: string;
    users: { id: string }[];
  }[];
}

const QuoteDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const userId = user?.id;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [totalComments, setTotalComments] = useState(0);
  const [reactions, setReactions] = useState<Quote['reactions']>([]);

  useEffect(() => {
    if (id && !quote) {
      fetchQuote();
      fetchComments(1, true);
      
      if (window.location.hash === '#comments') {
        setTimeout(() => {
          document.querySelector('#comments')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [id, quote]);

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/quotes/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quote');
      }
      const data = await response.json();
      setQuote(data);
      setReactions(data.reactions || []);
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
    if (!userId) return;

    try {
      const response = await fetch(`/api/quotes/${id}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Failed to add reaction');
      }
      
      // Update local state
      const newReactions = [...(reactions || [])];
      const existingReaction = newReactions.find(r => r.emoji === emoji);
      if (existingReaction) {
        existingReaction.users = [...existingReaction.users, { id: userId }];
      } else {
        newReactions.push({ emoji, users: [{ id: userId }] });
      }
      setReactions(newReactions);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleReactionClick = async (emoji: string) => {
    if (!userId) return;

    const hasReacted = reactions?.find(r => r.emoji === emoji)
      ?.users.some(u => u.id === userId);

    try {
      const response = await fetch(`/api/quotes/${id}/reactions?emoji=${emoji}`, {
        method: hasReacted ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${hasReacted ? 'remove' : 'add'} reaction`);
      }

      // Update local state with the returned data
      const updatedQuote = await response.json();
      setReactions(updatedQuote.reactions || []);
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  if (!quote) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <EchoLayout>
          <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
            <div className="animate-pulse">
              <div className="h-12 w-32 bg-white/10 rounded mb-4" /> {/* Back button */}
              <div className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl mb-6 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-white/10 rounded-full mr-3" /> {/* Avatar */}
                  <div>
                    <div className="h-6 w-32 bg-white/10 rounded mb-2" /> {/* Name */}
                    <div className="h-4 w-24 bg-white/10 rounded" /> {/* Date */}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-white/10 rounded w-full" />
                  <div className="h-4 bg-white/10 rounded w-5/6" />
                  <div className="h-4 bg-white/10 rounded w-4/6" />
                </div>
              </div>
            </div>
          </div>
        </EchoLayout>
      </div>
    );
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
                    <AvatarImage src={quote.speaker.image_url || undefined} alt={quote.speaker.name} />
                    <AvatarFallback className="text-lg bg-white/10 text-white">
                      {quote.speaker.name[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <Link href={`/speaker/${quote.speaker.id}`}>
                    <span className="font-bold hover:underline text-lg text-white">
                      {quote.speaker.name}
                    </span>
                  </Link>
                  <p className="text-sm text-gray-300">
                    {new Date(quote.article_date).toLocaleDateString()}
                  </p>
                </div>
                {quote.speaker.organization?.logo_url && (
                  <div className="ml-auto">
                    <img 
                      src={quote.speaker.organization.logo_url} 
                      alt={quote.speaker.organization.name}
                      className="w-10 h-10 rounded-full"
                    />
                  </div>
                )}
              </div>
              <p className="text-gray-200 mb-4">"{quote.raw_quote_text}"</p>
              <div className="flex items-center gap-4">
                {reactions?.map((reaction) => (
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
                {quote.parent_monitored_url_logo && (
                  <img 
                    src={quote.parent_monitored_url_logo} 
                    alt="Source" 
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <a 
                    href={quote.article_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-white hover:underline block"
                  >
                    {quote.article_headline || quote.parent_monitored_url}
                  </a>
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
                <CommentInput 
                  quoteId={id as string} 
                  onCommentAdded={handleCommentAdded}
                />
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

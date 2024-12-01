import React, { useState, useEffect, memo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { MessageSquare, Link2, Send } from 'lucide-react';
import { useToast } from './ui/use-toast';
import ReactionButton from './reactions/ReactionButton';
import ReactionPill from './reactions/ReactionPill';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/AuthStateProvider';
import CommentList from './comments/CommentList';
import { Textarea } from './ui/textarea';
import { setQuoteInCache, updateQuoteFieldsInCache, getQuoteFromCache } from '@/utils/cache';

interface Quote {
  id: string;
  summary: string;
  raw_quote_text: string;
  article_date: string;
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
  comment_count: number;
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

interface CommentResponse {
  comments: Comment[];
  hasMore: boolean;
}

interface QuoteCardProps {
  quote: Quote;
  showComments?: boolean;
  showRawQuote?: boolean;
  onQuoteClick?: (quoteId: string) => void;
  onHover?: () => void;
}

const COMMENTS_PER_PAGE = 10;

const QuoteCard = memo(({ quote, showComments = false, showRawQuote = false, onQuoteClick, onHover }: QuoteCardProps) => {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reactions, setReactions] = useState<Quote['reactions']>(quote.reactions || []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsPage, setCommentsPage] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  // Initialize localCommentCount from cache or quote data
  const [localCommentCount, setLocalCommentCount] = useState<number>(() => {
    const cached = getQuoteFromCache(quote.id);
    const count = cached?.comment_count ?? quote.comment_count ?? 0;
    return typeof count === 'number' ? count : 0;
  });

  // Update local count when comments array changes
  useEffect(() => {
    if (Array.isArray(comments)) {
      const newCount = comments.length;
      console.log('💬 QuoteCard - Updating comment count:', {
        quoteId: quote.id,
        oldCount: localCommentCount,
        newCount,
        commentsArray: comments
      });
      setLocalCommentCount(newCount);
      
      // Update cache with the new count
      const updatedQuote = {
        ...quote,
        comment_count: newCount
      };
      setQuoteInCache(quote.id, updatedQuote);
      
      // Update newsfeed state if it exists, preserving quote order
      const newsfeedState = sessionStorage.getItem('newsfeed_state');
      if (newsfeedState) {
        try {
          const state = JSON.parse(newsfeedState);
          if (state.quotes) {
            // Find the quote's current index
            const quoteIndex = state.quotes.findIndex((q: any) => q.id === quote.id);
            if (quoteIndex !== -1) {
              // Create new quotes array with updated quote at same position
              const updatedQuotes = [...state.quotes];
              updatedQuotes[quoteIndex] = {
                ...state.quotes[quoteIndex],
                comment_count: newCount
              };
              
              // Update state while preserving all other properties
              sessionStorage.setItem('newsfeed_state', JSON.stringify({
                ...state,
                quotes: updatedQuotes
              }));
              
              console.log('✅ QuoteCard - Updated newsfeed state:', {
                quoteId: quote.id,
                newCount,
                position: quoteIndex
              });
            }
          }
        } catch (error) {
          console.error('Error updating newsfeed state:', error);
        }
      }
    }
  }, [comments, quote.id, localCommentCount, quote]);

  const fetchComments = useCallback(async (page: number) => {
    if (isLoadingComments) return;
    setIsLoadingComments(true);

    try {
      const response = await fetch(`/api/quotes/${quote.id}/comments?page=${page}&limit=${COMMENTS_PER_PAGE}`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      
      const data = await response.json();
      console.log('Fetched comments data:', data);
      
      if (!data || !Array.isArray(data.comments)) {
        console.error('Invalid comments data structure:', data);
        throw new Error('Invalid comments data structure');
      }

      // Ensure each comment has the required structure and all fields are strings
      const validatedComments = data.comments.map((comment: any) => ({
        id: String(comment.id || ''),
        text: String(comment.text || ''),
        created_at: String(comment.created_at || new Date().toISOString()),
        user: {
          id: String(comment.user?.id || ''),
          name: String(comment.user?.name || 'Anonymous'),
          image: comment.user?.image ? String(comment.user.image) : null
        },
        reactions: Array.isArray(comment.reactions) 
          ? comment.reactions.map((reaction: any) => ({
              emoji: String(reaction.emoji || ''),
              users: Array.isArray(reaction.users) 
                ? reaction.users.map((user: any) => ({ id: String(user.id || '') }))
                : []
            }))
          : []
      }));

      // If it's the first page, replace all comments
      // If it's a subsequent page, append new comments
      setComments(prev => {
        const newComments = page === 0 ? validatedComments : [...prev, ...validatedComments];
        // Remove any potential duplicates
        return Array.from(new Map(newComments.map(comment => [comment.id, comment])).values());
      });
      setHasMoreComments(!!data.hasMore);
      setCommentsPage(page + 1);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]); // Reset comments on error
      toast({
        variant: "destructive",
        description: "Failed to load comments",
        duration: 2000,
      });
    } finally {
      setIsLoadingComments(false);
    }
  }, [quote.id, isLoadingComments, toast]);

  const loadMoreComments = useCallback(() => {
    if (!isLoadingComments && hasMoreComments) {
      fetchComments(commentsPage);
    }
  }, [fetchComments, isLoadingComments, hasMoreComments, commentsPage]);

  // Reset and fetch comments when showComments changes
  useEffect(() => {
    if (showComments) {
      setCommentsPage(0);
      setComments([]); // Clear existing comments
      fetchComments(0);
    }
  }, [showComments, quote.id]);

  useEffect(() => {
    setReactions(quote.reactions || []);
  }, [quote.reactions]);

  const handleReactionSelect = useCallback(async (emoji: string) => {
    if (!user) {
      toast({
        variant: "destructive",
        description: "Please sign in to react to quotes",
        duration: 2000,
      });
      router.push('/auth/signin');
      return;
    }

    // Optimistically update the UI
    const optimisticReactions = [...(reactions || [])];
    const existingReaction = optimisticReactions.find(r => r.emoji === emoji);
    if (existingReaction) {
      // Don't add duplicate user
      if (!existingReaction.users.some(u => u.id === user.id)) {
        existingReaction.users.push({ id: user.id });
      }
    } else {
      optimisticReactions.push({ emoji, users: [{ id: user.id }] });
    }
    setReactions(optimisticReactions);

    try {
      const response = await fetch(`/api/quotes/${quote.id}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Failed to add reaction');
      }
    } catch (error) {
      // Revert optimistic update on error
      setReactions(reactions || []);
      console.error('Error adding reaction:', error);
      toast({
        variant: "destructive",
        description: "Failed to add reaction",
        duration: 2000,
      });
    }
  }, [user, quote.id, reactions, toast, router]);

  const handleReactionClick = useCallback(async (e: React.MouseEvent, emoji: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast({
        variant: "destructive",
        description: "Please sign in to react to quotes",
        duration: 2000,
      });
      router.push('/auth/signin');
      return;
    }

    const hasReacted = reactions?.find(r => r.emoji === emoji)
      ?.users.some(u => u.id === user.id);

    // Optimistically update the UI
    const optimisticReactions = [...(reactions || [])];
    const existingReaction = optimisticReactions.find(r => r.emoji === emoji);
    
    if (existingReaction) {
      if (hasReacted) {
        // Remove user from reaction
        existingReaction.users = existingReaction.users.filter(u => u.id !== user.id);
        // Remove the reaction entirely if no users left
        if (existingReaction.users.length === 0) {
          const index = optimisticReactions.findIndex(r => r.emoji === emoji);
          if (index > -1) optimisticReactions.splice(index, 1);
        }
      } else {
        // Add user to existing reaction
        existingReaction.users.push({ id: user.id });
      }
    } else if (!hasReacted) {
      // Add new reaction
      optimisticReactions.push({ emoji, users: [{ id: user.id }] });
    }
    
    setReactions(optimisticReactions);

    try {
      await fetch(`/api/quotes/${quote.id}/reactions?emoji=${emoji}`, {
        method: hasReacted ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      // Don't update state with server response - keep optimistic update
      // unless there's an error
    } catch (error) {
      // Revert optimistic update on error
      setReactions(reactions || []);
      console.error('Error updating reaction:', error);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : `Failed to ${hasReacted ? 'remove' : 'add'} reaction`,
        duration: 2000,
      });
    }
  }, [user, quote.id, reactions, toast, router]);

  const handleCommentClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/quote/${quote.id}#comments`);
  }, [quote.id, router]);

  const handleCopyLink = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    const quoteUrl = `${window.location.origin}/quote/${quote.id}`;
    
    try {
      await navigator.clipboard.writeText(quoteUrl);
      toast({
        description: "Link copied to clipboard",
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast({
        variant: "destructive",
        description: "Failed to copy link",
        duration: 2000,
      });
    }
  }, [quote.id, toast]);

  const handleQuoteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onQuoteClick) {
      onQuoteClick(quote.id);
    } else {
      router.push(`/quote/${quote.id}`);
    }
  }, [quote.id, onQuoteClick, router]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        variant: "destructive",
        description: "Please sign in to comment",
        duration: 2000,
      });
      router.push('/auth/signin');
      return;
    }

    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      console.log('�� QuoteCard - Submitting new comment:', {
        quoteId: quote.id,
        currentCount: localCommentCount
      });

      const response = await fetch(`/api/quotes/${quote.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newComment.trim() }),
      });

      if (!response.ok) throw new Error('Failed to post comment');
      
      const rawComment = await response.json();
      
      // Format the comment object properly
      const formattedComment = {
        id: String(rawComment.id),
        text: String(rawComment.text || ''),
        created_at: String(rawComment.created_at),
        user: {
          id: String(rawComment.user?.id || ''),
          name: String(rawComment.user?.name || ''),
          image: rawComment.user?.image ? String(rawComment.user.image) : null
        },
        reactions: []
      };
      
      // Update comments array and count
      setComments(prev => {
        const newComments = [formattedComment, ...prev];
        const newCount = newComments.length;
        console.log('✨ QuoteCard - New comment added:', {
          quoteId: quote.id,
          oldCount: localCommentCount,
          newCount,
          comment: formattedComment
        });
        // Update cache with new count
        updateQuoteFieldsInCache(quote.id, { comment_count: newCount });
        console.log(' QuoteCard - Cache after comment:', {
          quoteId: quote.id,
          cacheValue: getQuoteFromCache(quote.id)
        });
        return newComments;
      });
      
      setNewComment('');
      
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        variant: "destructive",
        description: "Failed to post comment",
        duration: 2000,
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <Card 
      className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl hover:bg-white/[0.15] transition-all"
      onMouseEnter={onHover}
    >
      <CardContent className="pt-4 pb-2 cursor-pointer transition-colors" onClick={handleQuoteClick}>
        <div className="flex items-center mb-3">
          <div className="avatar-click-area" onClick={(e) => e.stopPropagation()}>
            <Avatar className="mr-3 h-12 w-12 ring-2 ring-white/20">
              <AvatarImage src={quote.speaker.image_url || undefined} alt={quote.speaker.name} />
              <AvatarFallback className="text-lg bg-white/10 text-white">
                {quote.speaker.name[0]}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <Link href={`/speaker/${quote.speaker.id}`} onClick={(e) => e.stopPropagation()}>
              <span className="font-bold hover:underline text-lg text-white">
                {quote.speaker.name}
              </span>
            </Link>
            <p className="text-sm text-gray-300">
              {new Date(quote.article_date).toLocaleDateString()}
            </p>
          </div>
          {quote.speaker.organization?.logo_url && (
            <div className="avatar-click-area ml-auto">
              <img 
                src={quote.speaker.organization.logo_url} 
                alt={quote.speaker.organization.name}
                className="w-10 h-10 rounded-full"
              />
            </div>
          )}
        </div>
        <p className="text-lg mb-2 text-gray-100">
          {showRawQuote ? quote.raw_quote_text : quote.summary}
        </p>
        
        <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
          {reactions?.map((reaction) => (
            <ReactionPill
              key={reaction.emoji}
              emoji={reaction.emoji}
              count={reaction.users.length}
              isUserReaction={reaction.users.some(u => user?.id === u.id)}
              onClick={(e) => handleReactionClick(e, reaction.emoji)}
            />
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-center py-2 border-t border-white/10">
        <div className="flex space-x-2">
          <ReactionButton 
            quoteId={quote.id} 
            onReactionSelect={handleReactionSelect}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCommentClick}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            <span className="text-sm">
              {quote.comment_count}
            </span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCopyLink}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            <Link2 className="h-4 w-4 mr-1" />
          </Button>
        </div>
      </CardFooter>

      {showComments && (
        <>
          {user && (
            <form onSubmit={handleSubmitComment} className="px-4 py-3 border-t border-white/10">
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.user_metadata?.avatar_url || undefined} />
                  <AvatarFallback>{user.user_metadata?.full_name?.[0] || user.email?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="min-h-[2.5rem] bg-white/5 border-white/10 resize-none"
                  />
                  <Button 
                    type="submit" 
                    size="sm"
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>
          )}
          <div className="border-t border-white/10">
            {isLoadingComments && comments.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500">Loading comments...</p>
              </div>
            ) : (
              <CommentList 
                comments={comments} 
                onLoadMore={loadMoreComments}
                hasMore={hasMoreComments}
                onCommentUpdate={() => fetchComments(0)}
              />
            )}
          </div>
        </>
      )}
    </Card>
  );
});

QuoteCard.displayName = 'QuoteCard';

export default QuoteCard;

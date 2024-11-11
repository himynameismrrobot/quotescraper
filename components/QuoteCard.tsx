import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { MessageSquare, Link2 } from 'lucide-react';
import { useToast } from './ui/use-toast';
import ReactionButton from './reactions/ReactionButton';
import ReactionPill from './reactions/ReactionPill';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

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
  comments?: number;
}

const QuoteCard = ({ quote }: { quote: Quote }) => {
  console.log('Quote data:', quote);
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const [reactions, setReactions] = useState<Quote['reactions']>(quote.reactions || []);
  const [userId, setUserId] = useState<string | null>(null);

  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const handleReactionSelect = async (emoji: string) => {
    if (!userId) {
      toast({
        variant: "destructive",
        description: "Please sign in to react to quotes",
        duration: 2000,
      });
      router.push('/auth/signin');
      return;
    }

    try {
      const response = await fetch(`/api/quotes/${quote.id}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add reaction');
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
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to add reaction",
        duration: 2000,
      });
    }
  };

  const handleReactionClick = async (emoji: string) => {
    if (!userId) {
      toast({
        variant: "destructive",
        description: "Please sign in to react to quotes",
        duration: 2000,
      });
      router.push('/auth/signin');
      return;
    }

    const hasReacted = reactions?.find(r => r.emoji === emoji)
      ?.users.some(u => u.id === userId);

    try {
      const response = await fetch(`/api/quotes/${quote.id}/reactions?emoji=${emoji}`, {
        method: hasReacted ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${hasReacted ? 'remove' : 'add'} reaction`);
      }

      // Update local state with the returned data
      const updatedQuote = await response.json();
      setReactions(updatedQuote.reactions || []);
    } catch (error) {
      console.error('Error updating reaction:', error);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : `Failed to ${hasReacted ? 'remove' : 'add'} reaction`,
        duration: 2000,
      });
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/quote/${quote.id}#comments`);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
  };

  return (
    <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl hover:bg-white/[0.15] transition-all">
      <CardContent className="pt-4 pb-2 cursor-pointer transition-colors">
        <Link href={`/quote/${quote.id}`}>
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
          <p className="text-lg mb-2 text-gray-100">{quote.summary}</p>
        </Link>
        
        <div className="flex items-center gap-4">
          {reactions.map((reaction) => (
            <ReactionPill
              key={reaction.emoji}
              emoji={reaction.emoji}
              count={reaction.users.length}
              isUserReaction={reaction.users.some(u => u.id === userId)}
              onClick={() => handleReactionClick(reaction.emoji)}
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
            {quote.comments}
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
    </Card>
  );
};

export default QuoteCard;

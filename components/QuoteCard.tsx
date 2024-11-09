import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { MessageSquare, Link2 } from 'lucide-react';
import { useToast } from './ui/use-toast';
import ReactionButton from './reactions/ReactionButton';
import ReactionPill from './reactions/ReactionPill';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

interface Reaction {
  emoji: string;
  users: { id: string }[];
}

interface QuoteCardProps {
  id: string;
  summary: string;
  rawQuoteText?: string;
  speakerName: string;
  speakerImage?: string;
  organizationLogo?: string;
  articleDate: string;
  comments: number;
  reactions?: Reaction[];
  className?: string;
}

const QuoteCard: React.FC<QuoteCardProps> = ({
  id,
  summary,
  speakerName,
  speakerImage,
  organizationLogo,
  articleDate,
  comments,
  reactions = [],
  className,
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const userId = session?.user?.id;

  const handleReactionSelect = async (emoji: string) => {
    try {
      console.log('Sending reaction:', { quoteId: id, emoji });
      const response = await fetch(`/api/quotes/${id}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to add reaction');
      }
      
      console.log('Reaction response:', data);
      window.location.reload();
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  };

  const handleReactionClick = async (emoji: string) => {
    const hasReacted = reactions
      .find(r => r.emoji === emoji)
      ?.users.some(u => u.id === userId);

    try {
      const response = await fetch(`/api/quotes/${id}/reactions`, {
        method: hasReacted ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${hasReacted ? 'remove' : 'add'} reaction`);
      }

      // Refresh the quote data to get updated reactions
      window.location.reload();
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/quote/${id}#comments`);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const quoteUrl = `${window.location.origin}/quote/${id}`;
    
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
    <Card className={`w-full ${className || ''}`}>
      <Link href={`/quote/${id}`}>
        <CardContent className="pt-4 pb-2 cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex items-center mb-3">
            <div className="avatar-click-area" onClick={(e) => e.stopPropagation()}>
              <Avatar className="mr-3 h-12 w-12">
                <AvatarImage src={speakerImage} alt={speakerName} />
                <AvatarFallback className="text-lg">{speakerName[0]}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <Link href={`/speaker/${encodeURIComponent(speakerName)}`} onClick={(e) => e.stopPropagation()}>
                <span className="font-bold hover:underline text-lg">{speakerName}</span>
              </Link>
              <p className="text-sm text-gray-500">{new Date(articleDate).toLocaleDateString()}</p>
            </div>
            {organizationLogo && (
              <div className="avatar-click-area ml-auto">
                <img src={organizationLogo} alt="Organization" className="w-10 h-10" />
              </div>
            )}
          </div>
          <p className="text-lg mb-2">{summary}</p>
          <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
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
      </Link>
      <CardFooter className="flex justify-center py-2 border-t" onClick={(e) => e.stopPropagation()}>
        <div className="flex space-x-2">
          <ReactionButton 
            quoteId={id} 
            onReactionSelect={handleReactionSelect}
          />
          <Button variant="ghost" size="sm" onClick={handleCommentClick}>
            <MessageSquare className="h-4 w-4 mr-1" />
            {comments}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopyLink}>
            <Link2 className="h-4 w-4 mr-1" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default QuoteCard;

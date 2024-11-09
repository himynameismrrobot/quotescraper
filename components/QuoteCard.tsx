import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { MessageSquare, Share } from 'lucide-react';
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

  return (
    <Card className={`w-full ${className || ''}`}>
      <Link href={`/quote/${id}`}>
        <CardContent className="pt-6 cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex items-center mb-2">
            <div className="avatar-click-area" onClick={(e) => e.stopPropagation()}>
              <Avatar className="mr-2">
                <AvatarImage src={speakerImage} alt={speakerName} />
                <AvatarFallback>{speakerName[0]}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <Link href={`/speaker/${encodeURIComponent(speakerName)}`} onClick={(e) => e.stopPropagation()}>
                <span className="font-bold hover:underline">{speakerName}</span>
              </Link>
              <p className="text-sm text-gray-500">{new Date(articleDate).toLocaleDateString()}</p>
            </div>
            {organizationLogo && (
              <div className="avatar-click-area ml-auto">
                <img src={organizationLogo} alt="Organization" className="w-6 h-6" />
              </div>
            )}
          </div>
          <p className="text-lg">{summary}</p>
        </CardContent>
      </Link>
      <CardFooter className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap gap-2">
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
        <div className="flex space-x-2">
          <ReactionButton 
            quoteId={id} 
            onReactionSelect={handleReactionSelect}
          />
          <Button variant="ghost" size="sm" onClick={handleCommentClick}>
            <MessageSquare className="h-4 w-4 mr-1" />
            {comments}
          </Button>
          <Button variant="ghost" size="sm">
            <Share className="h-4 w-4 mr-1" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default QuoteCard;

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import ReactionButton from '../reactions/ReactionButton';
import ReactionPill from '../reactions/ReactionPill';
import { useSession } from 'next-auth/react';

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

interface CommentListProps {
  comments: Comment[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const CommentList: React.FC<CommentListProps> = ({ comments, onLoadMore, hasMore }) => {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const handleReactionSelect = async (commentId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Failed to add reaction');
      }

      window.location.reload();
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleReactionClick = async (commentId: string, emoji: string) => {
    const comment = comments.find(c => c.id === commentId);
    const hasReacted = comment?.reactions
      .find(r => r.emoji === emoji)
      ?.users.some(u => u.id === userId);

    try {
      const response = await fetch(`/api/comments/${commentId}/reactions`, {
        method: hasReacted ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${hasReacted ? 'remove' : 'add'} reaction`);
      }

      window.location.reload();
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  return (
    <div className="space-y-4">
      {comments.map((comment, index) => (
        <div key={comment.id}>
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-white/20">
              <AvatarImage src={comment.user.image || undefined} />
              <AvatarFallback className="bg-white/10 text-white">
                {comment.user.name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white">{comment.user.name}</span>
                <span className="text-sm text-gray-400">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-200 mb-3">{comment.text}</p>
              <div className="flex items-center gap-2">
                {comment.reactions.map((reaction) => (
                  <ReactionPill
                    key={reaction.emoji}
                    emoji={reaction.emoji}
                    count={reaction.users.length}
                    isUserReaction={reaction.users.some(u => u.id === userId)}
                    onClick={() => handleReactionClick(comment.id, reaction.emoji)}
                  />
                ))}
                <ReactionButton
                  quoteId={comment.id}
                  onReactionSelect={(emoji) => handleReactionSelect(comment.id, emoji)}
                />
              </div>
            </div>
          </div>
          {index < comments.length - 1 && (
            <div className="my-4 border-t border-white/10" />
          )}
        </div>
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button 
            onClick={onLoadMore} 
            variant="ghost"
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            Load more comments
          </Button>
        </div>
      )}
    </div>
  );
};

export default CommentList; 
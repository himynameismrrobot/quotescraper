import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
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
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Failed to add reaction');
      }

      // Refresh the page to show updated reactions
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
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Failed to update reaction');
      }

      // Refresh the page to show updated reactions
      window.location.reload();
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div key={comment.id} className="flex items-start gap-4">
          <Avatar>
            <AvatarImage src={comment.user.image || undefined} alt={comment.user.name || 'User'} />
            <AvatarFallback>{comment.user.name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold">{comment.user.name}</p>
              <p className="text-sm text-gray-600">{comment.text}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleDateString()}
              </span>
              <div className="flex flex-wrap gap-2">
                {comment.reactions.map((reaction) => (
                  <ReactionPill
                    key={reaction.emoji}
                    emoji={reaction.emoji}
                    count={reaction.users.length}
                    isUserReaction={reaction.users.some(u => u.id === userId)}
                    onClick={() => handleReactionClick(comment.id, reaction.emoji)}
                  />
                ))}
              </div>
              <ReactionButton
                quoteId={comment.id}
                onReactionSelect={(emoji) => handleReactionSelect(comment.id, emoji)}
              />
            </div>
          </div>
        </div>
      ))}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            onClick={onLoadMore}
            className="text-blue-500 hover:text-blue-600"
          >
            Load more comments
          </button>
        </div>
      )}
    </div>
  );
};

export default CommentList; 
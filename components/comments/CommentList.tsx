import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import ReactionButton from '../reactions/ReactionButton';
import ReactionPill from '../reactions/ReactionPill';
import { useAuth } from '@/components/AuthStateProvider';

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

interface CommentListProps {
  comments: Comment[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  onCommentUpdate?: () => void;
}

const CommentList: React.FC<CommentListProps> = ({ 
  comments = [], 
  onLoadMore, 
  hasMore,
  onCommentUpdate
}) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [isUpdating, setIsUpdating] = useState(false);
  const [localComments, setLocalComments] = useState<Comment[]>(comments);

  // Update local comments when props change, but preserve local state for reactions
  useEffect(() => {
    setLocalComments(prevComments => {
      return comments.map(newComment => {
        const existingComment = prevComments.find(c => c.id === newComment.id);
        // If we have local state for this comment, preserve its reactions
        if (existingComment) {
          return {
            ...newComment,
            reactions: existingComment.reactions
          };
        }
        return newComment;
      });
    });
  }, [comments]);

  const handleReactionSelect = async (commentId: string, emoji: string) => {
    if (isUpdating || !userId) return;
    
    // Update local state optimistically first
    setLocalComments(prevComments => 
      prevComments.map(comment => {
        if (comment.id === commentId) {
          const existingReaction = comment.reactions?.find(r => r.emoji === emoji);
          const updatedReactions = comment.reactions || [];
          
          if (existingReaction) {
            // Don't add duplicate user
            if (!existingReaction.users.some(u => u.id === userId)) {
              existingReaction.users = [...existingReaction.users, { id: userId }];
            }
            return { ...comment, reactions: updatedReactions };
          } else {
            return {
              ...comment,
              reactions: [...updatedReactions, { emoji, users: [{ id: userId }] }]
            };
          }
        }
        return comment;
      })
    );
    
    try {
      setIsUpdating(true);
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

    } catch (error) {
      console.error('Error adding reaction:', error);
      // Revert local state on error
      setLocalComments(prevComments => 
        prevComments.map(comment => {
          if (comment.id === commentId) {
            const originalComment = comments.find(c => c.id === commentId);
            return { ...comment, reactions: originalComment?.reactions || [] };
          }
          return comment;
        })
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReactionClick = async (commentId: string, emoji: string) => {
    if (isUpdating) return;
    
    try {
      setIsUpdating(true);

      // Update local state optimistically first
      setLocalComments(prevComments => 
        prevComments.map(comment => {
          if (comment.id === commentId) {
            const updatedReactions = comment.reactions?.map(reaction => {
              if (reaction.emoji === emoji) {
                return {
                  ...reaction,
                  users: reaction.users.filter(u => u.id !== userId)
                };
              }
              return reaction;
            }).filter(reaction => reaction.users.length > 0) || [];
            
            return { ...comment, reactions: updatedReactions };
          }
          return comment;
        })
      );
      
      const response = await fetch(`/api/comments/${commentId}/reactions`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove reaction');
      }

    } catch (error) {
      console.error('Error removing reaction:', error);
      // Revert local state on error
      setLocalComments(comments);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!localComments.length) {
    return <p className="text-gray-500 text-center py-4">No comments yet</p>;
  }

  return (
    <div className="space-y-4">
      {localComments.map((comment) => (
        <div key={`comment-${comment.id}`} className="flex space-x-4">
          <Avatar>
            <AvatarImage src={comment.user.image || undefined} />
            <AvatarFallback>{comment.user.name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white">{comment.user.name}</span>
                <span className="text-sm text-gray-400">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-200">{comment.text}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <ReactionButton 
                quoteId={comment.id} 
                onReactionSelect={(emoji) => handleReactionSelect(comment.id, emoji)}
              />
              {comment.reactions?.map((reaction) => (
                <ReactionPill
                  key={`${comment.id}-${reaction.emoji}`}
                  emoji={reaction.emoji}
                  count={reaction.users.length}
                  isUserReaction={reaction.users.some(u => u.id === userId)}
                  onClick={() => handleReactionClick(comment.id, reaction.emoji)}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
      {hasMore && (
        <div className="text-center pt-4">
          <Button 
            variant="ghost" 
            onClick={onLoadMore}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};

export default CommentList;
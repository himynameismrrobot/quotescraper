import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useAuth } from '@/components/AuthStateProvider';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface CommentInputProps {
  quoteId: string;
  onCommentAdded?: () => void;
}

const CommentInput: React.FC<CommentInputProps> = ({ quoteId, onCommentAdded }) => {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: comment }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      setComment('');
      onCommentAdded?.();
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start space-x-4">
        <Avatar>
          <AvatarImage src={user.user_metadata.avatar_url} />
          <AvatarFallback>{user.user_metadata.name?.[0]}</AvatarFallback>
        </Avatar>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 min-h-[100px] bg-white/10 border-white/20 text-white"
        />
      </div>
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={!comment.trim() || isSubmitting}
          className="bg-white/10 hover:bg-white/20 text-white"
        >
          {isSubmitting ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </form>
  );
};

export default CommentInput; 
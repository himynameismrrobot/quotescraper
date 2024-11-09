import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface CommentInputProps {
  quoteId: string;
  onCommentAdded?: () => void;
}

const CommentInput: React.FC<CommentInputProps> = ({ quoteId, onCommentAdded }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text: comment.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      setComment('');
      onCommentAdded?.();
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        type="text"
        placeholder="Add a comment..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={isSubmitting}
      />
      <Button 
        type="submit" 
        disabled={!comment.trim() || isSubmitting}
      >
        {isSubmitting ? 'Posting...' : 'Post Comment'}
      </Button>
    </form>
  );
};

export default CommentInput; 
import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useSession } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface CommentInputProps {
  quoteId: string;
  onCommentAdded?: () => void;
}

const CommentInput: React.FC<CommentInputProps> = ({ quoteId, onCommentAdded }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session } = useSession();

  const handleSubmit = async () => {
    if (!comment.trim() || isSubmitting) return;

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

  if (!session) return null;

  return (
    <div className="flex gap-4 p-4 backdrop-blur-xl bg-white/10 border border-white/20 rounded-lg shadow-xl">
      <Avatar className="h-10 w-10 ring-2 ring-white/20">
        <AvatarImage src={session.user?.image || undefined} />
        <AvatarFallback className="bg-white/10 text-white">
          {session.user?.name?.[0] || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-3">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a comment..."
          className="min-h-[80px] bg-white/5 border-white/10 text-white placeholder:text-gray-400"
        />
        <div className="flex justify-end">
          <Button 
            onClick={handleSubmit} 
            disabled={!comment.trim() || isSubmitting}
            className="bg-white/10 text-white hover:bg-white/20"
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CommentInput; 
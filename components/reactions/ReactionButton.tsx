import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface ReactionButtonProps {
  quoteId: string;
  onReactionSelect: (emoji: string) => void;
}

const EMOJI_OPTIONS = ['👍', '👎', '😄', '😢', '😡', '❤️', '🎉', '🤔'];

const ReactionButton: React.FC<ReactionButtonProps> = ({ quoteId, onReactionSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onReactionSelect(emoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Smile className="h-4 w-4 mr-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-2" align="start">
        <div className="flex flex-wrap gap-2">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className="text-2xl hover:bg-gray-100 p-2 rounded-md transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ReactionButton; 
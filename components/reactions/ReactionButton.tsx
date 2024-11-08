import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Smile } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface ReactionButtonProps {
  quoteId: string;
  onReactionSelect: (emoji: string) => void;
}

const ReactionButton: React.FC<ReactionButtonProps> = ({ quoteId, onReactionSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiSelect = (emoji: any) => {
    onReactionSelect(emoji.native); // Get the native emoji character
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-gray-500 hover:text-gray-700"
        >
          <Smile className="h-4 w-4 mr-1" />
          <span className="sr-only">Add reaction</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Picker
          data={data}
          onEmojiSelect={handleEmojiSelect}
          theme="light"
          previewPosition="none"
          skinTonePosition="none"
        />
      </PopoverContent>
    </Popover>
  );
};

export default ReactionButton; 
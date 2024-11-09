import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Smile } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface ReactionButtonProps {
  quoteId: string;
  onReactionSelect: (emoji: string) => void;
}

const ReactionButton: React.FC<ReactionButtonProps> = ({ onReactionSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiSelect = (emoji: any) => {
    onReactionSelect(emoji.native);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-gray-300 hover:text-white hover:bg-white/10"
        >
          <Smile className="h-4 w-4 mr-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-gray-800/90 backdrop-blur-xl border-white/10"
        sideOffset={5}
      >
        <Picker 
          data={data} 
          onEmojiSelect={handleEmojiSelect}
          theme="dark"
          skinTonePosition="none"
        />
      </PopoverContent>
    </Popover>
  );
};

export default ReactionButton; 
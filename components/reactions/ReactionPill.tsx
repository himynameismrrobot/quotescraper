import React from 'react';
import { cn } from '@/lib/utils';

interface ReactionPillProps {
  emoji: string;
  count: number;
  isUserReaction?: boolean;
  onClick?: () => void;
}

const ReactionPill: React.FC<ReactionPillProps> = ({
  emoji,
  count,
  isUserReaction = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm",
        "hover:bg-gray-100 transition-colors",
        "border border-gray-200",
        isUserReaction ? "bg-blue-50" : "bg-gray-50"
      )}
    >
      <span>{emoji}</span>
      <span className="text-gray-600">{count}</span>
    </button>
  );
};

export default ReactionPill; 
import React from 'react';

interface ReactionPillProps {
  emoji: string;
  count: number;
  isUserReaction: boolean;
  onClick: () => void;
}

const ReactionPill: React.FC<ReactionPillProps> = ({
  emoji,
  count,
  isUserReaction,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full
        transition-all duration-200
        ${isUserReaction 
          ? 'bg-white/20 backdrop-blur-lg shadow-lg' 
          : 'bg-white/10 hover:bg-white/15 backdrop-blur-md'
        }
        border border-white/10
        text-white
      `}
    >
      <span className="text-sm">{emoji}</span>
      <span className="text-sm font-medium">{count}</span>
    </button>
  );
};

export default ReactionPill; 
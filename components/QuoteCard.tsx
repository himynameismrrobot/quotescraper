import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Card, CardContent, CardFooter } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { ThumbsUp, MessageSquare, Share } from 'lucide-react';

interface QuoteCardProps {
  id: string;
  summary: string;
  rawQuoteText?: string; // Make this optional since we won't always need it
  speakerName: string;
  speakerImage?: string;
  organizationLogo?: string;
  articleDate: string;
  likes: number;
  comments: number;
}

const QuoteCard: React.FC<QuoteCardProps> = ({
  id,
  summary,
  speakerName,
  speakerImage,
  organizationLogo,
  articleDate,
  likes,
  comments,
}) => {
  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation if the click is on a button, link, or avatar
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest('button') ||
        e.target.closest('a') ||
        e.target.closest('.avatar-click-area'))
    ) {
      return;
    }
    router.push(`/quote/${id}`);
  };

  return (
    <Card className="mb-4 max-w-[600px] mx-auto cursor-pointer" onClick={handleCardClick}>
      <CardContent className="pt-4">
        <div className="flex items-center mb-2">
          <div className="avatar-click-area">
            <Avatar className="mr-2">
              <AvatarImage src={speakerImage} alt={speakerName} />
              <AvatarFallback>{speakerName[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div>
            <Link href={`/speaker/${encodeURIComponent(speakerName)}`}>
              <span className="font-bold hover:underline">{speakerName}</span>
            </Link>
            <p className="text-sm text-gray-500">{new Date(articleDate).toLocaleDateString()}</p>
          </div>
          {organizationLogo && (
            <div className="avatar-click-area ml-auto">
              <img src={organizationLogo} alt="Organization" className="w-6 h-6" />
            </div>
          )}
        </div>
        <p className="text-lg">{summary}</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" size="sm">
          <ThumbsUp className="mr-2 h-4 w-4" />
          {likes}
        </Button>
        <Link href={`/quote/${id}`}>
          <Button variant="ghost" size="sm">
            <MessageSquare className="mr-2 h-4 w-4" />
            {comments}
          </Button>
        </Link>
        <Button variant="ghost" size="sm">
          <Share className="mr-2 h-4 w-4" />
          Share
        </Button>
      </CardFooter>
    </Card>
  );
};

export default QuoteCard;

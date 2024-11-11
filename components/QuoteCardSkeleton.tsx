import { Card, CardContent, CardFooter } from './ui/card';

export default function QuoteCardSkeleton() {
  return (
    <Card className="w-full backdrop-blur-xl bg-white/10 border-white/20 shadow-xl">
      <CardContent className="pt-4 pb-2">
        <div className="flex items-center mb-3">
          <div className="w-12 h-12 rounded-full bg-white/10 animate-pulse mr-3" />
          <div className="flex-1">
            <div className="h-5 w-32 bg-white/10 animate-pulse rounded mb-2" />
            <div className="h-4 w-24 bg-white/10 animate-pulse rounded" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse ml-auto" />
        </div>
        <div className="space-y-2">
          <div className="h-5 bg-white/10 animate-pulse rounded w-full" />
          <div className="h-5 bg-white/10 animate-pulse rounded w-3/4" />
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="h-8 w-16 bg-white/10 animate-pulse rounded-full" />
          <div className="h-8 w-16 bg-white/10 animate-pulse rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-center py-2 border-t border-white/10">
        <div className="flex space-x-2">
          <div className="h-8 w-8 bg-white/10 animate-pulse rounded" />
          <div className="h-8 w-8 bg-white/10 animate-pulse rounded" />
          <div className="h-8 w-8 bg-white/10 animate-pulse rounded" />
        </div>
      </CardFooter>
    </Card>
  );
} 
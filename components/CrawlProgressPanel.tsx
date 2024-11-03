import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface CrawlProgressPanelProps {
  logs: string[];
}

const CrawlProgressPanel: React.FC<CrawlProgressPanelProps> = ({ logs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Crawl Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          ref={logContainerRef}
          className="h-96 overflow-y-auto bg-gray-100 p-4 rounded"
        >
          {logs.map((log, index) => (
            <p key={index} className="text-sm mb-1">
              {log}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CrawlProgressPanel;

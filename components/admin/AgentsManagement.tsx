import { useState } from 'react';
import { useAuth } from '@/components/AuthStateProvider';
import { useSupabase } from '@/lib/providers/supabase-provider';

export default function AgentsManagement() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { user, loading } = useAuth();
  const { supabase } = useSupabase();

  const handleRunCrawler = async () => {
    if (!user) {
      setLogs(prev => [...prev, 'Error: No user found']);
      return;
    }

    try {
      setIsRunning(true);
      setLogs(prev => [...prev, 'Starting workflow...']);

      // Get monitored URLs
      const { data: monitoredUrls, error: urlError } = await supabase
        .from('monitored_urls')
        .select('url');

      if (urlError) {
        throw new Error(`Failed to get monitored URLs: ${urlError.message}`);
      }

      setLogs(prev => [...prev, `Found ${monitoredUrls?.length || 0} monitored URLs`]);

      // Generate a unique thread ID for this run
      const threadId = `quote-scraper-${Date.now()}`;

      // Run the workflow
      const response = await fetch('/api/admin/agents/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          urls: monitoredUrls?.map(u => u.url) || [],
          config: {
            similarityThreshold: 0.85,
            maxParallelExtractions: 5,
            threadId,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run workflow');
      }

      const result = await response.json();
      setLogs(prev => [...prev, 'Workflow completed successfully']);
      console.log('Workflow result:', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLogs(prev => [...prev, `Error: ${message}`]);
      console.error('Error running workflow:', error);
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!user) {
    return <div className="p-4">Please sign in to access this page.</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Agent Management</h1>
      
      <div className="mb-4">
        <button
          onClick={handleRunCrawler}
          disabled={isRunning}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {isRunning ? 'Running...' : 'Run Quote Crawler'}
        </button>
      </div>

      <div className="mt-4">
        <h2 className="text-xl font-semibold mb-2">Logs</h2>
        <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
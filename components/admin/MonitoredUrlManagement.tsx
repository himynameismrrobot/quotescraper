import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Upload, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MonitoredURL {
  id: string;
  url: string;
  logo_url: string | null;
  last_crawled_at: string | null;
}

const MonitoredUrlManagement: React.FC = () => {
  const [monitoredUrls, setMonitoredUrls] = useState<MonitoredURL[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newUrlLogo, setNewUrlLogo] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [specificArticleUrl, setSpecificArticleUrl] = useState('');

  useEffect(() => {
    fetchMonitoredUrls();
  }, []);

  const fetchMonitoredUrls = async () => {
    try {
      const response = await fetch('/api/admin/monitored-urls');
      if (!response.ok) {
        throw new Error('Failed to fetch monitored URLs');
      }
      const data = await response.json();
      setMonitoredUrls(data);
    } catch (error) {
      console.error('Error fetching monitored URLs:', error);
    }
  };

  const handleAddMonitoredUrl = async () => {
    try {
      const response = await fetch('/api/admin/monitored-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: newUrl, 
          logo_url: newUrlLogo || null 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add monitored URL');
      }
      
      setNewUrl('');
      setNewUrlLogo('');
      fetchMonitoredUrls();
    } catch (error) {
      console.error('Error adding monitored URL:', error);
    }
  };

  const handleRemoveMonitoredUrl = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/monitored-urls/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete monitored URL');
      }
      
      fetchMonitoredUrls();
    } catch (error) {
      console.error('Error removing monitored URL:', error);
    }
  };

  const handleManualCrawl = async (url: string) => {
    setIsCrawling(true);
    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger crawl');
      }

      // Refresh the URLs to update last crawled time
      fetchMonitoredUrls();
    } catch (error) {
      console.error('Error triggering crawl:', error);
    } finally {
      setIsCrawling(false);
    }
  };

  const handleSpecificArticleCrawl = async (url: string) => {
    if (!url.trim()) return;
    
    setIsCrawling(true);
    try {
      const response = await fetch('/api/crawl-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger article crawl');
      }

      setSpecificArticleUrl('');
    } catch (error) {
      console.error('Error triggering article crawl:', error);
    } finally {
      setIsCrawling(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Crawl Specific Article</CardTitle>
          <CardDescription>Enter a specific article URL to crawl for quotes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input 
              placeholder="Article URL to crawl" 
              value={specificArticleUrl}
              onChange={(e) => setSpecificArticleUrl(e.target.value)}
            />
            <Button 
              onClick={() => handleSpecificArticleCrawl(specificArticleUrl)}
              disabled={isCrawling}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Crawl Article
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>URL Monitoring Setup</CardTitle>
          <CardDescription>Add or remove monitored URLs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2 mb-4">
            <Input 
              placeholder="URL to monitor" 
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
            <Input 
              placeholder="Logo URL" 
              value={newUrlLogo}
              onChange={(e) => setNewUrlLogo(e.target.value)}
            />
            <Button onClick={handleAddMonitoredUrl}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add
            </Button>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" /> Upload Logo
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Last Crawled</TableHead>
                <TableHead>Crawl</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitoredUrls.map((url) => (
                <TableRow key={url.id}>
                  <TableCell>
                    <Avatar>
                      <AvatarImage src={url.logo_url || ''} alt={url.url} />
                      <AvatarFallback>{url.url[0]}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>{url.url}</TableCell>
                  <TableCell>
                    {url.last_crawled_at
                      ? new Date(url.last_crawled_at).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManualCrawl(url.url)}
                      disabled={isCrawling}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" /> Crawl
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveMonitoredUrl(url.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoredUrlManagement; 
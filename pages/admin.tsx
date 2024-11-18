'use client'

import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import CrawlProgressPanel from '../components/CrawlProgressPanel';
import { Card } from '../components/ui/card';
import { CardContent } from '../components/ui/card';
import { CardHeader } from '../components/ui/card';
import { CardTitle } from '../components/ui/card';
import { CardDescription } from '../components/ui/card';
import { CardFooter } from '../components/ui/card';
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { PlusCircle, Trash2, Upload, RefreshCw, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useRouter } from 'next/router';
import { Textarea } from "../components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { format } from "date-fns"
import { CalendarIcon, CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils";
import { AddSpeakerModal } from '../components/AddSpeakerModal';
import { useAuth } from '@/components/AuthStateProvider';
import { createClient } from '@/utils/supabase/client';
import OrganizationManagement from '../components/admin/OrganizationManagement';
import SpeakerManagement from '../components/admin/SpeakerManagement';
import MonitoredUrlManagement from '../components/admin/MonitoredUrlManagement';
import StagedQuotesManagement from '../components/admin/StagedQuotesManagement';
import SavedQuotesManagement from '../components/admin/SavedQuotesManagement';
import { Organization } from '@/types/admin';
import AgentsManagement from '../components/admin/AgentsManagement';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// Initialize Supabase client
const supabase = createClient();

interface Speaker {
  id: string;
  name: string;
  imageUrl: string | null;
  organizationId: string | null;
  organization?: Organization;
}

interface MonitoredURL {
  id: string;
  url: string;
  logoUrl: string | null;
  lastCrawledAt: string | null;
}

interface StagedQuote {
  id: string;
  summary: string;
  rawQuoteText: string;
  speakerName: string;
  articleDate: string;
  articleUrl: string;
  articleHeadline?: string; // Add this line
  parentMonitoredUrl: string;
}

interface SavedQuote {
  id: string;
  summary: string;
  rawQuoteText: string;
  speakerName: string;
  articleDate: string;
  articleUrl: string;
  articleHeadline: string;
}

// Add this interface and function near the top of the file, with other interfaces
interface SortedSavedQuote extends SavedQuote {
  id: string;
  summary: string;
  rawQuoteText: string;
  speakerName: string;
  articleDate: string;
  articleUrl: string;
  articleHeadline: string;
}

// Add this function before the AdminPage component
const sortQuotes = (quotes: SortedSavedQuote[]): SortedSavedQuote[] => {
  return [...quotes].sort((a, b) => {
    // First, sort by article date (newest first)
    const dateComparison = new Date(b.articleDate).getTime() - new Date(a.articleDate).getTime();
    if (dateComparison !== 0) return dateComparison;

    // Then, sort by article headline
    const headlineComparison = (a.articleHeadline || '').localeCompare(b.articleHeadline || '');
    if (headlineComparison !== 0) return headlineComparison;

    // Finally, sort by speaker name
    return a.speakerName.localeCompare(b.speakerName);
  });
};

const AdminPage: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [monitoredUrls, setMonitoredUrls] = useState<MonitoredURL[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newUrlLogo, setNewUrlLogo] = useState('');
  const [stagedQuotes, setStagedQuotes] = useState<StagedQuote[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [crawlLogs, setCrawlLogs] = useState<string[]>([]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [specificArticleUrl, setSpecificArticleUrl] = useState('');
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [addSpeakerModal, setAddSpeakerModal] = useState<{
    isOpen: boolean;
    speakerName: string;
    quoteId: string;
  } | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!loading) {
        if (!user) {
          router.push('/auth/signin');
          return;
        }

        // Get verified user data
        const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();
        
        if (error || !verifiedUser?.user_metadata?.is_admin) {
          console.error('Not an admin:', error);
          router.push('/');
          return;
        }
      }
    };

    checkAdminAccess();
  }, [user, loading, router]);

  useEffect(() => {
    fetchMonitoredUrls();
    fetchStagedQuotes();
    fetchSavedQuotes();
  }, []);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch('/api/admin/organizations');
        if (!response.ok) throw new Error('Failed to fetch organizations');
        const data = await response.json();
        setOrganizations(data);
      } catch (error) {
        console.error('Error fetching organizations:', error);
      }
    };

    fetchOrganizations();
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

  const addMonitoredUrl = async () => {
    try {
      const response = await fetch('/api/admin/monitored-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, logoUrl: newUrlLogo }),
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

  const removeMonitoredUrl = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/monitored-urls?id=${id}`, {
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
    setCrawlLogs([`Starting crawl for ${url}`]);
    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        throw new Error('Failed to trigger crawl');
      }
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const newLogs = new TextDecoder().decode(value).split('\n');
          setCrawlLogs(prevLogs => [...prevLogs, ...newLogs]);
        }
      }
      setCrawlLogs(prevLogs => [...prevLogs, 'Crawl completed successfully']);
    } catch (error: unknown) {
      console.error('Error triggering crawl:', error);
      setCrawlLogs(prevLogs => [...prevLogs, `Crawl failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsCrawling(false);
    }
  };

  const fetchStagedQuotes = async () => {
    try {
      const response = await fetch('/api/admin/staged-quotes');
      if (!response.ok) {
        throw new Error('Failed to fetch staged quotes');
      }
      const data = await response.json();
      setStagedQuotes(data);
    } catch (error) {
      console.error('Error fetching staged quotes:', error);
    }
  };

  const updateStagedQuote = async (id: string, field: 'summary' | 'rawQuoteText' | 'articleDate' | 'speakerName', value: string) => {
    try {
      const response = await fetch(`/api/admin/staged-quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) {
        throw new Error('Failed to update staged quote');
      }
      fetchStagedQuotes();
    } catch (error) {
      console.error('Error updating staged quote:', error);
    }
  };

  const acceptQuote = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/staged-quotes/${id}/accept`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.status === 400 && data.message === 'Speaker not found. Please add the speaker first.') {
        // Silently handle the speaker-not-found case by showing the modal
        const stagedQuote = stagedQuotes.find(q => q.id === id);
        if (stagedQuote) {
          setAddSpeakerModal({
            isOpen: true,
            speakerName: stagedQuote.speakerName,
            quoteId: id,
          });
        }
        return; // Return early without showing any error
      }
      
      if (!response.ok) {
        // Only show alerts for other types of errors
        throw new Error(data.message || 'Failed to accept quote');
      }
      
      fetchStagedQuotes();
      fetchSavedQuotes();
    } catch (error: unknown) {
      // Only show alerts for non-speaker-related errors
      console.error('Error accepting quote:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('An unknown error occurred');
      }
    }
  };

  const rejectQuote = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/staged-quotes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to reject quote');
      }
      fetchStagedQuotes();
    } catch (error) {
      console.error('Error rejecting quote:', error);
    }
  };

  const fetchSavedQuotes = async () => {
    try {
      const response = await fetch('/api/admin/saved-quotes');
      if (!response.ok) {
        throw new Error('Failed to fetch saved quotes');
      }
      const data = await response.json();
      console.log('Fetched saved quotes:', data); // Add this line
      setSavedQuotes(data);
    } catch (error) {
      console.error('Error fetching saved quotes:', error);
    }
  };

  const handleSpecificArticleCrawl = async (url: string) => {
    setIsCrawling(true);
    setCrawlLogs([`Starting crawl for specific article: ${url}`]);
    try {
      const response = await fetch('/api/crawl-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        throw new Error('Failed to trigger article crawl');
      }
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const newLogs = new TextDecoder().decode(value).split('\n');
          setCrawlLogs(prevLogs => [...prevLogs, ...newLogs]);
        }
      }
      setCrawlLogs(prevLogs => [...prevLogs, 'Article crawl completed successfully']);
    } catch (error) {
      console.error('Error triggering article crawl:', error);
      setCrawlLogs(prevLogs => [...prevLogs, `Article crawl failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsCrawling(false);
    }
  };

  // Add this function with the other API call functions
  const deleteSavedQuote = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/saved-quotes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete quote');
      }
      fetchSavedQuotes(); // Refresh the list after deletion
    } catch (error) {
      console.error('Error deleting quote:', error);
    }
  };

  // Add this function with the other API call functions
  const rejectAllQuotes = async () => {
    try {
      // Confirm with the user before proceeding
      if (!confirm('Are you sure you want to reject all quotes? This cannot be undone.')) {
        return;
      }

      // Reject each quote sequentially
      for (const quote of stagedQuotes) {
        await fetch(`/api/admin/staged-quotes/${quote.id}`, {
          method: 'DELETE',
        });
      }

      // Refresh the list after all quotes are rejected
      fetchStagedQuotes();
    } catch (error) {
      console.error('Error rejecting all quotes:', error);
    }
  };

  const handleAddSpeakerAndQuote = async (organizationId: string | null, imageUrl: string | null) => {
    if (!addSpeakerModal) return;

    try {
      // Create speaker first
      const createSpeakerResponse = await fetch('/api/admin/speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addSpeakerModal.speakerName,
          organizationId: organizationId,
          imageUrl: imageUrl
        }),
      });

      if (!createSpeakerResponse.ok) {
        const errorData = await createSpeakerResponse.json();
        throw new Error(errorData.message || 'Failed to create speaker');
      }

      // Now try accepting the quote again
      const acceptResponse = await fetch(`/api/admin/staged-quotes/${addSpeakerModal.quoteId}/accept`, {
        method: 'POST',
      });

      if (!acceptResponse.ok) {
        const errorData = await acceptResponse.json();
        throw new Error(errorData.message || 'Failed to accept quote');
      }

      // Refresh the quotes lists
      await fetchStagedQuotes();
      await fetchSavedQuotes();
      
      // Close the modal
      setAddSpeakerModal(null);
    } catch (error) {
      console.error('Error in handleAddSpeakerAndQuote:', error);
      alert(error instanceof Error ? error.message : 'Failed to add speaker and save quote');
    }
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <AdminLayout>
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-6">Loading...</h1>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        <Tabs defaultValue="agents">
          <TabsList>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="speakers">Speakers</TabsTrigger>
            <TabsTrigger value="urls">URLs</TabsTrigger>
            <TabsTrigger value="new-quotes">New Quotes</TabsTrigger>
            <TabsTrigger value="saved-quotes">Saved Quotes</TabsTrigger>
          </TabsList>

          <TabsContent value="agents">
            <AgentsManagement />
          </TabsContent>
          <TabsContent value="organizations">
            <OrganizationManagement />
          </TabsContent>
          <TabsContent value="speakers">
            <SpeakerManagement />
          </TabsContent>
          <TabsContent value="urls">
            <MonitoredUrlManagement />
          </TabsContent>
          <TabsContent value="new-quotes">
            <StagedQuotesManagement />
          </TabsContent>
          <TabsContent value="saved-quotes">
            <SavedQuotesManagement />
          </TabsContent>
        </Tabs>
        {addSpeakerModal && (
          <AddSpeakerModal
            isOpen={true}
            onClose={() => setAddSpeakerModal(null)}
            onConfirm={handleAddSpeakerAndQuote}
            speakerName={addSpeakerModal.speakerName}
            organizations={organizations}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPage;

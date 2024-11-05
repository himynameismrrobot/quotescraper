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

interface Organization {
  id: string;
  name: string;
  logoUrl: string | null;
}

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
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("organizations");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [newSpeakerImage, setNewSpeakerImage] = useState('');
  const [newSpeakerOrg, setNewSpeakerOrg] = useState('');
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

  useEffect(() => {
    fetchOrganizations();
    fetchSpeakers();
    fetchMonitoredUrls();
    if (activeSection === "new-quotes") {
      fetchStagedQuotes();
    }
    if (activeSection === "saved-quotes") {
      fetchSavedQuotes();
    }
  }, [activeSection]);

  useEffect(() => {
    const hash = router.asPath.split('#')[1];
    if (hash) {
      setActiveSection(hash);
    }
  }, [router.asPath]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      const data = await response.json();
      setOrganizations(data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      // You might want to set an error state here and display it to the user
    }
  };

  const addOrganization = async () => {
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName, logoUrl: newOrgLogo }),
      });
      if (!response.ok) {
        throw new Error('Failed to add organization');
      }
      setNewOrgName('');
      setNewOrgLogo('');
      fetchOrganizations();
    } catch (error) {
      console.error('Error adding organization:', error);
      // You might want to set an error state here and display it to the user
    }
  };

  const removeOrganization = async (id: string) => {
    try {
      const response = await fetch(`/api/organizations?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete organization');
      }
      fetchOrganizations();
    } catch (error) {
      console.error('Error removing organization:', error);
      // You might want to set an error state here and display it to the user
    }
  };

  const fetchSpeakers = async () => {
    try {
      const response = await fetch('/api/speakers');
      if (!response.ok) {
        throw new Error('Failed to fetch speakers');
      }
      const data = await response.json();
      setSpeakers(data);
    } catch (error) {
      console.error('Error fetching speakers:', error);
    }
  };

  const addSpeaker = async () => {
    try {
      const response = await fetch('/api/speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSpeakerName, imageUrl: newSpeakerImage, organizationId: newSpeakerOrg }),
      });
      if (!response.ok) {
        throw new Error('Failed to add speaker');
      }
      setNewSpeakerName('');
      setNewSpeakerImage('');
      setNewSpeakerOrg('');
      fetchSpeakers();
    } catch (error) {
      console.error('Error adding speaker:', error);
    }
  };

  const removeSpeaker = async (id: string) => {
    try {
      const response = await fetch(`/api/speakers?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete speaker');
      }
      fetchSpeakers();
    } catch (error) {
      console.error('Error removing speaker:', error);
    }
  };

  const fetchMonitoredUrls = async () => {
    try {
      const response = await fetch('/api/monitored-urls');
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
      const response = await fetch('/api/monitored-urls', {
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
      const response = await fetch(`/api/monitored-urls?id=${id}`, {
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
    } catch (error) {
      console.error('Error triggering crawl:', error);
      setCrawlLogs(prevLogs => [...prevLogs, `Crawl failed: ${error.message}`]);
    } finally {
      setIsCrawling(false);
    }
  };

  const fetchStagedQuotes = async () => {
    try {
      const response = await fetch('/api/staged-quotes');
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
      const response = await fetch(`/api/staged-quotes/${id}`, {
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
      const response = await fetch(`/api/staged-quotes/${id}/accept`, {
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
      const response = await fetch(`/api/staged-quotes/${id}`, {
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
      const response = await fetch('/api/saved-quotes');
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
      const response = await fetch(`/api/saved-quotes/${id}`, {
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
        await fetch(`/api/staged-quotes/${quote.id}`, {
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
      const createSpeakerResponse = await fetch('/api/speakers', {
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
      const acceptResponse = await fetch(`/api/staged-quotes/${addSpeakerModal.quoteId}/accept`, {
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

  const renderContent = () => {
    switch (activeSection) {
      case "organizations":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Organization Management</CardTitle>
              <CardDescription>Add or remove organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <Input 
                  placeholder="Organization name" 
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
                <Input 
                  placeholder="Logo URL" 
                  value={newOrgLogo}
                  onChange={(e) => setNewOrgLogo(e.target.value)}
                />
                <Button onClick={addOrganization}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={org.logoUrl || ''} alt={org.name} />
                          <AvatarFallback>{org.name[0]}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>{org.name}</TableCell>
                      <TableCell>
                        <Button variant="destructive" size="sm" onClick={() => removeOrganization(org.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      case "speakers":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Speaker Management</CardTitle>
              <CardDescription>Add or remove speakers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <Input 
                  placeholder="Speaker name" 
                  value={newSpeakerName}
                  onChange={(e) => setNewSpeakerName(e.target.value)}
                />
                <Input 
                  placeholder="Image URL" 
                  value={newSpeakerImage}
                  onChange={(e) => setNewSpeakerImage(e.target.value)}
                />
                <Select onValueChange={setNewSpeakerOrg} value={newSpeakerOrg}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addSpeaker}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add
                </Button>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" /> Upload Image
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {speakers.map((speaker) => (
                    <TableRow key={speaker.id}>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={speaker.imageUrl || ''} alt={speaker.name} />
                          <AvatarFallback>{speaker.name[0]}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>{speaker.name}</TableCell>
                      <TableCell>{speaker.organization?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Button variant="destructive" size="sm" onClick={() => removeSpeaker(speaker.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      case "urls":
        return (
          <div className="flex flex-col">
            <Card className="mb-4">
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
                  <Button onClick={addMonitoredUrl}>
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
                            <AvatarImage src={url.logoUrl || ''} alt={url.url} />
                            <AvatarFallback>{url.url[0]}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell>{url.url}</TableCell>
                        <TableCell>
                          {url.lastCrawledAt
                            ? new Date(url.lastCrawledAt).toLocaleString()
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
                          <Button variant="destructive" size="sm" onClick={() => removeMonitoredUrl(url.id)}>
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
      case "new-quotes":
        return (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>New Quotes</CardTitle>
                  <CardDescription>Review and manage new quotes</CardDescription>
                </div>
                {stagedQuotes.length > 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={rejectAllQuotes}
                    className="ml-4"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Date & Speaker</TableHead>
                    <TableHead className="w-48">Article</TableHead>
                    <TableHead className="w-[300px]">Quote Summary</TableHead>
                    <TableHead className="w-[400px]">Raw Quote Text</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagedQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="space-y-2">
                        {/* Date Picker */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[200px] justify-start text-left font-normal",
                                !quote.articleDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {quote.articleDate ? format(new Date(quote.articleDate), "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={new Date(quote.articleDate)}
                              onSelect={(date) => {
                                if (date) {
                                  updateStagedQuote(quote.id, 'articleDate', date.toISOString());
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        {/* Speaker Selector */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-[200px] justify-between"
                            >
                              {quote.speakerName || "Select speaker..."}
                              <CheckIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-0">
                            <Command shouldFilter={true}>
                              <CommandInput placeholder="Search speakers..." />
                              <CommandList>
                                <CommandEmpty>No speaker found.</CommandEmpty>
                                <CommandGroup>
                                  {speakers && speakers.map((speaker) => (
                                    <CommandItem
                                      key={speaker.id}
                                      onSelect={() => {
                                        updateStagedQuote(quote.id, 'speakerName', speaker.name);
                                      }}
                                      value={speaker.name}
                                    >
                                      <CheckIcon
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          quote.speakerName === speaker.name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {speaker.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[180px] break-words">
                          <a 
                            href={quote.articleUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {quote.articleHeadline || quote.articleUrl}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[280px] break-words">
                          {quote.summary}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[380px] break-words">
                          {quote.rawQuoteText}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col space-y-2">
                          <Button variant="outline" size="sm" onClick={() => acceptQuote(quote.id)} className="whitespace-nowrap">
                            <Check className="h-4 w-4 mr-1" />
                            <span className="text-xs">Accept</span>
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => rejectQuote(quote.id)} className="whitespace-nowrap">
                            <X className="h-4 w-4 mr-1" />
                            <span className="text-xs">Reject</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      case "saved-quotes":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Saved Quotes</CardTitle>
              <CardDescription>View and manage saved quotes</CardDescription>
            </CardHeader>
            <CardContent>
              {savedQuotes.length === 0 ? (
                <p>No saved quotes found.</p>
              ) : (
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Article Date</TableHead>
                      <TableHead className="w-64">Article</TableHead>
                      <TableHead className="w-32">Speaker Name</TableHead>
                      <TableHead className="w-1/3">Quote Summary</TableHead>
                      <TableHead className="w-2/5">Raw Quote Text</TableHead>
                      <TableHead className="w-24">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortQuotes(savedQuotes).map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="w-24 whitespace-nowrap">
                          {new Date(quote.articleDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="w-64">
                          <div className="w-64 overflow-hidden">
                            <a 
                              href={quote.articleUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline block"
                            >
                              {quote.articleHeadline}
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="w-32 whitespace-nowrap">{quote.speakerName}</TableCell>
                        <TableCell className="w-1/3">{quote.summary}</TableCell>
                        <TableCell className="w-2/5">{quote.rawQuoteText}</TableCell>
                        <TableCell className="w-24">
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => deleteSavedQuote(quote.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      default:
        return <h2>Select a section from the sidebar</h2>;
    }
  };

  return (
    <AdminLayout>
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        {renderContent()}
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

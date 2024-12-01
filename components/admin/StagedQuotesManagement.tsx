import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { format } from "date-fns";
import { CalendarIcon, CheckIcon, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddSpeakerModal } from '../AddSpeakerModal';

interface Speaker {
  id: string;
  name: string;
  image_url: string | null;
  organization_id: string | null;
  organization?: Organization;
}

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
}

interface StagedQuote {
  id: string;
  summary: string;
  raw_quote_text: string;
  speaker_name: string;
  article_date: string;
  article_url: string;
  article_headline?: string;
  parent_monitored_url: string;
}

const StagedQuotesManagement: React.FC = () => {
  const [stagedQuotes, setStagedQuotes] = useState<StagedQuote[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [addSpeakerModal, setAddSpeakerModal] = useState<{
    isOpen: boolean;
    speakerName: string;
    quoteId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStagedQuotes();
    fetchSpeakers();
    fetchOrganizations();
  }, []);

  const fetchStagedQuotes = async () => {
    try {
      const response = await fetch('/api/admin/staged-quotes');
      if (!response.ok) throw new Error('Failed to fetch staged quotes');
      const data = await response.json();
      setStagedQuotes(data);
    } catch (error) {
      console.error('Error fetching staged quotes:', error);
    }
  };

  const fetchSpeakers = async () => {
    try {
      const response = await fetch('/api/admin/speakers');
      if (!response.ok) throw new Error('Failed to fetch speakers');
      const data = await response.json();
      setSpeakers(data);
    } catch (error) {
      console.error('Error fetching speakers:', error);
    }
  };

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

  const updateStagedQuote = async (id: string, field: 'summary' | 'raw_quote_text' | 'article_date' | 'speaker_name', value: string) => {
    try {
      setError(null); // Clear any previous errors
      const response = await fetch(`/api/admin/staged-quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to update staged quote');
        return;
      }
      
      fetchStagedQuotes();
    } catch (error) {
      console.error('Error updating staged quote:', error);
      setError('An unexpected error occurred while updating the quote');
    }
  };

  const acceptQuote = async (id: string) => {
    try {
      setError(null); // Clear any previous errors
      const response = await fetch(`/api/admin/staged-quotes/${id}/accept`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.status === 400 && data.message === 'Speaker not found. Please add the speaker first.') {
        const stagedQuote = stagedQuotes.find(q => q.id === id);
        if (stagedQuote) {
          setAddSpeakerModal({
            isOpen: true,
            speakerName: stagedQuote.speaker_name,
            quoteId: id,
          });
        }
        return;
      }
      
      if (!response.ok) {
        setError(data.message || 'Failed to accept quote');
        return;
      }
      
      fetchStagedQuotes();
    } catch (error) {
      console.error('Error accepting quote:', error);
      setError('An unexpected error occurred while accepting the quote');
    }
  };

  const rejectQuote = async (id: string) => {
    try {
      setError(null); // Clear any previous errors
      const response = await fetch(`/api/admin/staged-quotes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setError('Failed to reject quote');
        return;
      }
      fetchStagedQuotes();
    } catch (error) {
      console.error('Error rejecting quote:', error);
      setError('An unexpected error occurred while rejecting the quote');
    }
  };

  const rejectAllQuotes = async () => {
    try {
      setError(null); // Clear any previous errors
      if (!confirm('Are you sure you want to reject all quotes? This cannot be undone.')) {
        return;
      }

      for (const quote of stagedQuotes) {
        await fetch(`/api/admin/staged-quotes/${quote.id}`, {
          method: 'DELETE',
        });
      }

      fetchStagedQuotes();
    } catch (error) {
      console.error('Error rejecting all quotes:', error);
      setError('An unexpected error occurred while rejecting all quotes');
    }
  };

  const handleAddSpeakerAndQuote = async (organizationId: string | null, imageUrl: string | null) => {
    if (!addSpeakerModal) return;

    try {
      setError(null); // Clear any previous errors
      const createSpeakerResponse = await fetch('/api/admin/speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addSpeakerModal.speakerName,
          organization_id: organizationId,
          image_url: imageUrl
        }),
      });

      if (!createSpeakerResponse.ok) {
        const errorData = await createSpeakerResponse.json();
        setError(errorData.message || 'Failed to create speaker');
        return;
      }

      const acceptResponse = await fetch(`/api/admin/staged-quotes/${addSpeakerModal.quoteId}/accept`, {
        method: 'POST',
      });

      if (!acceptResponse.ok) {
        const errorData = await acceptResponse.json();
        setError(errorData.message || 'Failed to accept quote');
        return;
      }

      fetchStagedQuotes();
      setAddSpeakerModal(null);
    } catch (error) {
      console.error('Error in handleAddSpeakerAndQuote:', error);
      setError('An unexpected error occurred while adding speaker and quote');
    }
  };

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
        {error && (
          <div className="mb-4 p-4 text-sm text-red-800 rounded-lg bg-red-50">
            {error}
          </div>
        )}
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !quote.article_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {quote.article_date ? format(new Date(quote.article_date), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(quote.article_date)}
                        onSelect={(date) => {
                          if (date) {
                            updateStagedQuote(quote.id, 'article_date', date.toISOString());
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-[200px] justify-between"
                      >
                        {quote.speaker_name || "Select speaker..."}
                        <CheckIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                      <Command>
                        <CommandInput placeholder="Search speakers..." />
                        <CommandEmpty>No speaker found.</CommandEmpty>
                        <CommandGroup>
                          {speakers.map((speaker) => (
                            <CommandItem
                              key={speaker.id}
                              onSelect={() => {
                                updateStagedQuote(quote.id, 'speaker_name', speaker.name);
                              }}
                              value={speaker.name}
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  quote.speaker_name === speaker.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {speaker.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell>
                  <div className="max-w-[180px] break-words">
                    <a 
                      href={quote.article_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {quote.article_headline || quote.article_url}
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
                    {quote.raw_quote_text}
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
      {addSpeakerModal && (
        <AddSpeakerModal
          isOpen={true}
          onClose={() => setAddSpeakerModal(null)}
          onConfirm={handleAddSpeakerAndQuote}
          speakerName={addSpeakerModal.speakerName}
          organizations={organizations}
        />
      )}
    </Card>
  );
};

export default StagedQuotesManagement; 
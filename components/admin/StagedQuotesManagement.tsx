import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { format } from "date-fns";
import { CalendarIcon, CheckIcon, X, Check, ChevronDown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddSpeakerModal } from '../AddSpeakerModal';
import { Checkbox } from "@/components/ui/checkbox";

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
  logoUrl: string | null;
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
  is_valid: boolean;
  invalid_reason?: string;
}

const MAX_RECENT_SPEAKERS = 5;

const StagedQuotesManagement: React.FC = () => {
  const [stagedQuotes, setStagedQuotes] = useState<StagedQuote[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState<number>(-1);
  const [isCompactView, setIsCompactView] = useState(false);
  const [isGroupedView, setIsGroupedView] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('valid');
  const [recentSpeakers, setRecentSpeakers] = useState<Speaker[]>([]);
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
      setError(null);
      if (!confirm('Are you sure you want to reject all quotes? This cannot be undone.')) {
        return;
      }

      // Filter quotes by current tab's validation status
      const quotesToReject = stagedQuotes.filter(q => 
        activeTab === 'valid' ? q.is_valid : !q.is_valid
      );

      for (const quote of quotesToReject) {
        await rejectQuote(quote.id);
      }

      await fetchStagedQuotes();
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

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (currentQuoteIndex === -1 || stagedQuotes.length === 0) return;

    const currentQuote = stagedQuotes[currentQuoteIndex];
    if (!currentQuote) return;

    switch(e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setCurrentQuoteIndex(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setCurrentQuoteIndex(prev => Math.min(stagedQuotes.length - 1, prev + 1));
        break;
      case 'ArrowRight':
      case 'a':
      case 'A':
        e.preventDefault();
        acceptQuote(currentQuote.id);
        break;
      case 'ArrowLeft':
      case 'r':
      case 'R':
        e.preventDefault();
        rejectQuote(currentQuote.id);
        break;
      case ' ':
        e.preventDefault();
        setSelectedQuotes(prev => {
          const newSet = new Set(prev);
          if (newSet.has(currentQuote.id)) {
            newSet.delete(currentQuote.id);
          } else {
            newSet.add(currentQuote.id);
          }
          return newSet;
        });
        break;
    }
  }, [currentQuoteIndex, stagedQuotes]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const handleBatchAccept = async () => {
    const selectedQuotesList = Array.from(selectedQuotes);
    const validSelectedQuotes = stagedQuotes.filter(q => 
      selectedQuotesList.includes(q.id) &&
      (activeTab === 'valid' ? q.is_valid : !q.is_valid)
    );
    
    for (const quote of validSelectedQuotes) {
      await acceptQuote(quote.id);
    }
    setSelectedQuotes(new Set());
  };

  const handleBatchReject = async () => {
    const selectedQuotesList = Array.from(selectedQuotes);
    const validSelectedQuotes = stagedQuotes.filter(q => 
      selectedQuotesList.includes(q.id) &&
      (activeTab === 'valid' ? q.is_valid : !q.is_valid)
    );
    
    for (const quote of validSelectedQuotes) {
      await rejectQuote(quote.id);
    }
    setSelectedQuotes(new Set());
  };

  const toggleAllSelection = () => {
    if (selectedQuotes.size === stagedQuotes.length) {
      setSelectedQuotes(new Set());
    } else {
      setSelectedQuotes(new Set(stagedQuotes.map(q => q.id)));
    }
  };

  const updateSpeakerAndTrackRecent = async (quoteId: string, speaker: Speaker) => {
    await updateStagedQuote(quoteId, 'speaker_name', speaker.name);
    setRecentSpeakers(prev => {
      const filtered = prev.filter(s => s.id !== speaker.id);
      return [speaker, ...filtered].slice(0, MAX_RECENT_SPEAKERS);
    });
  };

  const QuickSpeakerSelect: React.FC<{
    quote: StagedQuote;
    onSelect: (speaker: Speaker) => void;
  }> = ({ quote, onSelect }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(quote.speaker_name);

    const filteredSpeakers = speakers.filter(speaker =>
      speaker.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && filteredSpeakers.length > 0) {
        onSelect(filteredSpeakers[0]);
        setIsOpen(false);
        setInputValue(filteredSpeakers[0].name);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setInputValue(quote.speaker_name);
      }
    };

    useEffect(() => {
      setInputValue(quote.speaker_name);
    }, [quote.speaker_name]);

    return (
      <div className="relative w-full">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={(e) => {
            setSearch(inputValue);
            setIsOpen(true);
            e.target.select();
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsOpen(false);
              setInputValue(quote.speaker_name);
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type to search speakers..."
          className="w-full px-3 py-2 border rounded-md"
        />
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg">
            {recentSpeakers.length > 0 && search === '' && (
              <div className="p-2 border-b">
                <div className="text-xs text-gray-500 mb-1">Recent Speakers</div>
                {recentSpeakers.map(speaker => (
                  <div
                    key={speaker.id}
                    className="px-2 py-1 hover:bg-gray-100 cursor-pointer rounded"
                    onClick={() => {
                      onSelect(speaker);
                      setIsOpen(false);
                      setInputValue(speaker.name);
                    }}
                  >
                    {speaker.name}
                  </div>
                ))}
              </div>
            )}
            <div className="max-h-48 overflow-y-auto">
              {filteredSpeakers.map(speaker => (
                <div
                  key={speaker.id}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    onSelect(speaker);
                    setIsOpen(false);
                    setInputValue(speaker.name);
                  }}
                >
                  {speaker.name}
                  {speaker.organization && (
                    <span className="text-gray-500 text-sm ml-2">
                      ({speaker.organization.name})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredQuotes = useMemo(() => {
    return stagedQuotes.filter(quote => 
      activeTab === 'valid' ? quote.is_valid : !quote.is_valid
    );
  }, [stagedQuotes, activeTab]);

  const groupedQuotes = React.useMemo(() => {
    if (!isGroupedView) return null;
    
    const groups: { [key: string]: { displayName: string; quotes: StagedQuote[] } } = {};
    filteredQuotes.forEach(quote => {
      const key = quote.speaker_name.toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          displayName: quote.speaker_name,
          quotes: []
        };
      }
      groups[key].quotes.push(quote);
    });
    
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { displayName, quotes }]) => [displayName, quotes]);
  }, [filteredQuotes, isGroupedView]);

  const bulkUpdateSpeakerName = async (oldName: string, newName: string) => {
    try {
      setError(null);
      const quotesToUpdate = stagedQuotes.filter(q => 
        q.speaker_name.toLowerCase() === oldName.toLowerCase()
      );
      
      await Promise.all(quotesToUpdate.map(quote => 
        updateStagedQuote(quote.id, 'speaker_name', newName)
      ));
      
      fetchStagedQuotes();
    } catch (error) {
      console.error('Error bulk updating speaker names:', error);
      setError('An unexpected error occurred while updating speaker names');
    }
  };

  const bulkActionBySpeaker = async (speakerName: string, action: 'accept' | 'reject') => {
    try {
      setError(null);
      // Filter quotes by both speaker name and current tab's validation status
      const quotesToProcess = stagedQuotes.filter(q => 
        q.speaker_name.toLowerCase() === speakerName.toLowerCase() &&
        (activeTab === 'valid' ? q.is_valid : !q.is_valid)
      );
      
      // Process quotes sequentially to avoid race conditions
      for (const quote of quotesToProcess) {
        if (action === 'accept') {
          await acceptQuote(quote.id);
        } else {
          await rejectQuote(quote.id);
        }
      }
      
      await fetchStagedQuotes();
    } catch (error) {
      console.error(`Error bulk ${action}ing quotes:`, error);
      setError(`An unexpected error occurred while ${action}ing quotes`);
    }
  };

  const ValidationDetails: React.FC<{ quote: StagedQuote, colSpan: number }> = ({ quote, colSpan }) => {
    if (!showValidation || quote.is_valid) return null;

    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="bg-gray-50 py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">Invalid Reason:</span>
            <span className="text-gray-600">{quote.invalid_reason}</span>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>New Quotes ({filteredQuotes.length})</CardTitle>
            <CardDescription>Review and manage new quotes</CardDescription>
          </div>
          <div className="flex gap-2">
            {selectedQuotes.size > 0 && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleBatchAccept}
                  className="whitespace-nowrap"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Accept Selected ({selectedQuotes.size})
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBatchReject}
                  className="whitespace-nowrap"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject Selected ({selectedQuotes.size})
                </Button>
              </>
            )}
            <Button 
              variant="outline" 
              onClick={() => setIsGroupedView(!isGroupedView)}
              className="whitespace-nowrap"
            >
              <ChevronDown className={cn("h-4 w-4 mr-2", isGroupedView && "rotate-180")} />
              {isGroupedView ? "Ungroup Quotes" : "Group by Speaker"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsCompactView(!isCompactView)}
              className="whitespace-nowrap"
            >
              <ChevronDown className={cn("h-4 w-4 mr-2", isCompactView && "rotate-180")} />
              {isCompactView ? "Expand View" : "Compact View"}
            </Button>
            {filteredQuotes.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={rejectAllQuotes}
                className="whitespace-nowrap"
              >
                <X className="h-4 w-4 mr-2" />
                Reject All
              </Button>
            )}
          </div>
        </div>
        <div className="mt-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Button
                variant={activeTab === 'valid' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('valid')}
                className="relative h-9 rounded-none"
              >
                Valid Quotes ({stagedQuotes.filter(q => q.is_valid).length})
                {activeTab === 'valid' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </Button>
              <Button
                variant={activeTab === 'invalid' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('invalid')}
                className="relative h-9 rounded-none"
              >
                Invalid Quotes ({stagedQuotes.filter(q => !q.is_valid).length})
                {activeTab === 'invalid' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </Button>
            </div>
            {activeTab === 'invalid' && (
              <Button
                variant="outline"
                onClick={() => setShowValidation(!showValidation)}
                size="sm"
                className="mb-2"
              >
                <Eye className={cn("h-4 w-4 mr-2", showValidation && "text-blue-500")} />
                {showValidation ? "Hide Invalid Reasons" : "Show Invalid Reasons"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 text-sm text-red-800 rounded-lg bg-red-50">
            {error}
          </div>
        )}
        <div className="mb-4 text-sm text-gray-500">
          Keyboard shortcuts: ↑/↓ Navigate • A/→ Accept • R/← Reject • Space Select • Tab Next Field
        </div>
        {isGroupedView ? (
          <div className="space-y-6">
            {groupedQuotes?.map(([speakerName, quotes]) => (
              <Card key={speakerName.toLowerCase()} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">{speakerName}</h3>
                    <span className="text-sm text-gray-500">({quotes.length} quotes)</span>
                  </div>
                  <div className="flex gap-2">
                    <QuickSpeakerSelect
                      quote={{ ...quotes[0], speaker_name: speakerName }}
                      onSelect={(speaker) => bulkUpdateSpeakerName(speakerName, speaker.name)}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => bulkActionBySpeaker(speakerName, 'accept')}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept All
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => bulkActionBySpeaker(speakerName, 'reject')}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject All
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={quotes.every(q => selectedQuotes.has(q.id))}
                          onCheckedChange={(checked) => {
                            setSelectedQuotes(prev => {
                              const newSet = new Set(prev);
                              quotes.forEach(q => {
                                if (checked) {
                                  newSet.add(q.id);
                                } else {
                                  newSet.delete(q.id);
                                }
                              });
                              return newSet;
                            });
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-36">Date</TableHead>
                      <TableHead className="w-48">Article</TableHead>
                      {!isCompactView && (
                        <>
                          <TableHead className="w-[300px]">Quote Summary</TableHead>
                          <TableHead className="w-[400px]">Raw Quote Text</TableHead>
                        </>
                      )}
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote, index) => (
                      <React.Fragment key={quote.id}>
                        <TableRow 
                          className={cn(
                            "cursor-pointer",
                            currentQuoteIndex === index && "bg-muted",
                            selectedQuotes.has(quote.id) && "bg-muted/50"
                          )}
                          onClick={() => setCurrentQuoteIndex(index)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedQuotes.has(quote.id)}
                              onCheckedChange={(checked) => {
                                setSelectedQuotes(prev => {
                                  const newSet = new Set(prev);
                                  if (checked) {
                                    newSet.add(quote.id);
                                  } else {
                                    newSet.delete(quote.id);
                                  }
                                  return newSet;
                                });
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell>
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
                          {!isCompactView && (
                            <>
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
                            </>
                          )}
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
                        <ValidationDetails 
                          quote={quote} 
                          colSpan={isCompactView ? 5 : 7} 
                        />
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={selectedQuotes.size === stagedQuotes.length}
                    onCheckedChange={toggleAllSelection}
                  />
                </TableHead>
                <TableHead className="w-36">Date & Speaker</TableHead>
                <TableHead className="w-48">Article</TableHead>
                {!isCompactView && (
                  <>
                    <TableHead className="w-[300px]">Quote Summary</TableHead>
                    <TableHead className="w-[400px]">Raw Quote Text</TableHead>
                  </>
                )}
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.map((quote, index) => (
                <React.Fragment key={quote.id}>
                  <TableRow 
                    className={cn(
                      "cursor-pointer",
                      currentQuoteIndex === index && "bg-muted",
                      selectedQuotes.has(quote.id) && "bg-muted/50"
                    )}
                    onClick={() => setCurrentQuoteIndex(index)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedQuotes.has(quote.id)}
                        onCheckedChange={(checked) => {
                          setSelectedQuotes(prev => {
                            const newSet = new Set(prev);
                            if (checked) {
                              newSet.add(quote.id);
                            } else {
                              newSet.delete(quote.id);
                            }
                            return newSet;
                          });
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="space-y-2">
                      <QuickSpeakerSelect
                        quote={quote}
                        onSelect={(speaker) => updateSpeakerAndTrackRecent(quote.id, speaker)}
                      />
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
                    {!isCompactView && (
                      <>
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
                      </>
                    )}
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
                  <ValidationDetails 
                    quote={quote} 
                    colSpan={isCompactView ? 5 : 7} 
                  />
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
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
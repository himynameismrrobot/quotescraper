import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Upload } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Speaker {
  id: string;
  name: string;
  image_url: string | null;
  organization_id: string | null;
  organization?: Organization;
}

const SpeakerManagement: React.FC = () => {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [newSpeakerImage, setNewSpeakerImage] = useState('');
  const [newSpeakerOrg, setNewSpeakerOrg] = useState('');

  useEffect(() => {
    fetchSpeakers();
    fetchOrganizations();
  }, []);

  const fetchSpeakers = async () => {
    try {
      const response = await fetch('/api/admin/speakers');
      if (!response.ok) {
        throw new Error('Failed to fetch speakers');
      }
      const data = await response.json();
      setSpeakers(data);
    } catch (error) {
      console.error('Error fetching speakers:', error);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/organizations');
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      const data = await response.json();
      setOrganizations(data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const handleAddSpeaker = async () => {
    try {
      const response = await fetch('/api/admin/speakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newSpeakerName, 
          image_url: newSpeakerImage, 
          organization_id: newSpeakerOrg 
        }),
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

  const handleRemoveSpeaker = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/speakers/${id}`, {
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
          <Button onClick={handleAddSpeaker}>
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
                    <AvatarImage src={speaker.image_url || ''} alt={speaker.name} />
                    <AvatarFallback>{speaker.name[0]}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>{speaker.name}</TableCell>
                <TableCell>{speaker.organization?.name || 'N/A'}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => handleRemoveSpeaker(speaker.id)}>
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
};

export default SpeakerManagement; 
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
}

const OrganizationManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchOrganizations();
  }, []);

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

  const handleAddOrganization = async () => {
    if (!newOrgName.trim()) return;

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newOrgName,
          logo_url: newOrgLogo || null
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add organization');
      }

      setNewOrgName('');
      setNewOrgLogo('');
      fetchOrganizations();
    } catch (error) {
      console.error('Error adding organization:', error);
    }
  };

  const handleRemoveOrganization = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/organizations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove organization');
      }

      fetchOrganizations();
    } catch (error) {
      console.error('Error removing organization:', error);
    }
  };

  const handleImageError = (orgId: string) => {
    setImageLoadErrors(prev => ({
      ...prev,
      [orgId]: true
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Management</CardTitle>
        <CardDescription>Add or remove organizations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-4 mb-4">
          <Input
            type="text"
            placeholder="Organization name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
          />
          <Input
            type="text"
            placeholder="Logo URL"
            value={newOrgLogo}
            onChange={(e) => setNewOrgLogo(e.target.value)}
          />
          <Button onClick={handleAddOrganization}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Organization
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
                  {org.logo_url ? (
                    <div className="w-10 h-10 relative">
                      <img 
                        src={org.logo_url}
                        alt={org.name}
                        className="w-10 h-10 rounded-full object-cover absolute inset-0"
                        onError={(e) => {
                          console.error(`Failed to load image for ${org.name}:`, org.logo_url);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          // Show fallback
                          const fallback = document.createElement('div');
                          fallback.className = 'w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center';
                          fallback.textContent = org.name[0];
                          target.parentNode?.appendChild(fallback);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {org.name[0]}
                    </div>
                  )}
                </TableCell>
                <TableCell>{org.name}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => handleRemoveOrganization(org.id)}>
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

export default OrganizationManagement;

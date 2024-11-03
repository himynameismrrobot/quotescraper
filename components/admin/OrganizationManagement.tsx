import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Upload } from 'lucide-react';
import axios from 'axios';

interface Organization {
  id: string;
  name: string;
  logoUrl: string;
}

const OrganizationManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await axios.get('/api/organizations');
      setOrganizations(response.data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const handleAddOrganization = async () => {
    if (!newOrgName.trim()) return;

    try {
      let logoUrl = '';
      if (logoFile) {
        // TODO: Implement file upload to a storage service (e.g., AWS S3)
        // and get the URL of the uploaded file
        logoUrl = 'https://example.com/placeholder.png';
      }

      const response = await axios.post('/api/organizations', {
        name: newOrgName,
        logoUrl,
      });

      setOrganizations([response.data, ...organizations]);
      setNewOrgName('');
      setLogoFile(null);
    } catch (error) {
      console.error('Error adding organization:', error);
    }
  };

  const handleRemoveOrganization = async (id: string) => {
    try {
      await axios.delete(`/api/organizations?id=${id}`);
      setOrganizations(organizations.filter((org) => org.id !== id));
    } catch (error) {
      console.error('Error removing organization:', error);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Organization Management</h2>
      <div className="flex space-x-4">
        <Input
          type="text"
          placeholder="Organization name"
          value={newOrgName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOrgName(e.target.value)}
        />
        <label className="cursor-pointer">
          <Input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <div className="flex items-center justify-center px-4 py-2 bg-gray-100 rounded-md">
            <Upload className="w-5 h-5 mr-2" />
            <span>Upload Logo</span>
          </div>
        </label>
        <Button onClick={handleAddOrganization}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Organization
        </Button>
      </div>
      <ul className="space-y-4">
        {organizations.map((org: Organization) => (
          <li key={org.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
            <div className="flex items-center space-x-4">
              <img src={org.logoUrl} alt={org.name} className="w-10 h-10 rounded-full object-cover" />
              <span>{org.name}</span>
            </div>
            <Button variant="destructive" onClick={() => handleRemoveOrganization(org.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OrganizationManagement;

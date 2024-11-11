import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
}

const OrganizationManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgLogo, setNewOrgLogo] = useState('');

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const handleAddOrganization = async () => {
    if (!newOrgName.trim()) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .insert([{
          name: newOrgName,
          logo_url: newOrgLogo || null
        }]);

      if (error) throw error;

      setNewOrgName('');
      setNewOrgLogo('');
      fetchOrganizations();
    } catch (error) {
      console.error('Error adding organization:', error);
    }
  };

  const handleRemoveOrganization = async (id: string) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchOrganizations();
    } catch (error) {
      console.error('Error removing organization:', error);
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
      <ul className="space-y-4">
        {organizations.map((org) => (
          <li key={org.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
            <div className="flex items-center space-x-4">
              {org.logo_url && (
                <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-full object-cover" />
              )}
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

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  name: string;
  logoUrl: string | null;
}

interface AddSpeakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (organizationId: string | null, imageUrl: string | null) => Promise<void>;
  speakerName: string;
  organizations: Organization[];
}

export function AddSpeakerModal({
  isOpen,
  onClose,
  onConfirm,
  speakerName,
  organizations,
}: AddSpeakerModalProps) {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(selectedOrg?.id || null, imageUrl || null);
    } catch (error) {
      console.error('Error adding speaker:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add speaker to save quote</DialogTitle>
          <DialogDescription>
            Add organization and image URL for the new speaker.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Speaker Name</p>
            <p className="text-sm text-muted-foreground">{speakerName}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Organization (Optional)</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedOrg?.name || "Select organization..."}
                  <CheckIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search organizations..." />
                  <CommandList>
                    <CommandEmpty>No organization found.</CommandEmpty>
                    <CommandGroup>
                      {organizations?.map((org) => (
                        <CommandItem
                          key={org.id}
                          onSelect={() => setSelectedOrg(org)}
                          className="cursor-pointer"
                        >
                          <CheckIcon
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedOrg?.id === org.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {org.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Image URL (Optional)</p>
            <Input
              placeholder="Enter image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Speaker & Quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
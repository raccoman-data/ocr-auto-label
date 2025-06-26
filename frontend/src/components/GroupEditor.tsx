import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useImageStore } from '@/stores/imageStore';
import { Check, ChevronsUpDown, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface GroupEditorProps {
  imageId: string;
  currentGroup: string;
  allGroups: string[];
  additionalImageIds?: string[];
}

export interface GroupEditorHandle {
  open: () => void;
}

export const GroupEditor = forwardRef<GroupEditorHandle, GroupEditorProps>(({ 
  imageId, 
  currentGroup, 
  allGroups,
  additionalImageIds = []
}: GroupEditorProps, ref) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentGroup);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentGroup);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateImage, images } = useImageStore();

  // Sync local value when prop changes (e.g., external update)
  React.useEffect(() => {
    setValue(currentGroup);
    setEditValue(currentGroup);
  }, [currentGroup]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Expose open method via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      console.log('GroupEditor open() called'); // Debug log
      setOpen(true);
    }
  }), []); // Empty deps array since setOpen is stable

  // Log when open state changes
  useEffect(() => {
    console.log('GroupEditor open state:', open); // Debug log
  }, [open]);

  const handleGroupChange = async (newGroup: string) => {
    setValue(newGroup);
    setOpen(false);
    
    // Collect all image IDs to update
    const idsToUpdate = [imageId, ...additionalImageIds];
    
    try {
      // Update all images in sequence to ensure proper suffix handling
      for (const id of idsToUpdate) {
        // Update locally first for immediate UI feedback
        updateImage(id, { 
          group: newGroup, 
          groupingStatus: newGroup ? 'processing' : 'pending',
          groupingConfidence: newGroup ? 0.5 : 0,
        });
        
        // Update on backend
        const response = await fetch(`/api/images/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ group: newGroup }),
        });

        if (!response.ok) {
          throw new Error('Failed to update group');
        }

        const updatedImage = await response.json();
        
        // Update with backend response (includes any auto-generated newName)
        updateImage(id, {
          group: updatedImage.group,
          newName: updatedImage.newName,
          groupingStatus: updatedImage.group ? 'complete' : 'pending',
          groupingConfidence: updatedImage.group ? 1.0 : 0,
        });
      }
    } catch (error) {
      console.error('Failed to update group:', error);
      // Revert on error for all affected images
      idsToUpdate.forEach(id => {
        updateImage(id, { 
          group: currentGroup,
          groupingStatus: currentGroup ? 'complete' : 'pending',
          groupingConfidence: currentGroup ? 1.0 : 0,
        });
      });
      setValue(currentGroup);
    }
  };

  // Handle inline editing
  const handleEditStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(value);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleEditSave = async () => {
    if (editValue.trim() !== value) {
      await handleGroupChange(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleEditCancel();
    }
  };

  // Helper to get thumbnail URL for the "main" image of a group
  const getGroupThumbnail = (group: string): string | null => {
    if (!group) return null;
    // Find image with matching group whose newName does NOT contain "_" (main file)
    const mainImg = images.find(img => img.group === group && img.newName && !img.newName.includes('_'))
      || images.find(img => img.group === group);
    if (mainImg?.thumbnailPath) {
      return `/thumbnails/${mainImg.thumbnailPath.split('/').pop()}`;
    }
    return null;
  };

  // If editing, show inline input
  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={handleEditSave}
          className="h-8 text-xs"
          placeholder="Enter group name..."
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group/editor">
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        // Clear additional IDs when closing
        if (!isOpen && additionalImageIds.length > 0) {
          // Find the parent ImageTable component and reset its state
          const tableEl = document.querySelector('[data-image-table]');
          if (tableEl) {
            const tableComponent = (tableEl as any).__reactFiber$?.return?.stateNode;
            if (tableComponent?.setActiveEditorState) {
              tableComponent.setActiveEditorState({ id: null, additionalIds: [] });
            }
          }
        }
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between text-xs h-8 px-2"
          >
            {value ? (
              <span 
                className="px-2 py-1 text-primary rounded-full text-xs font-medium truncate"
                style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}
              >
                {value}
              </span>
            ) : (
              <span className="text-muted-foreground italic">Select group...</span>
            )}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
      <PopoverContent className="w-64 p-0 max-h-80">
        <Command>
          <CommandInput 
            placeholder="Search or create group..." 
            className="text-xs"
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                const inputValue = e.currentTarget.value;
                if (inputValue && !allGroups.includes(inputValue)) {
                  handleGroupChange(inputValue);
                }
              }
            }}
          />
          <CommandEmpty>
            <div className="p-2 text-xs">
              <p className="text-muted-foreground mb-2">No groups found.</p>
              <Button 
                size="sm" 
                className="w-full text-xs h-7"
                onClick={() => {
                  const input = document.querySelector('[placeholder="Search or create group..."]') as HTMLInputElement;
                  if (input?.value) {
                    handleGroupChange(input.value);
                  }
                }}
              >
                Create new group
              </Button>
            </div>
          </CommandEmpty>
          <CommandGroup className="max-h-60 overflow-y-auto">
            {allGroups.map((group) => (
              <CommandItem
                key={group}
                value={group}
                onSelect={() => handleGroupChange(group)}
                className="text-xs flex items-center"
              >
                {(() => {
                  const thumb = getGroupThumbnail(group);
                  return thumb ? (
                    <img
                      src={thumb}
                      alt={group}
                      className="w-8 h-8 rounded object-cover mr-2 border"
                    />
                  ) : (
                    <div className="w-8 h-8 mr-2 rounded bg-muted border" />
                  );
                })()}
                <Check
                  className={cn(
                    "mr-1 h-3 w-3",
                    value === group ? "opacity-100" : "opacity-0"
                  )}
                />
                <span 
                  className="px-2 py-1 text-primary rounded-full text-xs font-medium truncate"
                  style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}
                >
                  {group}
                </span>
              </CommandItem>
            ))}

            {/* Visual separator */}
            <CommandSeparator className="my-1" />

            {/* Clear group action at the bottom */}
            <CommandItem
              key="__clear__"
              value="__clear__"
              onSelect={() => handleGroupChange('')}
              className="text-xs flex items-center text-destructive focus:text-destructive"
            >
              <span className="text-left w-full">Clear group</span>
            </CommandItem>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
    
    {/* Edit button - shows on hover */}
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 opacity-0 group-hover/editor:opacity-100 transition-opacity"
      onClick={handleEditStart}
    >
      <Edit2 className="h-3 w-3" />
    </Button>
  </div>
  );
}); 
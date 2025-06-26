import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useImageStore } from '@/stores/imageStore';
import { Check, ChevronsUpDown, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Detailed validation function (matching backend logic)
function isValidSampleCode(code: string | null): boolean {
  if (!code) return false;
  
  const trimmedCode = code.trim().toUpperCase();
  
  // Pattern 1: MWI.1.[1-3].[1-24].[1-10][A-D].[1-25].[1-12]
  const mwi1Pattern = /^MWI\.1\.([1-3])\.([1-9]|1[0-9]|2[0-4])\.([1-9]|10)[A-D]\.([1-9]|1[0-9]|2[0-5])\.([1-9]|1[0-2])$/;
  
  // Pattern 2: MWI.0.[1-3].[1-6].[1-13].[1-27].[1-12]
  const mwi0Pattern = /^MWI\.0\.([1-3])\.([1-6])\.([1-9]|1[0-3])\.([1-9]|1[0-9]|2[0-7])\.([1-9]|1[0-2])$/;
  
  // Pattern 3: KEN.0.[1-2].[1-9].[1-8].[1-11].[1-12]
  const ken0Pattern = /^KEN\.0\.([1-2])\.([1-9])\.([1-8])\.([1-9]|1[0-1])\.([1-9]|1[0-2])$/;
  
  return mwi1Pattern.test(trimmedCode) || mwi0Pattern.test(trimmedCode) || ken0Pattern.test(trimmedCode);
}
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

  // Get current image to check status
  const currentImage = images.find(img => img.id === imageId);
  const isInvalidGroup = currentImage?.status === 'invalid_group';

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
    setEditValue(newGroup);
    setOpen(false);
    
    // Collect all image IDs to update
    const idsToUpdate = [imageId, ...additionalImageIds];
    
    try {
      // Update all images in sequence to ensure proper suffix handling
      for (const id of idsToUpdate) {
        // Update locally first for immediate UI feedback
        // Validate format and set appropriate status
        let newStatus: 'pending' | 'extracting' | 'extracted' | 'invalid_group' | 'pending_grouping' | 'grouping' | 'auto_grouped' | 'ungrouped' | 'user_grouped';
        if (!newGroup) {
          newStatus = 'ungrouped'; // Group cleared
        } else if (isValidSampleCode(newGroup)) {
          newStatus = 'user_grouped'; // Valid format
        } else {
          newStatus = 'invalid_group'; // Invalid format
        }
        
        updateImage(id, { 
          group: newGroup, 
          status: newStatus,
          groupingStatus: newGroup ? 'processing' : 'complete',
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
        // Backend handles format validation and sets the correct status
        updateImage(id, {
          group: updatedImage.group,
          newName: updatedImage.newName,
          status: updatedImage.status, // Use status from backend (includes validation)
          groupingStatus: updatedImage.groupingStatus || 'complete',
          groupingConfidence: updatedImage.groupingConfidence || 1.0,
        });
      }
    } catch (error) {
      console.error('Failed to update group:', error);
      // Revert on error for all affected images
      // Keep the original status when reverting (don't force user_grouped on error)
      idsToUpdate.forEach(id => {
        const originalImage = images.find(img => img.id === id);
        updateImage(id, { 
          group: currentGroup,
          status: originalImage?.status || 'pending',
          groupingStatus: currentGroup ? 'complete' : 'pending',
          groupingConfidence: currentGroup ? 1.0 : 0,
        });
      });
      setValue(currentGroup);
      setEditValue(currentGroup);
    }
  };

  // Handle inline editing save
  const handleInlineEditSave = () => {
    if (editValue.trim() !== value) {
      handleGroupChange(editValue.trim());
    }
    setIsEditing(false);
  };

  // Handle inline editing cancel
  const handleInlineEditCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  // Handle input key events for inline editing
  const handleInlineEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleInlineEditCancel();
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

  return (
    <div className="flex items-center gap-1 group/editor">
      {/* Inline editing mode */}
      {isEditing ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleInlineEditSave}
            onKeyDown={handleInlineEditKeyDown}
            className="flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter group name..."
          />
        </div>
      ) : (
        <>
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
                className="flex-1 justify-between text-xs h-8 px-2 group/button"
              >
                <div className="flex items-center flex-1 min-w-0">
                  {value ? (
                    <span 
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium truncate",
                        isInvalidGroup 
                          ? "text-amber-700 bg-amber-100" 
                          : "text-primary bg-primary/10"
                      )}
                      title={isInvalidGroup ? "Invalid group format. Expected: MWI.x.x.x or KEN.x.x.x" : undefined}
                    >
                      {value}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Select group...</span>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {/* Pencil icon for inline editing - only show when there's a current group */}
                  {value && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                      className="p-0.5 hover:bg-muted rounded opacity-0 group-hover/button:opacity-100 transition-opacity"
                      title="Edit group name"
                      type="button"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </div>
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
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium truncate",
                      isInvalidGroup 
                        ? "text-amber-700 bg-amber-100" 
                        : "text-primary bg-primary/10"
                    )}
                    title={isInvalidGroup ? "Invalid group format. Expected: MWI.x.x.x or KEN.x.x.x" : undefined}
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
    </>
      )}
    </div>
  );
}); 
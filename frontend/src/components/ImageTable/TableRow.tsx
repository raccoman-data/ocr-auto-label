import React, { useRef, useState } from 'react';
import { StatusDisplay } from '@/components/ImageTable/StatusDisplay';
import { cn } from '@/lib/utils';
import { Image } from '@/types';
import { useImageStore } from '@/stores/imageStore';
import { GroupEditor, GroupEditorHandle } from '@/components/GroupEditor';
import { InlineNameEditor } from '@/components/InlineNameEditor';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { deleteImage } from '@/lib/api';
import { Trash2 } from 'lucide-react';

interface TableRowProps {
  image: Image;
  isSelected: boolean;
  isActiveSelection: boolean;
  onClick: (event: React.MouseEvent) => void;
  onGroupEditorRef?: (id: string, ref: React.RefObject<GroupEditorHandle>) => void;
  additionalImageIds?: string[];
  groupPosition?: 'single' | 'first' | 'middle' | 'last' | 'none';
}

export function TableRow({ 
  image, 
  isSelected, 
  isActiveSelection, 
  onClick,
  onGroupEditorRef,
  additionalImageIds = [],
  groupPosition = 'none'
}: TableRowProps) {
  const groupEditorRef = useRef<GroupEditorHandle>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Register ref with parent when mounted
  React.useEffect(() => {
    if (onGroupEditorRef) {
      console.log('Registering GroupEditor ref for image:', image.id); // Debug log
      onGroupEditorRef(image.id, groupEditorRef);
    }
  }, [image.id, onGroupEditorRef]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Thumbnail failed to load:', {
      src: e.currentTarget.src,
      path: image.thumbnailPath,
      error: e
    });
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.log('Thumbnail loaded successfully:', e.currentTarget.src);
  };

  // Handle delete action - handles both single image and multiple selected images
  const handleDelete = async () => {
    try {
      const { selection } = useImageStore.getState();
      
      // Determine which images to delete: selected images if any, otherwise just this image
      const imagesToDelete = selection.selectedIds.size > 0 
        ? Array.from(selection.selectedIds)
        : [image.id];
      
      console.log(`🗑️ Deleting ${imagesToDelete.length} images...`);
      
      // Delete each image
      for (const imageId of imagesToDelete) {
        try {
          await deleteImage(imageId);
          useImageStore.getState().removeImage(imageId);
        } catch (error) {
          console.error(`❌ Failed to delete image ${imageId}:`, error);
          // Continue with other deletions even if one fails
        }
      }
      
      // Clear selection after successful deletion
      useImageStore.setState({
        selection: {
          selectedIds: new Set(),
          lastSelectedId: null,
        },
      });
      
      console.log(`✅ Successfully deleted ${imagesToDelete.length} image(s)`);
    } catch (error) {
      console.error('❌ Failed to delete images:', error);
      alert(`Failed to delete images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle name updates
  const handleNameUpdate = async (newName: string) => {
    try {
      // Optimistic update
      useImageStore.getState().updateImage(image.id, { newName });

      // Send to backend
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newName }),
      });

      if (!response.ok) {
        throw new Error('Failed to update image name');
      }

      const updatedImage = await response.json();
      // Update with server response
      useImageStore.getState().updateImage(image.id, updatedImage);
    } catch (error) {
      console.error('Error updating image name:', error);
      // Revert optimistic update
      useImageStore.getState().updateImage(image.id, { newName: image.newName });
    }
  };

  // Use thumbnail for table (performance), full image for sidebar
  const thumbnailUrl = image.thumbnailPath 
    ? `/thumbnails/${image.thumbnailPath.split('/').pop()}` 
    : null;

  // Format timestamp for display - clean MM-DD-YY format without timezone
  const formatTimestamp = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

    const pad = (n: number) => n.toString().padStart(2, '0');

    const month = pad(date.getMonth() + 1); // getMonth is 0-based
    const day = pad(date.getDate());
    const yearTwo = pad(date.getFullYear() % 100); // last two digits

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${month}-${day}-${yearTwo} ${hours}:${minutes}:${seconds}`;
  };

  // Get images from store to make groups reactive
  const { images } = useImageStore();
  
  // Collect all groups for combobox - now reactive to store changes
  const allGroups = React.useMemo(() => {
    const groups = new Set<string>();
    images.forEach(img => {
      if (img.group && img.group.trim()) {
        groups.add(img.group);
      }
    });
    return Array.from(groups).sort();
  }, [images]);

  // Generate colors for groups ensuring adjacent groups have different base colors
  const getGroupColor = React.useMemo(() => {
    // Base colors with good visual distinction
    const baseColors = [
      'bg-blue-400',      // Blue family
      'bg-green-400',     // Green family  
      'bg-purple-400',    // Purple family
      'bg-orange-400',    // Orange family
      'bg-pink-400',      // Pink family
      'bg-teal-400',      // Teal family
      'bg-indigo-400',    // Indigo family
      'bg-emerald-400',   // Emerald family
      'bg-cyan-400',      // Cyan family
      'bg-violet-400',    // Violet family
      'bg-sky-400',       // Sky family
      'bg-rose-400',      // Rose family
    ];

    // Get unique groups in the order they appear in the images array
    const uniqueGroups: string[] = [];
    const seen = new Set<string>();
    
    images.forEach(img => {
      if (img.group && img.group.trim() && !seen.has(img.group)) {
        uniqueGroups.push(img.group);
        seen.add(img.group);
      }
    });

    // Create a mapping of group name to color index
    const groupColorMap = new Map<string, string>();
    uniqueGroups.forEach((groupName, index) => {
      groupColorMap.set(groupName, baseColors[index % baseColors.length]);
    });

    return (groupName: string): string => {
      if (!groupName || !groupName.trim()) return 'transparent';
      return groupColorMap.get(groupName) || 'bg-gray-400'; // fallback
    };
  }, [images]); // Recalculate when images change

  // Get current selection info for context menu
  const { selection } = useImageStore();
  const selectedCount = selection.selectedIds.size;
  const isThisImageSelected = selection.selectedIds.has(image.id);
  
  // Determine context menu text and modal content based on selection
  const deleteContextText = selectedCount > 1 ? `Delete ${selectedCount} Images` : 'Delete Image';
  const deleteModalTitle = selectedCount > 1 ? `Delete ${selectedCount} Images` : 'Delete Image';
  
  const deleteModalDescription = selectedCount > 1
    ? `Are you sure you want to delete ${selectedCount} selected images?\n\nThis action cannot be undone.`
    : `Are you sure you want to delete "${image.originalName}"?\n\nThis action cannot be undone.`;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "h-16 linear-row flex items-center cursor-pointer group transition-colors duration-150 select-none relative",
            // Active row (showing in sidebar) - stronger blue, override hover
            isActiveSelection && "border-l-2 border-l-blue-100 bg-blue-100/70 hover:bg-blue-100",
            // Selected but not active - lighter blue, override hover
            isSelected && !isActiveSelection && "bg-blue-50 border-l border-l-blue-300 hover:bg-blue-50"
          )}
          onClick={onClick}
          data-image-id={image.id}
        >
          {/* Preview Column - Using THUMBNAIL for performance */}
          <div className="w-20 linear-cell">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={image.originalName}
                className="w-14 h-14 object-cover rounded-lg border shadow-sm"
                loading="lazy"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            ) : (
              <div className="w-14 h-14 bg-muted rounded-lg border flex items-center justify-center text-xs text-muted-foreground font-medium">
                IMG
              </div>
            )}
          </div>
          
          {/* Spacer with group indicator */}
          <div className="w-4 linear-cell flex items-center justify-center">
            {/* Group color indicator dot */}
            {image.group && image.group.trim() && (
              <div 
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0 opacity-75",
                  getGroupColor(image.group)
                )}
                title={`Group: ${image.group}`}
              />
            )}
          </div>
          
          {/* Original Name Column */}
          <div className="w-48 linear-cell min-w-[10rem]">
            <div className="truncate text-muted-foreground text-sm">
              {image.originalName}
            </div>
          </div>
          
          {/* Spacer between Original Name and New Name */}
          <div className="w-6 linear-cell"></div>
          
          {/* New Name Column */}
          <div className="flex-1 linear-cell min-w-[16rem] -ml-4">
            <InlineNameEditor
              currentName={image.newName || ''}
              placeholder={image.code || 'Unnamed'}
              originalName={image.originalName}
              imageId={image.id}
              onSave={handleNameUpdate}
              variant="table"
              className="w-full"
            />
          </div>
          
          {/* Spacer between New Name and Group */}
          <div className="w-6 linear-cell"></div>
          
          {/* Group Column */}
          <div className="w-56 linear-cell -ml-2 relative">
            {/* Combobox-style editor for selecting/creating groups */}
            <GroupEditor 
              ref={groupEditorRef}
              imageId={image.id} 
              currentGroup={image.group || ''} 
              allGroups={allGroups}
              additionalImageIds={additionalImageIds}
            />
          </div>
          
          {/* Timestamp Column */}
          <div className="w-48 linear-cell -ml-2">
            <div className="text-sm text-muted-foreground pl-1" title={
              typeof image.timestamp === 'string' 
                ? new Date(image.timestamp).toLocaleString()
                : image.timestamp.toLocaleString()
            }>
              {formatTimestamp(image.timestamp)}
            </div>
          </div>
          
          {/* Status Column */}
          <div className="w-36 linear-cell flex justify-end pr-2">
            <StatusDisplay
              status={image.status || 'pending'}
            />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => setShowDeleteModal(true)}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteContextText}
        </ContextMenuItem>
      </ContextMenuContent>
      
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title={deleteModalTitle}
        description={deleteModalDescription}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </ContextMenu>
  );
} 
import React, { useRef } from 'react';
import { StatusIcons } from '@/components/ImageTable/StatusIcons';
import { cn } from '@/lib/utils';
import { Image } from '@/types';
import { useImageStore } from '@/stores/imageStore';
import { GroupEditor, GroupEditorHandle } from '@/components/GroupEditor';
import { InlineNameEditor } from '@/components/InlineNameEditor';

interface TableRowProps {
  image: Image;
  isSelected: boolean;
  isActiveSelection: boolean;
  onClick: (event: React.MouseEvent) => void;
  onGroupEditorRef?: (id: string, ref: React.RefObject<GroupEditorHandle>) => void;
  additionalImageIds?: string[];
}

export function TableRow({ 
  image, 
  isSelected, 
  isActiveSelection, 
  onClick,
  onGroupEditorRef,
  additionalImageIds = []
}: TableRowProps) {
  const groupEditorRef = useRef<GroupEditorHandle>(null);

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

  return (
    <div
      className={cn(
        "h-16 linear-row flex items-center cursor-pointer group transition-colors duration-150 select-none",
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
      
      {/* Spacer */}
      <div className="w-4 linear-cell"></div>
      
      {/* Original Name Column */}
      <div className="w-48 linear-cell min-w-[10rem]">
        <div className="truncate text-muted-foreground text-sm">
          {image.originalName}
        </div>
      </div>
      
      {/* New Name Column */}
      <div className="flex-1 linear-cell min-w-[16rem] -ml-4">
        <InlineNameEditor
          currentName={image.newName || ''}
          placeholder={image.code || 'Unnamed'}
          originalName={image.originalName}
          onSave={handleNameUpdate}
          variant="table"
          className="w-full"
        />
      </div>
      
      {/* Group Column */}
      <div className="w-56 linear-cell -ml-2 -mr-[-10px] relative">
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
        <div className="text-sm text-muted-foreground" title={
          typeof image.timestamp === 'string' 
            ? new Date(image.timestamp).toLocaleString()
            : image.timestamp.toLocaleString()
        }>
          {formatTimestamp(image.timestamp)}
        </div>
      </div>
      
      {/* Status Column */}
      <div className="w-32 linear-cell flex justify-end pr-2">
        <StatusIcons
          paletteStatus={image.paletteStatus}
          geminiStatus={image.geminiStatus}
          groupingStatus={image.groupingStatus}
          paletteConfidence={image.paletteConfidence}
          geminiConfidence={image.geminiConfidence}
          groupingConfidence={image.groupingConfidence}
          hasCode={!!image.code}
          code={image.code}
        />
      </div>
    </div>
  );
} 
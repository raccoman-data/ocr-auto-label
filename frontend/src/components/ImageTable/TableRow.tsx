import React from 'react';
import { StatusIcons } from './StatusIcons';
import { cn } from '@/lib/utils';
import { Image } from '@/types';

interface TableRowProps {
  image: Image;
  isSelected: boolean;
  isActiveSelection: boolean;
  onClick: (event: React.MouseEvent) => void;
}

export function TableRow({ 
  image, 
  isSelected, 
  isActiveSelection, 
  onClick 
}: TableRowProps) {

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

  return (
    <div
      className={cn(
        "h-16 linear-row flex items-center cursor-pointer group",
        isActiveSelection && "border-l-2 border-l-primary"
      )}
      style={isActiveSelection ? { backgroundColor: 'hsl(var(--primary) / 0.08)' } : undefined}
      onClick={onClick}
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
      <div className="flex-1 linear-cell min-w-[12rem]">
        <div className="truncate text-muted-foreground text-sm">
          {image.originalName}
        </div>
      </div>
      
      {/* New Name Column */}
      <div className="flex-1 linear-cell min-w-[12rem] -ml-2">
        <div className="truncate font-medium text-sm">
          {image.newName || (
            <span className="text-muted-foreground italic">
              {image.code || '—'}
            </span>
          )}
        </div>
      </div>
      
      {/* Group Column */}
      <div className="w-48 linear-cell -ml-2">
        <div className="truncate text-sm">
          {image.group ? (
            <span 
              className="px-2 py-1 text-primary rounded-full text-xs font-medium"
              style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}
            >
              {image.group}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
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
      <div className="w-24 linear-cell flex justify-end pr-2">
        <StatusIcons
          paletteStatus={image.paletteStatus}
          geminiStatus={image.geminiStatus}
          groupingStatus={image.groupingStatus}
          paletteConfidence={image.paletteConfidence}
          geminiConfidence={image.geminiConfidence}
          groupingConfidence={image.groupingConfidence}
        />
      </div>
    </div>
  );
} 
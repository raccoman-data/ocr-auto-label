import React from 'react';
import { useImageStore } from '@/stores/imageStore';
import { formatFileSize, formatTimestamp } from '@/lib/utils';
import { StatusIcons } from '@/components/ImageTable/StatusIcons';

export function Sidebar() {
  const { selectedImage } = useImageStore();

  if (!selectedImage) {
    return (
      <div className="h-full p-6 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <span className="text-2xl">📷</span>
          </div>
          <p className="text-lg font-medium mb-2">No image selected</p>
          <p className="text-sm">Click on an image to view details</p>
        </div>
      </div>
    );
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Sidebar image failed to load:', {
      src: e.currentTarget.src,
      filePath: selectedImage.filePath,
      thumbnailPath: selectedImage.thumbnailPath
    });
    
    // Fallback to thumbnail if full image fails
    if (e.currentTarget.src !== selectedImage.thumbnailPath) {
      console.log('Falling back to thumbnail...');
      e.currentTarget.src = selectedImage.thumbnailPath || '';
    }
  };

  // Try raw image first for maximum quality, fallback to thumbnail
  const rawImageUrl = selectedImage.filePath ? 
    `/raw/${selectedImage.filePath.split('/').pop()}` : null;
  const thumbnailUrl = selectedImage.thumbnailPath || null;
  const imageUrl = rawImageUrl || thumbnailUrl;

  return (
    <div className="h-full flex flex-col">
      {/* Image Preview */}
      <div className="p-4 border-b border-border">
        {imageUrl ? (
          <div className="space-y-2">
            <img
              src={imageUrl}
              alt={selectedImage.originalName}
              className="w-full h-auto object-contain rounded-lg border shadow-sm"
              onError={handleImageError}
              style={{ maxHeight: 'none', imageRendering: 'crisp-edges' }}
            />
            {/* Compact file info right under image */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatFileSize(selectedImage.fileSize)}</span>
              <span>{formatTimestamp(selectedImage.timestamp)}</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-96 bg-muted rounded-lg border flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-2">📷</div>
              <p className="text-sm font-medium">No preview available</p>
              <p className="text-xs mt-1">No valid image paths found</p>
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto sidebar-scrollbar">
        {/* Names - more compact */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">New Name</label>
            <div className="p-2 bg-muted/50 rounded text-xs border">
              {selectedImage.newName || (
                <span className="italic text-muted-foreground">
                  {selectedImage.code || 'Not set'}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Original Name</label>
            <div className="p-2 bg-muted/50 rounded text-xs border">
              {selectedImage.originalName}
            </div>
          </div>
        </div>

        {/* Group */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">Group</label>
          <div className="p-2 bg-muted/50 rounded text-xs border flex items-center">
            {selectedImage.group ? (
              <span 
                className="px-2 py-1 text-primary rounded-full text-xs font-medium"
                style={{ backgroundColor: 'hsl(var(--primary) / 0.1)' }}
              >
                {selectedImage.group}
              </span>
            ) : (
              <span className="italic text-muted-foreground">No group assigned</span>
            )}
          </div>
        </div>

        {/* Extracted Data - more compact */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Sample Code</label>
            <div className="p-2 bg-muted/50 rounded text-xs border font-mono">
              {selectedImage.code || (
                <span className="italic text-muted-foreground">Not detected</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Other Text</label>
            <div className="p-2 bg-muted/50 rounded text-xs border">
              {selectedImage.otherText || (
                <span className="italic text-muted-foreground">None detected</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Object Description</label>
            <div className="p-2 bg-muted/50 rounded text-xs border">
              {selectedImage.objectDesc || (
                <span className="italic text-muted-foreground">Not described</span>
              )}
            </div>
          </div>
        </div>

        {/* Color Palette - smaller and more compact */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Color Palette</label>
          {selectedImage.palette && selectedImage.palette.length > 0 ? (
            <div className="flex gap-1">
              {selectedImage.palette.map((color, index) => {
                const tooltipText = `${color.name || 'Color'}: ${color.color} (${color.percentage || 0}%)`;
                return (
                  <div
                    key={index}
                    className="flex-1 h-8 rounded border shadow-sm cursor-pointer hover:scale-105 transition-transform relative"
                    style={{ backgroundColor: color.color }}
                    title={tooltipText}
                  />
                );
              })}
            </div>
          ) : (
            <div className="p-3 bg-muted/50 rounded text-xs border text-center">
              {selectedImage.paletteStatus === 'pending' && (
                <span className="italic text-muted-foreground">⏳ Extracting colors...</span>
              )}
              {selectedImage.paletteStatus === 'processing' && (
                <span className="italic text-muted-foreground">🎨 Processing palette...</span>
              )}
              {selectedImage.paletteStatus === 'error' && (
                <span className="italic text-muted-foreground">❌ Failed to extract colors</span>
              )}
              {selectedImage.paletteStatus === 'complete' && (
                <span className="italic text-muted-foreground">🎨 No colors detected</span>
              )}
            </div>
          )}
        </div>

        {/* Processing Status with icons - moved to bottom */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Status</label>
          <div className="flex items-center">
            <StatusIcons
              paletteStatus={selectedImage.paletteStatus}
              geminiStatus={selectedImage.geminiStatus}
              groupingStatus={selectedImage.groupingStatus}
              paletteConfidence={selectedImage.paletteConfidence}
              geminiConfidence={selectedImage.geminiConfidence}
              groupingConfidence={selectedImage.groupingConfidence}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 
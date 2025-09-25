import React, { useState, useRef, useCallback } from 'react';
import { useImageStore } from '@/stores/imageStore';
import { formatFileSize, formatTimestamp, cn } from '@/lib/utils';
import { StatusDisplay } from '@/components/ImageTable/StatusDisplay';
import { GroupEditor } from '@/components/GroupEditor';
import { InlineNameEditor } from '@/components/InlineNameEditor';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';


export function Sidebar() {
  const { selectedImage, images, updateImage } = useImageStore();
  const [showZoom, setShowZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoomLevel(prev => Math.max(0.5, Math.min(5, prev * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Handle escape key to close zoom
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showZoom) {
        setShowZoom(false);
        setZoomLevel(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    if (showZoom) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showZoom]);

  // Get all unique groups for the combobox
  const getAllGroups = () => {
    const groups = new Set<string>();
    images.forEach(image => {
      if (image.group && image.group.trim()) {
        groups.add(image.group);
      }
    });
    return Array.from(groups).sort();
  };

  // Handle name updates
  const handleNameUpdate = async (newName: string) => {
    if (!selectedImage) return;
    
    try {
      // Optimistic update
      updateImage(selectedImage.id, { newName });

      // Send to backend
      const response = await fetch(`/api/images/${selectedImage.id}`, {
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
      updateImage(selectedImage.id, updatedImage);
    } catch (error) {
      console.error('Error updating image name:', error);
      // Revert optimistic update
      updateImage(selectedImage.id, { newName: selectedImage.newName });
    }
  };

  // Handle retry extraction
  const handleRetryExtraction = async () => {
    if (!selectedImage || isRetrying) return;
    
    try {
      setIsRetrying(true);
      
      // Optimistic update to show we're retrying
      updateImage(selectedImage.id, { 
        status: 'extracting',
        geminiStatus: 'processing'
      });

      // Send retry request to backend
      const response = await fetch(`/api/images/${selectedImage.id}/rerun-gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to retry extraction');
      }

      console.log('✅ Retry extraction started for:', selectedImage.originalName);
    } catch (error) {
      console.error('Error retrying extraction:', error);
      // Revert optimistic update on error
      updateImage(selectedImage.id, { 
        status: 'pending',
        geminiStatus: 'error'
      });
    } finally {
      setIsRetrying(false);
    }
  };

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
  // const rawImageUrl = selectedImage.filePath ? 
  //   `/raw/${selectedImage.filePath.split('/').pop()}` : null;
  const rawImageUrl = selectedImage.filePath ? 
    `/raw/${selectedImage.filePath.replace(/\\/g, '/').split('/').pop()}` : null;
  const thumbnailUrl = selectedImage.thumbnailPath || null;
  const imageUrl = rawImageUrl || thumbnailUrl;

  return (
    <div className="h-full flex flex-col">
      {/* Image Preview */}
      <div className="p-4 border-b border-border">
        {imageUrl ? (
          <div className="space-y-2">
            <div className="relative">
              <img
                src={imageUrl}
                alt={selectedImage.originalName}
                className="w-full h-auto object-contain rounded-lg border shadow-sm cursor-zoom-in"
                onError={handleImageError}
                onClick={() => setShowZoom(true)}
                style={{ maxHeight: 'none', imageRendering: 'crisp-edges' }}
              />
              
              {/* Custom zoom overlay */}
              {showZoom && (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-90 z-50"
                >
                  <div className="relative w-full h-full p-4 overflow-hidden">
                    <button
                      onClick={() => setShowZoom(false)}
                      className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 text-2xl font-bold"
                    >
                      ×
                    </button>
                    
                    <div className="absolute top-4 left-4 z-10 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
                      Zoom: {Math.round(zoomLevel * 100)}% | Scroll to zoom, drag to pan
                    </div>

                    <div 
                      className="w-full h-full flex items-center justify-center overflow-hidden"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          setShowZoom(false);
                          setZoomLevel(1);
                          setPosition({ x: 0, y: 0 });
                        }
                      }}
                      onWheel={handleWheel}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    >
                      <img
                        ref={imgRef}
                        src={imageUrl}
                        alt={selectedImage.originalName}
                        className="select-none"
                        onDoubleClick={resetZoom}
                        style={{
                          transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
                          imageRendering: 'crisp-edges',
                          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
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
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">New Name</label>
            <div className="p-2 bg-muted/50 rounded border min-h-[2rem] flex items-center">
              <InlineNameEditor
                currentName={selectedImage.newName || selectedImage.code || ''}
                placeholder={selectedImage.code || 'Unnamed'}
                originalName={selectedImage.originalName}
                imageId={selectedImage.id}
                onSave={handleNameUpdate}
                variant="sidebar"
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Original Name</label>
            <div className="p-2 bg-muted/50 rounded text-xs border">
              {selectedImage.originalName}
            </div>
          </div>
        </div>

        {/* Group - Editable */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-1 block">Group</label>
          <GroupEditor 
            imageId={selectedImage.id}
            currentGroup={selectedImage.group || ''}
            allGroups={getAllGroups()}
          />
        </div>

        {/* Extracted Data - more compact */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Extracted Code</label>
            <div 
              className={cn(
                "p-2 bg-muted/50 rounded text-xs border font-mono transition-all relative",
                selectedImage.code 
                  ? "cursor-pointer hover:bg-muted/70 hover:border-primary/30 group" 
                  : "cursor-default",
                copyFeedback && "bg-emerald-50 border-emerald-200"
              )}
              onClick={async () => {
                if (selectedImage.code) {
                  try {
                    await navigator.clipboard.writeText(selectedImage.code);
                    setCopyFeedback(true);
                    setTimeout(() => setCopyFeedback(false), 1500);
                  } catch (err) {
                    console.error('Failed to copy code:', err);
                  }
                }
              }}
              title={selectedImage.code ? 
                `Code: ${selectedImage.code}\nConfidence: ${selectedImage.geminiConfidence ? (selectedImage.geminiConfidence * 100).toFixed(1) + '%' : 'Unknown'}\nClick to copy` : 
                undefined
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>
                    {selectedImage.code || (
                      <span className="italic text-muted-foreground">Not detected</span>
                    )}
                  </span>
                  {/* Confidence indicator */}
                  {selectedImage.code && selectedImage.geminiConfidence && (
                    <span className="text-xs text-muted-foreground/60 font-normal">
                      ({(selectedImage.geminiConfidence * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
                {selectedImage.code && (
                  <div className="ml-2 flex items-center">
                    {copyFeedback ? (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <Check className="w-3 h-3" />
                        <span className="text-xs">Copied!</span>
                      </div>
                    ) : (
                      <Copy className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                )}
              </div>
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

        {/* Object Colors (from Gemini) */}
        <div>
          <label className="text-xs font-semibold text-foreground mb-2 block">Object Colors</label>
          {selectedImage.objectColors && Array.isArray(selectedImage.objectColors) && selectedImage.objectColors.length > 0 ? (
            <div className="flex gap-1">
              {selectedImage.objectColors.map((color, index) => {
                const tooltipText = `${color.name}: ${color.color}`;
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
              {selectedImage.geminiStatus === 'pending' && (
                <span className="italic text-muted-foreground">⏳ Analyzing object colors...</span>
              )}
              {selectedImage.geminiStatus === 'processing' && (
                <span className="italic text-muted-foreground">🎨 AI detecting colors...</span>
              )}
              {selectedImage.geminiStatus === 'error' && (
                <span className="italic text-muted-foreground">❌ Failed to detect colors</span>
              )}
              {selectedImage.geminiStatus === 'complete' && (
                <span className="italic text-muted-foreground">🎨 No colors detected</span>
              )}
            </div>
          )}
        </div>

        {/* Processing Status */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-foreground">Status</label>
            <Button
              onClick={handleRetryExtraction}
              disabled={isRetrying}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs hover:bg-muted/50"
              title="Re-run extraction with Gemini AI"
            >
              {isRetrying ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
            </Button>
          </div>
          <StatusDisplay status={selectedImage.status} />
        </div>
      </div>
    </div>
  );
} 
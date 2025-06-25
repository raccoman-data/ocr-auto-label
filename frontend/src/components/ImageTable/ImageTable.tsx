import React, { useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import { Image } from '@/types';

interface ImageTableProps {
  images: Image[];
  selectedImageId: string | null;
  onImageSelect: (image: Image) => void;
}

export function ImageTable({ 
  images, 
  selectedImageId, 
  onImageSelect 
}: ImageTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Set up virtualization with fixed row height
  const rowVirtualizer = useVirtualizer({
    count: images.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // 64px per row (h-16)
    overscan: 10, // Render 10 extra items outside viewport for smooth scrolling
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Track how many rows are actually visible in viewport (excludes off-screen overscan)
  const [visibleCount, setVisibleCount] = React.useState(0);
  const [visibleRange, setVisibleRange] = React.useState<{start:number;end:number}>({start:0,end:0});

  // Recalculate visible count on scroll or virtualization change
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const calculateVisible = () => {
      const viewTop = container.scrollTop;
      const viewBottom = viewTop + container.clientHeight;
      let start = Number.MAX_SAFE_INTEGER;
      let end = -1;
      let count = 0;
      virtualItems.forEach((item) => {
        const itemTop = item.start;
        const itemBottom = itemTop + item.size;
        if (itemBottom >= viewTop && itemTop <= viewBottom) {
          count += 1;
          if (item.index < start) start = item.index;
          if (item.index > end) end = item.index;
        }
      });
      if (count === 0) {
        start = 0;
        end = 0;
      }
      setVisibleCount(count);
      setVisibleRange({start: start+1, end: end+1}); // +1 for 1-based display
    };

    // Initial calc and on scroll
    calculateVisible();
    container.addEventListener('scroll', calculateVisible);
    return () => container.removeEventListener('scroll', calculateVisible);
  }, [virtualItems]);

  // Ensure selected item is visible (no forced centering)
  useEffect(() => {
    if (!selectedImageId) return;

    const selectedIndex = images.findIndex((img) => img.id === selectedImageId);
    if (selectedIndex < 0) return;

    rowVirtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
  }, [selectedImageId, images, rowVirtualizer]);

  // Keyboard navigation: ArrowUp / ArrowDown move selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      // Ignore key events originating from inputs/textareas
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (images.length === 0) return;

      const currentIndex = selectedImageId
        ? images.findIndex((img) => img.id === selectedImageId)
        : -1;

      let newIndex = currentIndex;

      if (e.key === 'ArrowUp') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      } else if (e.key === 'ArrowDown') {
        newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : images.length - 1;
      }

      if (newIndex !== currentIndex) {
        onImageSelect(images[newIndex]);
        rowVirtualizer.scrollToIndex(newIndex, { align: 'auto' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images, selectedImageId, rowVirtualizer, onImageSelect]);

  const handleRowClick = (image: Image) => {
    onImageSelect(image);
  };

  if (images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground mb-1">No images uploaded</h3>
            <p className="text-sm text-muted-foreground">
              Drag and drop images or click to browse files
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-x-auto">
      <div className="min-w-max">
        {/* Header */}
        <TableHeader />
        
        {/* Virtualized Table Body */}
        <div
          ref={parentRef}
          className="flex-1 overflow-auto linear-scrollbar pb-14"
          style={{
            height: 'calc(100vh - 9rem)', // Account for toolbar + header only (status bar now fixed)
            minHeight: '400px',
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const image = images[virtualItem.index];
              const isSelected = image.id === selectedImageId;
              
              return (
                <div
                  key={image.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <TableRow
                    image={image}
                    isSelected={isSelected}
                    isActiveSelection={isSelected}
                    onClick={() => handleRowClick(image)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="border-t bg-muted/30 px-6 py-2 text-xs text-muted-foreground flex items-center justify-between sticky bottom-0 z-10 backdrop-blur-sm">
        <span>
          {images.length} image{images.length !== 1 ? 's' : ''} total
        </span>
        <span>
          {visibleRange.end} of {images.length} rows
        </span>
      </div>
    </div>
  );
} 
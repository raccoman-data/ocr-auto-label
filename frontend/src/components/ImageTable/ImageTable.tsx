import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import { Image } from '@/types';
import { useImageStore } from '@/stores/imageStore';
import { GroupEditorHandle } from '@/components/GroupEditor';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { deleteImage } from '@/lib/api';

// Detailed validation function (matching backend logic)
function isValidSampleCode(code: string | null): boolean {
  if (!code) return false;
  
  const trimmedCode = code.trim().toUpperCase();
  
  // Pattern 1: MWI.1.[1-3].[1-24].[1-10][A-D].[1-30].[1-12]
  const mwi1Pattern = /^MWI\.1\.([1-3])\.([1-9]|1[0-9]|2[0-4])\.([1-9]|10)[A-D]\.([1-9]|1[0-9]|2[0-9]|30)\.([1-9]|1[0-2])$/;
  
  // Pattern 2: MWI.0.[1-3].[1-6].[1-13].[1-27].[1-12]
  const mwi0Pattern = /^MWI\.0\.([1-3])\.([1-6])\.([1-9]|1[0-3])\.([1-9]|1[0-9]|2[0-7])\.([1-9]|1[0-2])$/;
  
  // Pattern 3: KEN.0.[1-2].[1-9].[1-8].[1-11].[1-12]
  const ken0Pattern = /^KEN\.0\.([1-2])\.([1-9])\.([1-8])\.([1-9]|1[0-1])\.([1-9]|1[0-2])$/;
  
  return mwi1Pattern.test(trimmedCode) || mwi0Pattern.test(trimmedCode) || ken0Pattern.test(trimmedCode);
}

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
  const {
    selection,
    toggleImageSelection,
    selectedImage,
  } = useImageStore();

  // Holds the group copied via ⌘/Ctrl-C so we can paste later
  const copiedGroupRef = useRef<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Map to store refs to GroupEditor components
  const groupEditorRefs = useRef<Map<string, React.RefObject<GroupEditorHandle>>>(new Map());
  
  // Track which editor should show additional IDs
  const [activeEditorState, setActiveEditorState] = React.useState<{
    id: string | null;
    additionalIds: string[];
  }>({ id: null, additionalIds: [] });

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);

  // Handle delete action for selected images
  const handleDeleteSelected = async () => {
    try {
      // Determine which images to delete: selected images if any, otherwise current selected image
      const imagesToDelete = selection.selectedIds.size > 0 
        ? Array.from(selection.selectedIds)
        : selectedImage?.id
          ? [selectedImage.id]
          : [];
      
      if (imagesToDelete.length === 0) return;
      
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

  // Callback to register GroupEditor refs from rows
  const handleGroupEditorRef = (id: string, ref: React.RefObject<GroupEditorHandle>) => {
    groupEditorRefs.current.set(id, ref);
  };

  // Set up virtualization with fixed row height
  const rowVirtualizer = useVirtualizer({
    count: images.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // 64px per row (h-16)
    overscan: 10, // Render 10 extra items outside viewport for smooth scrolling
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Calculate visible range based on scroll position and viewport
  const [visibleRange, setVisibleRange] = React.useState<{start:number;end:number}>({start:1,end:1});

  // Calculate which rows are actually visible in viewport (not including overscan)
  useEffect(() => {
    if (!parentRef.current || images.length === 0) return;

    const updateVisibleRange = () => {
      const scrollElement = parentRef.current;
      if (!scrollElement) return;

      const scrollTop = scrollElement.scrollTop;
      const viewportHeight = scrollElement.clientHeight;
      const rowHeight = 64; // Fixed row height

      // Calculate first and last visible row indices (0-based)
      const firstVisibleIndex = Math.floor(scrollTop / rowHeight);
      const lastVisibleIndex = Math.min(
        Math.floor((scrollTop + viewportHeight) / rowHeight),
        images.length - 1
      );

      // Convert to 1-based for display
      const start = Math.max(1, firstVisibleIndex + 1);
      const end = Math.max(1, lastVisibleIndex + 1);

      setVisibleRange({ start, end });
    };

    // Initial calculation
    updateVisibleRange();

    // Listen for scroll events
    const scrollElement = parentRef.current;
    scrollElement.addEventListener('scroll', updateVisibleRange);

    return () => {
      scrollElement.removeEventListener('scroll', updateVisibleRange);
    };
  }, [images.length]);

  // Ensure selected item is visible (no forced centering)
  useEffect(() => {
    if (!selectedImageId) return;

    const selectedIndex = images.findIndex((img) => img.id === selectedImageId);
    if (selectedIndex < 0) return;

    rowVirtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
  }, [selectedImageId, images, rowVirtualizer]);

  /* ------------------------------------------------------------------
   * Global key-handling (arrow nav + copy/paste/clear)
   * Register once and always fetch fresh data from the store inside.
   * ------------------------------------------------------------------ */
  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    console.log('Key pressed:', e.key, 'Meta:', e.metaKey || e.ctrlKey); // Debug log
    
    const isMeta = e.metaKey || e.ctrlKey;

    // If focus is inside an input/textarea, handle carefully
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    const isInInput = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).contentEditable === 'true';
    
    if (isInInput) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Navigation keys: blur the input and allow navigation to continue
        (e.target as HTMLElement).blur();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Backspace/Delete while typing: let the input handle it, don't clear groups
        return;
      } else {
        // Other keys: let the input handle them normally
        return;
      }
    }

    /* ----- Focus Search (⌘/Ctrl + F) ----------------------- */
    if (isMeta && e.key.toLowerCase() === 'f') {
      e.preventDefault(); // Prevent browser search
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.focus();
      }
      return;
    }

    /* ----- Open Group Editor (⌘/Ctrl + G) ------------------- */
    if (isMeta && e.key.toLowerCase() === 'g') {
      e.preventDefault(); // Prevent browser shortcuts
      console.log('Ctrl+G pressed'); // Debug log
      
      // Get target IDs - either selection or current row
      const targetIds: string[] = selection.selectedIds.size > 0
        ? Array.from(selection.selectedIds)
        : selectedImage?.id
          ? [selectedImage.id]
          : [];

      console.log('Target IDs:', targetIds); // Debug log
      
      // Open the first selected/active row's group editor
      if (targetIds.length > 0) {
        const firstId = targetIds[0];
        const otherIds = targetIds.slice(1);
        const editorRef = groupEditorRefs.current.get(firstId);
        console.log('Editor ref found:', !!editorRef?.current); // Debug log
        if (editorRef?.current) {
          setActiveEditorState({ id: firstId, additionalIds: otherIds });
          editorRef.current.open();
        }
      }
      return;
    }

    /* ----- Copy (⌘/Ctrl + C) ----------------------------------- */
    if (isMeta && e.key.toLowerCase() === 'c') {
      const sourceId: string | undefined = selection.lastSelectedId || selectedImage?.id;
      if (!sourceId) return;
      const srcImg = images.find((img: Image) => img.id === sourceId);
      if (srcImg?.group !== undefined) {
        copiedGroupRef.current = srcImg.group || '';
        navigator.clipboard?.writeText(srcImg.group || '').catch(() => {/* ignore */});
        
        // Clear selection after copy
        useImageStore.setState({
          selection: {
            selectedIds: new Set(),
            lastSelectedId: sourceId,
          },
        });
      }
      return;
    }

    /* ----- Paste (⌘/Ctrl + V) ---------------------------------- */
    if (isMeta && e.key.toLowerCase() === 'v') {
      const group = copiedGroupRef.current;
      if (group == null) return; // null means nothing copied yet

      const targetIds: string[] = selection.selectedIds.size > 0
        ? Array.from(selection.selectedIds)
        : selectedImage?.id
          ? [selectedImage.id]
          : [];

      // Multi-row paste: sequential backend requests to ensure unique suffixes
      if (targetIds.length > 1 && group && group.trim()) {
        (async () => {
          for (const id of targetIds) {
            // Validate format and set appropriate status
            const newStatus = isValidSampleCode(group) ? 'user_grouped' : 'invalid_group';
            
            // Mark as processing optimistically
            useImageStore.getState().updateImage(id, { 
              group, 
              status: newStatus,
              groupingStatus: 'processing' 
            });

            try {
              const updated = await fetch(`/api/images/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group }),
              }).then(res => res.ok ? res.json() : Promise.reject(res));

              useImageStore.getState().updateImage(id, {
                group: updated.group,
                newName: updated.newName,
                status: updated.status, // Use status from backend (includes validation)
                groupingStatus: 'complete',
                groupingConfidence: 1.0,
              });
            } catch (err) {
              console.error('Failed to update group:', err);
              useImageStore.getState().updateImage(id, { groupingStatus: 'error', groupingConfidence: 0 });
            }
          }
        })();
      } else {
        // Single row operation - let backend handle naming
        targetIds.forEach((id) => {
          // Validate format and set appropriate status
          let newStatus: 'pending' | 'extracting' | 'extracted' | 'invalid_group' | 'pending_grouping' | 'grouping' | 'auto_grouped' | 'ungrouped' | 'user_grouped';
          if (!group || !group.trim()) {
            newStatus = 'ungrouped'; // Group cleared
          } else if (isValidSampleCode(group)) {
            newStatus = 'user_grouped'; // Valid format
          } else {
            newStatus = 'invalid_group'; // Invalid format
          }

          useImageStore.getState().updateImage(id, { 
            group, 
            status: newStatus,
            groupingStatus: group ? 'complete' : 'complete', 
            groupingConfidence: group ? 1.0 : 0 
          });

          fetch(`/api/images/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group }),
          })
            .then((res) => res.ok ? res.json() : Promise.reject(res))
            .then((updated) => {
              useImageStore.getState().updateImage(id, {
                group: updated.group,
                newName: updated.newName,
                status: updated.status, // Use status from backend (includes validation)
                groupingStatus: updated.groupingStatus || 'complete',
                groupingConfidence: updated.groupingConfidence || 1.0,
              });
            })
            .catch((err) => console.error('Failed to update group:', err));
        });
      }
      
      // Clear selection after paste
      useImageStore.setState({
        selection: {
          selectedIds: new Set(),
          lastSelectedId: selectedImage?.id || null,
        },
      });
      return;
    }

    /* ----- Clear selection (Escape) --------------------------- */
    if (e.key === 'Escape') {
      // If search is focused and has content, clear it first
      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      if (searchInput && document.activeElement === searchInput && searchInput.value) {
        useImageStore.getState().setSearchQuery('');
        return;
      }
      
      // Otherwise clear selection
      useImageStore.setState({
        selection: {
          selectedIds: new Set(),
          lastSelectedId: selectedImage?.id || null,
        },
      });
      return;
    }

    /* ----- Delete images (⌘/Ctrl + Shift + Delete/Backspace) --- */
    if (isMeta && e.shiftKey && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault(); // Prevent browser shortcuts
      console.log('Cmd+Shift+Delete pressed'); // Debug log
      
      // Get target IDs - either selection or current image
      const targetIds: string[] = selection.selectedIds.size > 0
        ? Array.from(selection.selectedIds)
        : selectedImage?.id
          ? [selectedImage.id]
          : [];

      if (targetIds.length > 0) {
        setShowDeleteModal(true);
      }
      return;
    }

    /* ----- Clear group (Backspace/Delete) --------------------- */
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const targetIds: string[] = selection.selectedIds.size > 0
        ? Array.from(selection.selectedIds)
        : selectedImage?.id
          ? [selectedImage.id]
          : [];

      if (targetIds.length === 0) return;

      targetIds.forEach((id) => {
        // Optimistic clear - clearing group manually results in ungrouped status
        useImageStore.getState().updateImage(id, { 
          group: '', 
          newName: '', 
          status: 'ungrouped',
          groupingStatus: 'complete', 
          groupingConfidence: 0 
        });

        fetch(`/api/images/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group: '', newName: '' }),
        })
          .then((res) => res.ok ? res.json() : Promise.reject(res))
          .then((updated) => {
            useImageStore.getState().updateImage(id, {
              group: updated.group || '',
              newName: '', // Always clear newName when group is cleared
              status: 'ungrouped',
              groupingStatus: 'complete',
              groupingConfidence: 0,
            });
          })
          .catch(() => {/* errors already handled */});
      });
      
      // Clear selection after delete/backspace
      useImageStore.setState({
        selection: {
          selectedIds: new Set(),
          lastSelectedId: selectedImage?.id || null,
        },
      });
      return;
    }

    /* ----- Arrow navigation (↑ / ↓) --------------------------- */
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (images.length === 0) return;

      const currentIndex = selectedImage
        ? images.findIndex((img: Image) => img.id === selectedImage.id)
        : -1;

      let newIndex = currentIndex;

      if (e.key === 'ArrowUp') newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      else if (e.key === 'ArrowDown') newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : images.length - 1;

      if (newIndex !== currentIndex) {
        const newImg = images[newIndex];
        onImageSelect(newImg);

        if (e.shiftKey) {
          // Shift+Arrow: Add to selection range
          const anchorIndex = selection.lastSelectedId 
            ? images.findIndex((img: Image) => img.id === selection.lastSelectedId)
            : currentIndex;
          
          if (anchorIndex !== -1) {
            const [start, end] = anchorIndex < newIndex ? [anchorIndex, newIndex] : [newIndex, anchorIndex];
            const rangeIds = images.slice(start, end + 1).map((img: Image) => img.id);
            const newSelected = new Set<string>(rangeIds);

            useImageStore.setState({
              selection: {
                selectedIds: newSelected,
                lastSelectedId: selection.lastSelectedId || newImg.id,
              },
            });
          }
        } else {
          // Normal arrow: Clear selection and just focus on the new row
          useImageStore.setState({
            selection: {
              selectedIds: new Set(),
              lastSelectedId: newImg.id,
            },
          });
        }

        rowVirtualizer.scrollToIndex(newIndex, { align: 'auto' });

        // Ensure any lingering focused element (e.g., name editor) is blurred
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    }
  }, [images, onImageSelect, selection, selectedImage]);

  // Set up keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * Handles row click taking into account modifier keys for selection
   * – Cmd/Ctrl click toggles the clicked row in the current selection.
   * – Shift click selects the contiguous range from the last selected row.
   * – Plain click selects only that row.
   */
  const handleRowClick = (e: React.MouseEvent, image: Image) => {
    const isMultiKey = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    // Prevent text selection when shift-clicking
    if (isShift) {
      e.preventDefault();
    }

    if (isShift && selection.lastSelectedId) {
      // Compute range between lastSelectedId and current
      const lastIdx = images.findIndex((img) => img.id === selection.lastSelectedId);
      const currentIdx = images.findIndex((img) => img.id === image.id);
      if (lastIdx !== -1 && currentIdx !== -1) {
        const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
        const rangeIds = images.slice(start, end + 1).map((img) => img.id);
        const newSelected = new Set<string>(rangeIds);

        useImageStore.setState({
          selection: {
            selectedIds: newSelected,
            lastSelectedId: selection.lastSelectedId,
          },
        });
      }
    } else {
      // Toggle or single select depending on modifier key
      toggleImageSelection(image.id, isMultiKey);
    }

    // Mark this row as the active row for sidebar display
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
              Click to browse files
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full" data-image-table>
      {/* Horizontal scroll container */}
      <div className="flex-1 min-h-0 overflow-x-auto linear-scrollbar">
        <div className="min-w-[1050px]">
          {/* Header */}
          <TableHeader />

          {/* Virtualized Table Body */}
          <div
            ref={parentRef}
            className="flex-1 min-h-0 overflow-y-auto linear-scrollbar pb-14"
            style={{ maxHeight: 'calc(100vh - 148px)' }} // Fixed viewport height
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
                const isSelected = selection.selectedIds.has(image.id);
                const isActiveSelection = image.id === selectedImageId;
                
                // Only pass additionalIds to the active editor
                const additionalIds = 
                  activeEditorState.id === image.id 
                    ? activeEditorState.additionalIds 
                    : [];

                // Calculate group visual indicators - check for consecutive grouping
                const currentGroup = image.group && image.group.trim() ? image.group : null;
                const prevImage = virtualItem.index > 0 ? images[virtualItem.index - 1] : null;
                const nextImage = virtualItem.index < images.length - 1 ? images[virtualItem.index + 1] : null;
                
                const prevGroup = prevImage?.group && prevImage.group.trim() ? prevImage.group : null;
                const nextGroup = nextImage?.group && nextImage.group.trim() ? nextImage.group : null;
                
                // Determine group position for visual styling
                let groupPosition: 'single' | 'first' | 'middle' | 'last' | 'none' = 'none';
                
                if (currentGroup) {
                  const hasGroupBefore = prevGroup === currentGroup;
                  const hasGroupAfter = nextGroup === currentGroup;
                  
                  if (hasGroupBefore && hasGroupAfter) {
                    groupPosition = 'middle';
                  } else if (hasGroupBefore && !hasGroupAfter) {
                    groupPosition = 'last';
                  } else if (!hasGroupBefore && hasGroupAfter) {
                    groupPosition = 'first';
                  } else {
                    groupPosition = 'single'; // Has group but not consecutive
                  }
                }

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
                      isActiveSelection={isActiveSelection}
                      onClick={(e) => handleRowClick(e, image)}
                      onGroupEditorRef={handleGroupEditorRef}
                      additionalImageIds={additionalIds}
                      groupPosition={groupPosition}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t bg-card px-6 py-2 text-xs text-muted-foreground flex items-center justify-between sticky bottom-0 z-10">
        <div className="flex items-center gap-4">
        <span>
          {images.length} image{images.length !== 1 ? 's' : ''} total
        </span>
          {selection.selectedIds.size > 0 && (
            <span className="text-primary font-medium">
              {selection.selectedIds.size} selected
            </span>
          )}
        </div>
        <span>
          {visibleRange.end} of {images.length} rows
        </span>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title={
          selection.selectedIds.size > 1 
            ? `Delete ${selection.selectedIds.size} Images` 
            : selectedImage?.id && selection.selectedIds.has(selectedImage.id)
              ? 'Delete Image'
              : selectedImage
                ? 'Delete Image'
                : 'Delete Images'
        }
        description={
          selection.selectedIds.size > 1
            ? `Are you sure you want to delete ${selection.selectedIds.size} selected images?\n\nThis action cannot be undone.`
            : selectedImage
              ? `Are you sure you want to delete "${selectedImage.originalName}"?\n\nThis action cannot be undone.`
              : 'Are you sure you want to delete the selected images?\n\nThis action cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteSelected}
      />
    </div>
  );
} 
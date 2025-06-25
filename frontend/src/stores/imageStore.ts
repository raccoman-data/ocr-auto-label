import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Image, FilterOption, SelectionState, DragState } from '@/types';
import { getImages } from '@/lib/api';

// SSE connection for real-time updates
let eventSource: EventSource | null = null;

// Sorting types
type SortField = 'timestamp' | 'originalName' | 'newName' | 'group';
type SortOrder = 'asc' | 'desc';

interface SortState {
  field: SortField;
  order: SortOrder;
}

interface ImageStore {
  // Image data
  images: Image[];
  selectedImage: Image | null;
  
  // UI state
  filter: FilterOption;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  
  // Selection state
  selection: SelectionState;
  
  // File upload drag state
  dragState: DragState;
  
  // Sidebar state
  sidebarOpen: boolean;
  
  // Sorting state
  sort: SortState;
  
  // Actions
  setImages: (images: Image[]) => void;
  addImages: (images: Image[]) => void;
  updateImage: (id: string, updates: Partial<Image>) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  
  // Selection actions
  selectImage: (image: Image | null) => void;
  toggleImageSelection: (id: string, multiSelect?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // Filter and search actions
  setFilter: (filter: FilterOption) => void;
  setSearchQuery: (query: string) => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // File upload drag actions
  setDragState: (state: Partial<DragState>) => void;
  resetDragState: () => void;
  
  // Sidebar actions
  setSidebarOpen: (open: boolean) => void;
  
  // Sorting actions
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleSort: (field: SortField) => void;
  
  // Computed getters
  getFilteredImages: () => Image[];
  getSelectedImages: () => Image[];
  
  // New actions
  setSelectedImage: (image: Image | null) => void;
  refreshImages: () => Promise<void>;
  
  // Clear all data immediately
  clearAll: () => void;
  
  // SSE connection management
  connectToUpdates: () => void;
  disconnectFromUpdates: () => void;
}

const initialDragState: DragState = {
  isDragging: false,
  draggedOver: false,
  files: [],
};



const initialSelection: SelectionState = {
  selectedIds: new Set(),
  lastSelectedId: null,
};

const initialSort: SortState = {
  field: 'timestamp',
  order: 'asc', // Default: oldest to newest
};

export const useImageStore = create<ImageStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      images: [],
      selectedImage: null,
      filter: 'all',
      searchQuery: '',
      isLoading: false,
      error: null,
      selection: initialSelection,
      dragState: initialDragState,
      sidebarOpen: true, // Always open as per requirements
      sort: initialSort,
      
      // Image actions
      setImages: (images) => set({ images }),
      
      addImages: (newImages) => set((state) => ({
        images: [...state.images, ...newImages]
      })),
      
      updateImage: (id, updates) => set((state) => ({
        images: state.images.map(img => 
          img.id === id ? { ...img, ...updates } : img
        ),
        selectedImage: state.selectedImage?.id === id 
          ? { ...state.selectedImage, ...updates }
          : state.selectedImage
      })),
      
      removeImage: (id) => set((state) => ({
        images: state.images.filter(img => img.id !== id),
        selectedImage: state.selectedImage?.id === id ? null : state.selectedImage,
        selection: {
          ...state.selection,
          selectedIds: new Set([...state.selection.selectedIds].filter(selectedId => selectedId !== id))
        }
      })),
      
      clearImages: () => set({
        images: [],
        selectedImage: null,
        selection: initialSelection
      }),
      
      // Selection actions
      selectImage: (image) => set({ selectedImage: image }),
      
      toggleImageSelection: (id, multiSelect = false) => set((state) => {
        const newSelectedIds = new Set(state.selection.selectedIds);
        
        if (multiSelect) {
          // Multi-select mode (Ctrl/Cmd + click)
          if (newSelectedIds.has(id)) {
            newSelectedIds.delete(id);
          } else {
            newSelectedIds.add(id);
          }
        } else {
          // Single select mode
          if (newSelectedIds.has(id) && newSelectedIds.size === 1) {
            // If only this item is selected, deselect it
            newSelectedIds.clear();
          } else {
            // Select only this item
            newSelectedIds.clear();
            newSelectedIds.add(id);
          }
        }
        
        return {
          selection: {
            selectedIds: newSelectedIds,
            lastSelectedId: id
          }
        };
      }),
      
      selectAll: () => set((state) => ({
        selection: {
          selectedIds: new Set(state.images.map(img => img.id)),
          lastSelectedId: state.selection.lastSelectedId
        }
      })),
      
      clearSelection: () => set({
        selection: initialSelection
      }),
      
      // Filter and search actions
      setFilter: (filter) => set({ filter }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      
      // UI actions
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      // File upload drag actions
      setDragState: (updates) => set((state) => ({
        dragState: { ...state.dragState, ...updates }
      })),
      
      resetDragState: () => set({ dragState: initialDragState }),
      

      
      // Sidebar actions
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      
      // Sorting actions
      setSortField: (field) => set((state) => ({ sort: { ...state.sort, field } })),
      setSortOrder: (order) => set((state) => ({ sort: { ...state.sort, order } })),
      toggleSort: (field) => set((state) => {
        if (state.sort.field === field) {
          // Same field, toggle order
          return { sort: { field, order: state.sort.order === 'asc' ? 'desc' : 'asc' } };
        } else {
          // Different field, default to asc
          return { sort: { field, order: 'asc' } };
        }
      }),
      
      // Computed getters
      getFilteredImages: () => {
        const { images, filter, searchQuery, sort } = get();
        
        let filtered = images;
        
        // Apply filter
        if (filter === 'unknown') {
          filtered = filtered.filter(img => 
            img.geminiStatus !== 'complete' && img.groupingStatus !== 'complete'
          );
        } else if (filter === 'conflict') {
          filtered = filtered.filter(img => 
            img.geminiStatus === 'error' || img.paletteStatus === 'error'
          );
        }
        
        // Apply search
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          filtered = filtered.filter(img => 
            img.originalName.toLowerCase().includes(query) ||
            img.newName?.toLowerCase().includes(query) ||
            img.code?.toLowerCase().includes(query) ||
            img.group?.toLowerCase().includes(query)
          );
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
          let aValue: any;
          let bValue: any;
          
          switch (sort.field) {
            case 'timestamp':
              aValue = new Date(a.timestamp).getTime();
              bValue = new Date(b.timestamp).getTime();
              break;
            case 'originalName':
              aValue = a.originalName.toLowerCase();
              bValue = b.originalName.toLowerCase();
              break;
            case 'newName':
              aValue = (a.newName || '').toLowerCase();
              bValue = (b.newName || '').toLowerCase();
              break;
            case 'group':
              aValue = (a.group || '').toLowerCase();
              bValue = (b.group || '').toLowerCase();
              break;
            default:
              return 0;
          }
          
          if (aValue < bValue) return sort.order === 'asc' ? -1 : 1;
          if (aValue > bValue) return sort.order === 'asc' ? 1 : -1;
          return 0;
        });
        
        return filtered;
      },
      
      getSelectedImages: () => {
        const { images, selection } = get();
        return images.filter(img => selection.selectedIds.has(img.id));
      },
      
      // New actions
      setSelectedImage: (image) => set({ selectedImage: image }),
      
      refreshImages: async () => {
        try {
          const response = await getImages({ limit: 1000 }); // Get all images
          set({ images: response.images });
          
          // Update selected image if it exists
          const { selectedImage } = get();
          if (selectedImage) {
            const updatedSelectedImage = response.images.find(img => img.id === selectedImage.id);
            if (updatedSelectedImage) {
              set({ selectedImage: updatedSelectedImage });
            } else {
              // Selected image no longer exists, clear it
              set({ selectedImage: null });
            }
          }
        } catch (error) {
          console.error('Failed to refresh images:', error);
        }
      },
      
      // Clear all data immediately
      clearAll: () => {
        set({ 
          images: [], 
          selectedImage: null,
          selection: { selectedIds: new Set(), lastSelectedId: null },
          dragState: { isDragging: false, draggedOver: false, files: [] }
        });
      },
      
      // SSE connection management
      connectToUpdates: () => {
        if (eventSource) {
          eventSource.close();
        }
        
        console.log('🔌 Connecting to palette progress stream...');
        eventSource = new EventSource('/api/upload/palette-progress');
        
        eventSource.onopen = () => {
          console.log('✅ Connected to palette progress stream');
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📡 Received update:', data);
            
            if (data.type === 'palette_update' && data.imageId && data.updates) {
              // Update the specific image with the new data
              get().updateImage(data.imageId, data.updates);
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          // Don't automatically reconnect to avoid infinite loops
        };
      },
      
      disconnectFromUpdates: () => {
        if (eventSource) {
          console.log('🔌 Disconnecting from palette progress stream');
          eventSource.close();
          eventSource = null;
        }
      },
    }),
    {
      name: 'image-store',
    }
  )
); 
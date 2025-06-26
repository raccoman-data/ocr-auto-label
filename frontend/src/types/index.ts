// Image data structure matching the Prisma schema
export interface Image {
  id: string;
  originalName: string;
  newName?: string;
  filePath: string;
  thumbnailPath?: string;
  fileSize: number;
  timestamp: Date;
  group?: string;
  
  // Processing status
  geminiStatus: 'pending' | 'processing' | 'complete' | 'error';
  groupingStatus: 'pending' | 'processing' | 'complete' | 'error';
  
  // Overall comprehensive status
  status: 'pending' | 'extracting' | 'extracted' | 'invalid_group' | 'pending_grouping' | 'grouping' | 'auto_grouped' | 'ungrouped' | 'user_grouped';
  
  // Extracted data
  code?: string;
  otherText?: string;
  objectDesc?: string;
  objectColors?: Array<{color: string, name: string}>;
  
  // Confidence scores
  geminiConfidence?: number;
  groupingConfidence?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// Processing status enum
export type ProcessingStatus = 'pending' | 'processing' | 'complete' | 'error';



// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Upload response
export interface UploadResponse {
  message: string;
  images: Array<{
    id: string;
    originalName: string;
    thumbnailUrl: string;
    fileSize: number;
    timestamp: string;
    paletteStatus: string;
    paletteConfidence?: number;
  }>;
}

// Filter options for the table - summary views only
export type FilterOption = 'all' | 'complete' | 'pending' | 'needs_attention';

// Table column definitions
export interface TableColumn {
  key: string;
  label: string;
  width?: number;
  sortable?: boolean;
  resizable?: boolean;
}

// Selection state for table rows
export interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

// Bulk update payload
export interface BulkUpdatePayload {
  updates: {
    id: string;
    newName?: string;
    group?: string;
  }[];
}

// File upload with metadata
export interface FileWithMetadata extends File {
  relativePath?: string;
}

// File drag and drop state for upload area
export interface DragState {
  isDragging: boolean;
  draggedOver: boolean;
  files: FileWithMetadata[];
}

// Sidebar image details
export interface ImageDetails extends Image {
  fullImageUrl?: string;
}

// Processing queue item
export interface QueueItem {
  id: string;
  type: 'palette' | 'gemini' | 'grouping';
  status: ProcessingStatus;
  progress?: number;
  error?: string;
} 
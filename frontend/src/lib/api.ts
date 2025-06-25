import { Image, UploadResponse, BulkUpdatePayload, FileWithMetadata } from '@/types';

const API_BASE_URL = '/api';

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Upload files to the backend
export async function uploadFiles(
  files: File[]
): Promise<UploadResponse> {
  const formData = new FormData();
  
  // Add files to form data
  files.forEach(file => {
    formData.append('files', file);
  });
  
  // Add original timestamps to preserve file dates
  const originalTimestamps = files.map(file => file.lastModified);
  formData.append('originalTimestamps', JSON.stringify(originalTimestamps));

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status: ${response.status}`);
  }

  return response.json();
}

// Get all images with pagination and filtering
export async function getImages(params: {
  page?: number;
  limit?: number;
  filter?: 'all' | 'unknown' | 'conflict';
  search?: string;
} = {}): Promise<{ images: Image[]; pagination: any }> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.filter) searchParams.set('filter', params.filter);
  if (params.search) searchParams.set('search', params.search);

  const response = await apiRequest<{ images: any[]; pagination: any }>(`/images?${searchParams}`);
  
  return {
    ...response,
    images: response.images.map(transformImageData)
  };
}

// Get single image by ID
export async function getImage(id: string): Promise<Image> {
  return apiRequest<Image>(`/images/${id}`);
}

// Update single image
export async function updateImage(
  id: string,
  updates: { newName?: string; group?: string }
): Promise<Image> {
  return apiRequest<Image>(`/images/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// Bulk update images
export async function bulkUpdateImages(
  payload: BulkUpdatePayload
): Promise<{ message: string; images: Image[] }> {
  return apiRequest<{ message: string; images: Image[] }>('/images/bulk', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Delete single image
export async function deleteImage(id: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/images/${id}`, {
    method: 'DELETE',
  });
}

// Delete all images
export async function deleteAllImages(): Promise<{ message: string; count: number }> {
  return apiRequest<{ message: string; count: number }>('/images', {
    method: 'DELETE',
  });
}

// Manual cleanup - clear all data and files
export async function cleanupAllData(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/upload/cleanup', {
    method: 'POST',
  });
}

// Health check
export async function healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
  return apiRequest<{ status: string; timestamp: string; version: string }>('/health');
}

// Process color palettes for uploaded images
export async function processPalettes(): Promise<{ message: string; processedCount: number }> {
  return apiRequest<{ message: string; processedCount: number }>('/upload/process-palettes', {
    method: 'POST',
  });
}

// Transform API response to match our Image interface
function transformImageData(apiImage: any): Image {
  // Parse palette if it exists and is a string
  let palette = null;
  if (apiImage.palette) {
    try {
      palette = typeof apiImage.palette === 'string' 
        ? JSON.parse(apiImage.palette) 
        : apiImage.palette;
    } catch (error) {
      console.warn('Failed to parse palette data:', error);
      palette = null;
    }
  }

  return {
    ...apiImage,
    timestamp: new Date(apiImage.timestamp),
    createdAt: new Date(apiImage.createdAt),
    updatedAt: new Date(apiImage.updatedAt),
    palette,
    // Map backend fields to frontend interface
    filename: apiImage.filePath ? apiImage.filePath.split('/').pop() : '',
    size: apiImage.fileSize,
    mimeType: 'image/jpeg', // Default since we don't store this in new schema
    status: 'uploaded', // Default status
    geminiResponse: apiImage.code || apiImage.otherText || apiImage.objectDesc || null,
  };
} 
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

// Upload a ZIP file and extract images
export async function uploadZipFile(
  zipFile: File
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', zipFile);

  const response = await fetch(`${API_BASE_URL}/upload/zip`, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `ZIP upload failed with status: ${response.status}`);
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



// Transform API response to match our Image interface
function transformImageData(apiImage: any): Image {
  // Parse object colors if it exists and is a string
  let objectColors = null;
  if (apiImage.objectColors) {
    try {
      objectColors = typeof apiImage.objectColors === 'string' 
        ? JSON.parse(apiImage.objectColors) 
        : apiImage.objectColors;
    } catch (error) {
      console.warn('Failed to parse object colors data:', error);
      objectColors = null;
    }
  }

  return {
    ...apiImage,
    timestamp: new Date(apiImage.timestamp),
    createdAt: new Date(apiImage.createdAt),
    updatedAt: new Date(apiImage.updatedAt),
    objectColors,
    // Use the comprehensive status from the backend
    status: apiImage.status || 'pending',
    // Map backend fields to frontend interface
    filename: apiImage.filePath ? apiImage.filePath.split('/').pop() : '',
    size: apiImage.fileSize,
    mimeType: 'image/jpeg', // Default since we don't store this in new schema
    geminiResponse: apiImage.code || apiImage.otherText || apiImage.objectDesc || null,
  };
} 
import { useEffect, useRef } from 'react';
import { useImageStore } from '@/stores/imageStore';

export function usePaletteUpdates() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { updateImage } = useImageStore();

  useEffect(() => {
    // Connect to SSE endpoint
    const eventSource = new EventSource('/api/upload/palette-progress');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('🔗 Connected to palette progress stream');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'palette_update') {
          console.log(`🎨 Real-time update for image ${data.imageId}:`, data.updates);
          
          // Parse palette if it exists
          let updates = { ...data.updates };
          if (updates.palette && typeof updates.palette === 'string') {
            try {
              updates.palette = JSON.parse(updates.palette);
            } catch (e) {
              console.warn('Failed to parse palette data:', e);
            }
          }
          
          // Update the specific image in the store
          updateImage(data.imageId, updates);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log('🔌 Disconnecting from palette progress stream');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [updateImage]);

  return {
    disconnect: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  };
} 
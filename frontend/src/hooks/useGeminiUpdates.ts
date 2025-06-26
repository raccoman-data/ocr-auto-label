import { useEffect, useRef, useCallback } from 'react';
import { useImageStore } from '@/stores/imageStore';

export function useGeminiUpdates() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const { updateImage, refreshImages } = useImageStore();

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000; // 2 seconds

  const connectToSSE = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    console.log('🔗 Connecting to processing progress stream...');
    
    // Connect to SSE endpoint for all processing updates
    const eventSource = new EventSource('/api/upload/progress');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ Connected to processing progress stream');
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      
      // IMMEDIATE STATUS SYNC: Refresh images to catch any updates that happened 
      // before SSE connection was established
      console.log('🔄 Syncing current status after SSE connection...');
      refreshImages().catch(err => 
        console.warn('Failed to sync status after SSE connection:', err)
      );
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 SSE Message received:', data);
        
        if (data.type === 'connected') {
          console.log('🎯 SSE connection confirmed by server');
          return;
        }
        
        if (data.type === 'gemini_update') {
          console.log(`🧠 Gemini update for image ${data.imageId}:`, data.updates);
          
          // Parse objectColors if it exists
          let updates = { ...data.updates };
          if (updates.objectColors && typeof updates.objectColors === 'string') {
            try {
              updates.objectColors = JSON.parse(updates.objectColors);
            } catch (e) {
              console.warn('Failed to parse object colors data:', e);
            }
          }
          
          // Update the specific image in the store
          updateImage(data.imageId, updates);
        }
      } catch (error) {
        console.error('❌ Failed to parse SSE message:', error, 'Raw data:', event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      console.log(`SSE ReadyState: ${eventSource.readyState}`); // 0=CONNECTING, 1=OPEN, 2=CLOSED
      
      // Only attempt to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`🔄 Attempting reconnect ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectToSSE();
        }, RECONNECT_DELAY);
      } else {
        console.error('🚫 Max reconnection attempts reached. SSE connection failed permanently.');
        // Fall back to periodic polling as last resort
        console.log('🔄 Falling back to periodic status polling...');
        startFallbackPolling();
      }
    };
  }, [updateImage, refreshImages]);

  // Fallback polling mechanism if SSE fails completely
  const startFallbackPolling = useCallback(() => {
    const pollInterval = setInterval(async () => {
      try {
        const { images } = useImageStore.getState();
        const hasActiveProcessing = images.some(img => 
          img.status === 'pending' || 
          img.status === 'extracting' || 
          img.status === 'grouping'
        );
        
        if (hasActiveProcessing) {
          console.log('🔄 Fallback: Polling for status updates...');
          await refreshImages();
        } else {
          // Stop polling if no active processing
          clearInterval(pollInterval);
          console.log('✅ Fallback polling stopped - no active processing');
        }
      } catch (error) {
        console.error('❌ Fallback polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes max
    setTimeout(() => {
      clearInterval(pollInterval);
      console.log('⏰ Fallback polling timeout - stopped after 5 minutes');
    }, 5 * 60 * 1000);
  }, [refreshImages]);

  useEffect(() => {
    // Initial connection
    connectToSSE();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (eventSourceRef.current) {
        console.log('🔌 Disconnecting from processing progress stream');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connectToSSE]);

  return {
    disconnect: () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    },
    
    reconnect: () => {
      reconnectAttemptsRef.current = 0; // Reset attempts counter
      connectToSSE();
    }
  };
} 
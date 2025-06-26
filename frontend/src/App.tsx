import React, { useEffect } from 'react';
import { UploadArea } from '@/components/Upload/UploadArea';
import { Toolbar } from '@/components/Toolbar';
import { ImageTable } from '@/components/ImageTable/ImageTable';
import { Sidebar } from '@/components/Sidebar';
import { KeyboardShortcutsPanel } from '@/components/KeyboardShortcuts';
import { HowItWorks } from '@/components/HowItWorks';
import { useImageStore } from '@/stores/imageStore';
import { usePaletteUpdates } from '@/hooks/usePaletteUpdates';
import { Image } from '@/types';

function App() {
  const { images, selectedImage, selectImage, getFilteredImages, refreshImages, setLoading, isLoading } = useImageStore();
  
  // Enable real-time palette updates
  usePaletteUpdates();
  
  // Load existing images on app startup
  useEffect(() => {
    const loadExistingImages = async () => {
      setLoading(true);
      try {
        await refreshImages();
        console.log('✅ Loaded existing images from database');
      } catch (error) {
        console.error('❌ Failed to load existing images:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExistingImages();
  }, []); // Empty dependency array - run only once on mount
  
  // Get filtered images based on current filter/search
  const filteredImages = getFilteredImages();

  const handleImageSelect = (image: Image) => {
    selectImage(image);
  };

  // Show loading state while fetching existing data
  if (isLoading && images.length === 0) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto">
            <svg className="animate-spin w-16 h-16 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground mb-1">Loading your images...</h3>
            <p className="text-sm text-muted-foreground">
              Checking for existing data from previous sessions
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen text-foreground flex flex-col">
      {/* Upload Area - shown when no images */}
      {images.length === 0 && (
        <div 
          className="flex-1 flex flex-col items-center justify-center p-8 pt-16 relative"
          style={{
            backgroundImage: `
              linear-gradient(rgba(148, 163, 184, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148, 163, 184, 0.04) 1px, transparent 1px),
              linear-gradient(to bottom, #ffffff 0%, #f8fafc 30%, #f1f5f9 60%, #e2e8f0 100%)
            `,
            backgroundSize: '28px 28px, 28px 28px, 100% 100%'
          }}
        >
          {/* How It Works section - above upload area */}
          <div className="w-full max-w-4xl mb-12">
            <HowItWorks />
          </div>
          
          <div className="w-full max-w-4xl">
            <UploadArea />
          </div>
          
          {/* Keyboard Shortcuts panel */}
          <div className="mt-12 w-full max-w-4xl">
            <KeyboardShortcutsPanel />
          </div>
        </div>
      )}

      {/* Main Interface - shown when images exist */}
      {images.length > 0 && (
        <>
          {/* Toolbar spans full width */}
          <div className="h-16 border-b border-border">
            <Toolbar />
          </div>

          {/* Content area with table and sidebar */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Table takes remaining space with explicit height */}
            <div className="flex-1 min-w-0 flex flex-col">
              <ImageTable 
                images={filteredImages}
                selectedImageId={selectedImage?.id || null}
                onImageSelect={handleImageSelect}
              />
            </div>
            
            {/* Sidebar - fixed width, starts below toolbar */}
            <div className="w-[28rem] border-l border-border bg-card">
              <Sidebar />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App; 
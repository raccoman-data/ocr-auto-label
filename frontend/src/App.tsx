import React from 'react';
import { UploadArea } from '@/components/Upload/UploadArea';
import { Toolbar } from '@/components/Toolbar';
import { ImageTable } from '@/components/ImageTable/ImageTable';
import { Sidebar } from '@/components/Sidebar';
import { useImageStore } from '@/stores/imageStore';
import { usePaletteUpdates } from '@/hooks/usePaletteUpdates';
import { Image } from '@/types';

function App() {
  const { images, selectedImage, selectImage, getFilteredImages } = useImageStore();
  
  // Enable real-time palette updates
  usePaletteUpdates();
  
  // Get filtered images based on current filter/search
  const filteredImages = getFilteredImages();

  const handleImageSelect = (image: Image) => {
    selectImage(image);
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      {/* Upload Area - shown when no images */}
      {images.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <UploadArea />
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
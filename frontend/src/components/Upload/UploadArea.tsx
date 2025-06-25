import React, { useCallback, useState, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useImageStore } from '@/stores/imageStore';
import { uploadFiles, processPalettes } from '@/lib/api';

export function UploadArea() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingPalettes, setIsProcessingPalettes] = useState(false);
  const { refreshImages } = useImageStore();
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadStart, setUploadStart] = useState<number | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState(0);

  // No SSE setup here; global hook handles it

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setTotalFiles(files.length);
    setUploadStart(Date.now());
    // assume 20 files/sec => duration estimate
    const est = Math.ceil(files.length / 20);
    setEstimatedSeconds(est);
    try {
      console.log(`📤 Uploading ${files.length} files...`);
      
      // Step 1: Upload files (fast)
      await uploadFiles(files);
      console.log('✅ Upload complete');
      
      // Step 2: Refresh to show uploaded files
      await refreshImages();
      
      // Step 3: Start palette processing (non-blocking)
      setIsUploading(false);
      setIsProcessingPalettes(true);
      
      console.log('🎨 Starting palette processing...');
      
      // Start palette processing but don't wait for it
      // The SSE connection will handle real-time updates
      processPalettes()
        .then(() => {
          console.log('✅ Palette processing complete');
          setIsProcessingPalettes(false);
        })
        .catch((error) => {
          console.error('Error during palette processing:', error);
          setIsProcessingPalettes(false);
        });
      
    } catch (error) {
      console.error('Error during upload/processing:', error);
      alert('Failed to upload or process files. Please try again.');
      setIsUploading(false);
      setIsProcessingPalettes(false);
    }
  }, [refreshImages]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    // Clear the input so the same files can be selected again
    e.target.value = '';
  }, [handleFiles]);

  const isProcessing = isUploading || isProcessingPalettes;

  // Update countdown every second while uploading
  useEffect(() => {
    if (!isUploading || !uploadStart) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - uploadStart) / 1000);
      const remaining = Math.max(0, estimatedSeconds - elapsed);
      setEstimatedSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isUploading, uploadStart]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragOver 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
          }
          ${isProcessing ? 'pointer-events-none' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => {
          if (!isProcessing) {
            document.getElementById('file-upload')?.click();
          }
        }}
      >
        <input
          id="file-upload"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isProcessing}
        />
        
        <div className="space-y-6">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative">
            {isProcessing ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <Upload className="w-10 h-10 text-primary" />
            )}
            
            {/* Pulse ring animation when processing */}
            {isProcessing && (
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            )}
          </div>
          
          {/* Main Content */}
          {isUploading ? (
            <>
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  Uploading Files...
                </h3>
                <p className="text-muted-foreground">
                  Saving files and creating thumbnails
                </p>
                <p className="text-sm text-primary">
                  Est. {estimatedSeconds}s remaining
                </p>
              </div>
            </>
          ) : isProcessingPalettes ? (
            <>
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  Processing Color Palettes...
                </h3>
                <p className="text-muted-foreground">
                  Extracting dominant colors from each image (real-time updates)
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  Drop images here or click to browse
                </h3>
                <p className="text-muted-foreground text-lg">
                  Supports JPEG, PNG, and HEIC formats
                </p>
              </div>
              
              {/* Feature highlights */}
              <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span>Auto-extract color palettes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span>Detect sample codes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span>Group similar images</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 
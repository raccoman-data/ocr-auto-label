import React, { useCallback, useState, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useImageStore } from '@/stores/imageStore';
import { uploadFiles, uploadZipFile } from '@/lib/api';
import { HowItWorks } from '@/components/HowItWorks';

export function UploadArea() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { refreshImages } = useImageStore();
  const [totalFiles, setTotalFiles] = useState(0);
  const [uploadStart, setUploadStart] = useState<number | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState(0);
  const [isExtractingZip, setIsExtractingZip] = useState(false);

  // No SSE setup here; global hook handles it

  // Helper function to check if a file is a ZIP file
  const isZipFile = (file: File): boolean => {
    return file.type === 'application/zip' || 
           file.type === 'application/x-zip-compressed' ||
           file.name.toLowerCase().endsWith('.zip');
  };

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Check if there's a single ZIP file
    const zipFiles = files.filter(isZipFile);
    const imageFiles = files.filter(file => !isZipFile(file));

    if (zipFiles.length === 1 && imageFiles.length === 0) {
      // Handle single ZIP file
      await handleZipFile(zipFiles[0]);
      return;
    } else if (zipFiles.length > 0) {
      // Mixed files - show error
      alert('Please upload either ZIP files individually or image files together, but not both at the same time.');
      return;
    }

    // Handle regular image files
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
      
      // All processing is done in the background via Gemini
      setIsUploading(false);
      
    } catch (error) {
      console.error('Error during upload/processing:', error);
      alert('Failed to upload or process files. Please try again.');
      setIsUploading(false);
    }
  }, [refreshImages]);

  const handleZipFile = useCallback(async (zipFile: File) => {
    setIsUploading(true);
    setIsExtractingZip(true);
    setTotalFiles(1);
    setUploadStart(Date.now());
    
    // Estimate extraction time based on file size (roughly 1MB per second)
    const est = Math.max(5, Math.ceil(zipFile.size / (1024 * 1024)));
    setEstimatedSeconds(est);

    try {
      console.log(`📦 Uploading and extracting ZIP file: ${zipFile.name} (${zipFile.size} bytes)`);
      
      // Step 1: Upload and extract ZIP file
      const result = await uploadZipFile(zipFile);
      console.log(`✅ ZIP extraction complete: ${result.images.length} images extracted`);
      
      // Step 2: Refresh to show extracted files
      await refreshImages();
      
      // All processing is done in the background via Gemini
      setIsUploading(false);
      setIsExtractingZip(false);
      
    } catch (error) {
      console.error('Error during ZIP processing:', error);
      let errorMessage = 'Failed to process ZIP file. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      alert(errorMessage);
      setIsUploading(false);
      setIsExtractingZip(false);

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

  const isProcessing = isUploading;

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
          transition-all duration-300 ease-in-out transform
          ${isDragOver 
            ? 'border-primary bg-primary/5 scale-[1.02] shadow-xl shadow-primary/10' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30 hover:scale-[1.01] hover:shadow-lg hover:shadow-slate-200/50'
          }
          ${isProcessing ? 'pointer-events-none' : ''}
          bg-white/20 backdrop-blur-sm
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
          accept="image/*,.zip"
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
                  {isExtractingZip ? 'Extracting ZIP Archive...' : 'Uploading Files...'}
                </h3>
                <p className="text-muted-foreground">
                  {isExtractingZip 
                    ? 'Extracting images from ZIP file and creating thumbnails'
                    : 'Saving files and creating thumbnails'
                  }
                </p>
                <p className="text-sm text-primary">
                  Est. {estimatedSeconds}s remaining
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  Drop images or ZIP files here, or click to browse
                </h3>
                <p className="text-muted-foreground text-lg">
                  Supports JPEG, PNG, HEIC formats and ZIP archives
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 
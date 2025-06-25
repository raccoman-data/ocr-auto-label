import yauzl, { ZipFile, Entry } from 'yauzl';
import { Readable } from 'stream';
import path from 'path';
import mime from 'mime-types';

// Interface for extracted file information
export interface ExtractedFile {
  filename: string;
  buffer: Buffer;
  lastModified: Date;
  relativePath: string;
}

// Supported image file extensions
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];

/**
 * Check if a file is a supported image format
 */
function isSupportedImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Extract image files from a zip buffer
 * Returns array of extracted files with their metadata
 */
export async function extractImagesFromZip(zipBuffer: Buffer): Promise<ExtractedFile[]> {
  return new Promise((resolve, reject) => {
    const extractedFiles: ExtractedFile[] = [];
    
    // Open the zip from buffer
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err: Error | null, zipfile?: ZipFile) => {
      if (err) {
        reject(new Error(`Failed to open zip file: ${err.message}`));
        return;
      }

      if (!zipfile) {
        reject(new Error('Failed to create zipfile instance'));
        return;
      }

      let processedEntries = 0;
      let totalEntries = zipfile.entryCount;

      // Handle zip file completion
      zipfile.on('end', () => {
        console.log(`📦 Zip extraction complete: ${extractedFiles.length} images extracted from ${totalEntries} total entries`);
        resolve(extractedFiles);
      });

      // Handle errors during zip processing
      zipfile.on('error', (zipErr: Error) => {
        reject(new Error(`Zip processing error: ${zipErr.message}`));
      });

      // Process each entry in the zip
      zipfile.on('entry', (entry: Entry) => {
        processedEntries++;
        
        // Skip directories and non-image files
        if (entry.fileName.endsWith('/') || !isSupportedImageFile(entry.fileName)) {
          console.log(`⏭️  Skipping non-image file: ${entry.fileName}`);
          zipfile.readEntry(); // Continue to next entry
          return;
        }

        // Skip macOS metadata files and other system files
        const baseName = path.basename(entry.fileName);
        if (baseName.startsWith('.') || baseName.startsWith('__MACOSX')) {
          console.log(`⏭️  Skipping system file: ${entry.fileName}`);
          zipfile.readEntry(); // Continue to next entry
          return;
        }

        console.log(`📸 Extracting image: ${entry.fileName} (${entry.uncompressedSize} bytes)`);

        // Open the entry for reading
        zipfile.openReadStream(entry, (streamErr: Error | null, readStream?: Readable) => {
          if (streamErr) {
            console.error(`Failed to read entry ${entry.fileName}:`, streamErr);
            zipfile.readEntry(); // Continue to next entry
            return;
          }

          if (!readStream) {
            console.error(`No read stream for entry ${entry.fileName}`);
            zipfile.readEntry(); // Continue to next entry
            return;
          }

          // Collect the file data
          const chunks: Buffer[] = [];
          
          readStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          readStream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            
            // Extract the file with metadata
            const extractedFile: ExtractedFile = {
              filename: path.basename(entry.fileName),
              buffer: buffer,
              lastModified: entry.getLastModDate(),
              relativePath: entry.fileName
            };

            extractedFiles.push(extractedFile);
            console.log(`✅ Successfully extracted: ${entry.fileName}`);

            // Continue to next entry
            zipfile.readEntry();
          });

          readStream.on('error', (readErr: Error) => {
            console.error(`Error reading stream for ${entry.fileName}:`, readErr);
            zipfile.readEntry(); // Continue to next entry
          });
        });
      });

      // Start reading entries
      zipfile.readEntry();
    });
  });
}

/**
 * Validate that the uploaded file is actually a zip file
 */
export function isValidZipFile(buffer: Buffer): boolean {
  // Check for ZIP file signature (PK)
  if (buffer.length < 4) return false;
  
  // ZIP files start with "PK" (0x504B)
  return buffer[0] === 0x50 && buffer[1] === 0x4B;
}

/**
 * Get estimated extraction time based on zip file size
 */
export function getExtractionEstimate(zipSizeBytes: number): number {
  // Rough estimate: 1MB per second for extraction + processing
  const estimatedSeconds = Math.ceil(zipSizeBytes / (1024 * 1024));
  return Math.max(5, estimatedSeconds); // Minimum 5 seconds
} 
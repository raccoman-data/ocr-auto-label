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
  // Rough estimate: 50MB per second for extraction + processing on modern SSDs
  const estimatedSeconds = Math.ceil(zipSizeBytes / (50 * 1024 * 1024));
  return Math.max(2, estimatedSeconds); // Minimum 2 seconds
}

/**
 * Stream-extract images from a zip **file on disk**.
 *
 * This variant avoids loading the entire archive into memory. Instead, each
 * extracted image is passed to the supplied `onFile` callback immediately.
 * The callback is awaited so you can perform async side-effects (e.g. write
 * to DB / filesystem) back-pressure-friendly. Returns the total number of
 * images extracted.
 */
export async function extractImagesFromZipFile(
  zipFilePath: string,
  onFile: (file: ExtractedFile) => Promise<void>
): Promise<number> {
  return new Promise((resolve, reject) => {
    let imagesExtracted = 0;

    // Open the zip from a **file path** instead of a buffer
    yauzl.open(zipFilePath, { lazyEntries: true }, (err: Error | null, zipfile?: ZipFile) => {
      if (err) {
        return reject(new Error(`Failed to open zip file: ${err.message}`));
      }

      if (!zipfile) {
        return reject(new Error('Failed to create zipfile instance'));
      }

      const totalEntries = zipfile.entryCount;
      console.log(`📂 ZIP contains ${totalEntries} entries – starting streamed extraction…`);

      zipfile.on('error', (zipErr: Error) => {
        reject(new Error(`Zip processing error: ${zipErr.message}`));
      });

      zipfile.on('end', () => {
        console.log(`📦 Streamed extraction complete – ${imagesExtracted} images processed`);
        resolve(imagesExtracted);
      });

      // Process each entry on demand
      zipfile.on('entry', (entry: Entry) => {
        // Skip directories and unwanted files
        if (entry.fileName.endsWith('/') || !isSupportedImageFile(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        const baseName = path.basename(entry.fileName);
        if (baseName.startsWith('.') || baseName.startsWith('__MACOSX')) {
          zipfile.readEntry();
          return;
        }

        // Open stream for the file entry
        zipfile.openReadStream(entry, async (streamErr: Error | null, readStream?: Readable) => {
          if (streamErr || !readStream) {
            console.error(`Error opening stream for ${entry.fileName}:`, streamErr);
            zipfile.readEntry();
            return;
          }

          const chunks: Buffer[] = [];
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk));

          readStream.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks);
              const extractedFile: ExtractedFile = {
                filename: path.basename(entry.fileName),
                buffer,
                lastModified: entry.getLastModDate(),
                relativePath: entry.fileName,
              };

              // Let caller handle persistence / further processing
              await onFile(extractedFile);
              imagesExtracted += 1;
            } catch (callbackErr) {
              console.error(`Callback error for ${entry.fileName}:`, callbackErr);
            } finally {
              // Continue regardless of individual file errors
              zipfile.readEntry();
            }
          });

          readStream.on('error', (readErr: Error) => {
            console.error(`Stream error for ${entry.fileName}:`, readErr);
            zipfile.readEntry();
          });
        });
      });

      // Kick things off
      zipfile.readEntry();
    });
  });
} 
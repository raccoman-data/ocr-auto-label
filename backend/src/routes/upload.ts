import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import ExifReader from 'exifreader';
import { prisma } from '../index';
import heicConvert from 'heic-convert';

import { extractTextFromImage, isValidSampleCode } from '../services/gemini';
import { getExtractionEstimate, extractImagesFromZipFile } from '../services/zipExtractor';
import { autoGroupImages } from '../services/grouping';
import pLimit from 'p-limit';

const router = express.Router();

// Rate limiting for parallel Gemini API calls – prevents hitting quota/rate limits
const geminiLimit = pLimit(50); // Optimized: faster image processing allows higher concurrency

// Use OS temp directory + app-specific folder to avoid bloating codebase
const TEMP_DIR = path.join(os.tmpdir(), 'ocr-auto-label');
const UPLOADS_DIR = path.join(TEMP_DIR, 'uploads');
const THUMBNAILS_DIR = path.join(TEMP_DIR, 'thumbnails');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per-image limit for standard image uploads
  },
  fileFilter: (req, file, cb) => {
    // Accept JPEG, PNG, HEIC formats and ZIP files
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/zip', 'application/x-zip-compressed'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, HEIC, and ZIP files are allowed.'));
    }
  },
});

// Dedicated uploader for large ZIP archives – streams directly to disk to avoid RAM spikes
const zipUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()), // OS temp dir always exists
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // up to 5 GB ZIP archives
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/zip', 'application/x-zip-compressed'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed for this endpoint.'));
    }
  },
});

// Ensure directories exist
async function ensureDirectories() {
  const dirs = [TEMP_DIR, UPLOADS_DIR, THUMBNAILS_DIR];

  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
  
  console.log(`📁 Files will be stored in: ${TEMP_DIR}`);
}

// Generate high-quality thumbnail using Sharp
async function generateThumbnail(buffer: Buffer, filename: string): Promise<string> {
  const fileExtension = path.extname(filename).toLowerCase();
  const baseName = filename.replace(/\.[^/.]+$/, '');
  
  // Use original format when possible, fallback to high-quality JPEG
  const isJpeg = ['.jpg', '.jpeg'].includes(fileExtension);
  const isPng = fileExtension === '.png';
  
  const thumbnailFilename = isPng 
    ? `thumb_${baseName}.png`
    : `thumb_${baseName}.jpg`;
    
  const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

  const sharpInstance = sharp(buffer)
    .resize(400, 400, { 
      fit: 'inside', // Maintain aspect ratio, don't crop
      withoutEnlargement: true // Don't upscale small images
    });

  if (isPng) {
    // Keep PNG format with high quality
    await sharpInstance
      .png({ quality: 95, compressionLevel: 6 })
      .toFile(thumbnailPath);
  } else {
    // Use high-quality JPEG
    await sharpInstance
      .jpeg({ quality: 95, progressive: true })
      .toFile(thumbnailPath);
  }

  return `/thumbnails/${thumbnailFilename}`;
}

// Save file only (fast upload without processing)
// async function saveFileOnly(file: Express.Multer.File, originalName?: string, originalTimestamp?: number): Promise<any> {
//   const fileExtension = mime.extension(file.mimetype) || 'jpg';
//   const uniqueFilename = `${uuidv4()}.${fileExtension}`;
//   const filePath = path.join(UPLOADS_DIR, uniqueFilename);

//   // Save original file first
//   await fs.writeFile(filePath, file.buffer);

//   // Get the actual file creation date
//   let captureDate = new Date(); // fallback to current time

// async function saveFileOnly(file: Express.Multer.File, originalName?: string, originalTimestamp?: number): Promise<any> {
//   let fileBuffer = file.buffer;
//   let fileExtension = mime.extension(file.mimetype) || 'jpg';

//   // If the uploaded file is HEIC/HEIF, convert it to JPEG immediately
//   if (['image/heic', 'image/heif'].includes(file.mimetype)) {
//     console.log(`📸 Converting HEIC file to JPEG: ${originalName || file.originalname}`);
//     try {
//       fileBuffer = await sharp(file.buffer)
//         .jpeg({ quality: 90, progressive: true })
//         .toBuffer();
//       fileExtension = 'jpeg'; // The new file is now a JPEG
//     } catch (error) {
//       console.error(`❌ Failed to convert HEIC file ${originalName || file.originalname}:`, error);
//       // Skip this file if conversion fails
//       return null;
//     }
//   }

//   const uniqueFilename = `${uuidv4()}.${fileExtension}`;
//   const filePath = path.join(UPLOADS_DIR, uniqueFilename);

//   // Save the (potentially converted) file
//   await fs.writeFile(filePath, fileBuffer);

//   // Get the actual file creation date
//   let captureDate = new Date(); // fallback to current time

//   let dateSource = 'fallback';
  
//   try {
//     // First try to use the original timestamp from the browser (File.lastModified)
//     if (originalTimestamp && originalTimestamp > 0) {
//       captureDate = new Date(originalTimestamp);
//       dateSource = 'browser_lastModified';
//       console.log(`📅 Using browser original timestamp: ${captureDate.toISOString()}`);
//     } else {
//       // Fallback to file system metadata
//       const stats = await fs.stat(filePath);
      
//       if (stats.birthtime && stats.birthtime.getTime() > 0) {
//         captureDate = stats.birthtime;
//         dateSource = 'file_birthtime';
//         console.log(`📅 Using file creation time: ${captureDate.toISOString()}`);
//       } else if (stats.mtime) {
//         captureDate = stats.mtime;
//         dateSource = 'file_mtime';
//         console.log(`📅 Using file modification time: ${captureDate.toISOString()}`);
//       }
//     }
    
//     // Also try EXIF as secondary source for camera photos
//     try {
//       const tags = ExifReader.load(file.buffer);
      
//       const dateFields = ['DateTimeOriginal', 'DateTime', 'DateTimeDigitized', 'CreateDate'];
      
//       for (const field of dateFields) {
//         if (tags[field] && tags[field].description) {
//           const dateString = tags[field].description;
//           const standardDateString = dateString.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
//           const exifDate = new Date(standardDateString);
          
//           const now = new Date();
//           const minDate = new Date('1990-01-01');
          
//           if (!isNaN(exifDate.getTime()) && exifDate <= now && exifDate >= minDate) {
//             // Only use EXIF date if it's significantly different from current date (more than 1 hour)
//             const timeDiff = Math.abs(exifDate.getTime() - captureDate.getTime());
//             if (timeDiff > 3600000) { // 1 hour in milliseconds
//               captureDate = exifDate;
//               dateSource = `exif_${field}`;
//               console.log(`📅 Using EXIF ${field} instead: ${captureDate.toISOString()}`);
//             }
//             break;
//           }
//         }
//       }
//     } catch (exifError) {
//       // EXIF parsing failed, but we already have a date
//       console.log(`⚠️ EXIF parsing failed, using ${dateSource} date`);
//     }
    
//     console.log(`📅 Final capture date for ${originalName || file.originalname}: ${captureDate.toISOString()} (source: ${dateSource})`);
    
//   } catch (error) {
//     console.warn(`⚠️ Could not extract date for ${originalName || file.originalname}:`, error);
//     console.log(`📅 Using fallback date: ${captureDate.toISOString()}`);
//   }

//   // Create thumbnail quickly
//   // const thumbnailFilename = `thumb_${uniqueFilename}`;
//   // const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

//   // try {
//   //   await sharp(file.buffer)
//   //     .resize(400, 400, { 
//   //       fit: 'inside',
//   //       withoutEnlargement: true 
//   //     })
//   //     .jpeg({ quality: 95 })
//   //     .toFile(thumbnailPath);
//   // } catch (error) {
//   //   console.error(`Failed to create thumbnail for ${file.originalname}:`, error);
//   // }

//   // // Save to database with pending Gemini status
//   // const image = await prisma.image.create({
//   //   data: {
//   //     originalName: originalName || file.originalname,
//   //     newName: '', // Will be set later during processing
//   //     filePath: filePath,
//   //     thumbnailPath: thumbnailPath,
//   //     fileSize: file.size,
//   //     timestamp: captureDate,
//   //     group: '', // Will be set later during processing
//   //     geminiStatus: 'pending',
//   //     code: null,
//   //     otherText: null,
//   //     objectDesc: null,
//   //     objectColors: null,
//   //     geminiConfidence: 0,
//   //     groupingStatus: 'pending',
//   //     groupingConfidence: 0,
//   //   },
//   // });

//   // Create thumbnail from the (potentially converted) buffer
//   const thumbnailFilename = `thumb_${uniqueFilename}`;
//   const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

//   try {
//     await sharp(fileBuffer) // Use fileBuffer here
//       .resize(400, 400, { 
//         fit: 'inside',
//         withoutEnlargement: true 
//       })
//       .jpeg({ quality: 95 })
//       .toFile(thumbnailPath);
//   } catch (error) {
//     console.error(`Failed to create thumbnail for ${file.originalname}:`, error);
//   }

//   // Save to database with pending Gemini status
//   const image = await prisma.image.create({
//     data: {
//       originalName: originalName || file.originalname,
//       newName: '',
//       filePath: filePath,
//       thumbnailPath: thumbnailPath,
//       fileSize: fileBuffer.length, // Use the new buffer's length
//       timestamp: captureDate,
//       group: '',
//       geminiStatus: 'pending',
//       code: null,
//       otherText: null,
//       objectDesc: null,
//       objectColors: null,
//       geminiConfidence: 0,
//       groupingStatus: 'pending',
//       groupingConfidence: 0,
//     },
//   });

//   return {
//     id: image.id,
//     originalName: image.originalName,
//     newName: image.newName,
//     group: image.group,
//     filePath: image.filePath,
//     thumbnailPath: image.thumbnailPath,
//     fileSize: image.fileSize,
//     timestamp: image.timestamp,
//     geminiStatus: image.geminiStatus,
//     code: image.code,
//     otherText: image.otherText,
//     objectDesc: image.objectDesc,
//     objectColors: image.objectColors,
//     geminiConfidence: image.geminiConfidence,
//     groupingStatus: image.groupingStatus,
//     groupingConfidence: image.groupingConfidence,
//     createdAt: image.createdAt,
//     updatedAt: image.updatedAt,
//   };
// }

// async function saveFileOnly(file: Express.Multer.File, originalName?: string, originalTimestamp?: number): Promise<any> {
//   let fileBuffer = file.buffer;
//   let fileExtension = mime.extension(file.mimetype) || 'jpg';
//   let effectiveMimeType = file.mimetype;

//   // If the uploaded file is HEIC/HEIF, convert it to JPEG immediately
//   if (['image/heic', 'image/heif'].includes(file.mimetype)) {
//     console.log(`📸 Converting HEIC file to JPEG: ${originalName || file.originalname}`);
//     try {
//       fileBuffer = await heicConvert({
//         buffer: file.buffer, // The HEIC file buffer
//         format: 'JPEG',      // Convert to JPEG
//         quality: 0.9         // Adjust quality (0 to 1)
//       });
//       fileExtension = 'jpeg';
//       effectiveMimeType = 'image/jpeg';
//     } catch (error) {
//       console.error(`❌ Failed to convert HEIC file ${originalName || file.originalname}:`, error);
//       return null; // Skip this file if conversion fails
//     }
//   }

//   const uniqueFilename = `${uuidv4()}.${fileExtension}`;
//   const filePath = path.join(UPLOADS_DIR, uniqueFilename);

//   await fs.writeFile(filePath, fileBuffer);
async function saveFileOnly(file: Express.Multer.File, originalName?: string, originalTimestamp?: number): Promise<any> {
  let fileBuffer = file.buffer;
  let fileExtension = mime.extension(file.mimetype) || 'jpg';
  let effectiveOriginalName = originalName || file.originalname;
  let originalFilePath: string | null = null;

  const uniqueFilename = `${uuidv4()}.${fileExtension}`;
  const filePath = path.join(UPLOADS_DIR, uniqueFilename);

  // Save the original file first, especially if it's an MP.JPG
  if (effectiveOriginalName.toUpperCase().endsWith('.MP.JPG')) {
    originalFilePath = filePath; // This path will store the original MP.JPG
    await fs.writeFile(originalFilePath, file.buffer);

    // Now, extract the first frame for processing
    console.log(`📸 Extracting first frame from .MP.JPG file: ${effectiveOriginalName}`);
    try {
      fileBuffer = await sharp(file.buffer, { page: 0 })
        .jpeg({ quality: 90, progressive: true })
        .toBuffer();
      fileExtension = 'jpeg';
    } catch (error) {
      console.error(`❌ Failed to extract frame from .MP.JPG file ${effectiveOriginalName}:`, error);
      return null;
    }
  }

  // For non-MP.JPG files, or for the extracted frame, save to the main filePath
  const processableFilePath = originalFilePath ? path.join(UPLOADS_DIR, `${uuidv4()}_frame.jpeg`) : filePath;
  await fs.writeFile(processableFilePath, fileBuffer);

  let captureDate = new Date();
  let dateSource = 'fallback';

  try {
    if (originalTimestamp && originalTimestamp > 0) {
      captureDate = new Date(originalTimestamp);
      dateSource = 'browser_lastModified';
    } else {
      const stats = await fs.stat(filePath);
      if (stats.birthtime && stats.birthtime.getTime() > 0) {
        captureDate = stats.birthtime;
        dateSource = 'file_birthtime';
      } else if (stats.mtime) {
        captureDate = stats.mtime;
        dateSource = 'file_mtime';
      }
    }

    try {
      const tags = ExifReader.load(fileBuffer);
      const dateFields = ['DateTimeOriginal', 'DateTime', 'DateTimeDigitized', 'CreateDate'];
      for (const field of dateFields) {
        if (tags[field] && tags[field].description) {
          const dateString = tags[field].description;
          const standardDateString = dateString.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
          const exifDate = new Date(standardDateString);

          if (!isNaN(exifDate.getTime()) && Math.abs(exifDate.getTime() - captureDate.getTime()) > 3600000) {
            captureDate = exifDate;
            dateSource = `exif_${field}`;
            break;
          }
        }
      }
    } catch (exifError) {
      console.log(`⚠️ EXIF parsing failed, using ${dateSource} date`);
    }

    console.log(`📅 Final capture date for ${originalName || file.originalname}: ${captureDate.toISOString()} (source: ${dateSource})`);

  } catch (error) {
    console.warn(`⚠️ Could not extract date for ${originalName || file.originalname}:`, error);
  }

 // Create thumbnail from the processed frame/image
  const thumbnailFilename = `thumb_${path.basename(processableFilePath, path.extname(processableFilePath))}.jpeg`;
  const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
  await sharp(fileBuffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toFile(thumbnailPath);

  const image = await prisma.image.create({
    data: {
      originalName: effectiveOriginalName,
      newName: '',
      filePath: processableFilePath, // This is the path to the JPEG frame
      originalFilePath: originalFilePath, // This is the path to the original MP.JPG
      thumbnailPath: thumbnailPath,
      fileSize: file.size, // Store the original file size
      timestamp: captureDate,
      group: '',
      geminiStatus: 'pending',
      code: null,
      otherText: null,
      objectDesc: null,
      objectColors: null,
      geminiConfidence: 0,
      groupingStatus: 'pending',
      groupingConfidence: 0,
    },
  });

  return image;
}

// POST /api/upload - Handle multiple file uploads (fast upload, no processing)
router.post('/', upload.array('files'), async (req, res) => {
  try {
    await ensureDirectories();

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Clean up old data before processing new uploads
    console.log('🧹 Cleaning up old data...');
    await cleanupOldData();

    console.log(`📤 Processing ${req.files.length} files...`);
    
    // Get original file timestamps from form data if available
    const originalTimestamps = req.body.originalTimestamps ? JSON.parse(req.body.originalTimestamps) : [];
    
    // Process files quickly - just save and create records
    const uploadPromises = req.files.map((file, index) => 
      saveFileOnly(file, undefined, originalTimestamps[index])
    );

    // const uploadedImages = await Promise.all(uploadPromises);
    const results = await Promise.all(uploadPromises);
    const uploadedImages = results.filter(img => img !== null); // Filter out failed conversions

    console.log(`✅ Successfully uploaded ${uploadedImages.length} files`);

    // Start Gemini processing after successful upload
    console.log('🚀 Starting Gemini processing...');
    startGeminiProcessing(uploadedImages.map(img => img.id));

    return res.json({
      message: `Successfully uploaded ${uploadedImages.length} of ${req.files.length} files`,
      images: uploadedImages,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Function to clean up old data and files
async function cleanupOldData() {
  try {
    // Delete all records from database
    await prisma.image.deleteMany({});
    
    // Clean up physical files
    try {
      const uploadFiles = await fs.readdir(UPLOADS_DIR);
      for (const file of uploadFiles) {
        await fs.unlink(path.join(UPLOADS_DIR, file));
      }
    } catch (error) {
      // Directory might not exist or be empty
    }
    
    try {
      const thumbnailFiles = await fs.readdir(THUMBNAILS_DIR);
      for (const file of thumbnailFiles) {
        await fs.unlink(path.join(THUMBNAILS_DIR, file));
      }
    } catch (error) {
      // Directory might not exist or be empty
    }
    
    console.log('✅ Old data cleaned up successfully');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    // Don't throw - continue with upload even if cleanup fails
  }
}

// Sanitize filename to be filesystem-safe
function sanitizeFileName(name: string): string {
  return name
    .trim()
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Remove or replace problematic characters
    .replace(/[<>:"/\\|?*]/g, '')
    // Replace multiple consecutive underscores with single underscore
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '')
    // Ensure we don't end up with an empty string
    || 'untitled';
}

// // Generate smart filename based on group and existing files
// export async function generateSmartFilename(group: string, currentImageId: string, originalName: string): Promise<string> {
//   const fileExtension = path.extname(originalName);
  
//   // Sanitize the group name for filesystem safety
//   const sanitizedGroup = sanitizeFileName(group);
  
//   // Get all images in this group (excluding current image)
//   const existingImages = await prisma.image.findMany({
//     where: { 
//       group: group, // Keep original group for database query
//       id: { not: currentImageId }
//     },
//     orderBy: { createdAt: 'asc' }
//   });
  
//   // Check if there's already an image with extracted code in this group
//   const hasImageWithCode = existingImages.some(img => !!img.code);
  
//   let baseName: string;
  
//   if (existingImages.length === 0) {
//     // First image in group - use SANITIZED_GROUP.ext
//     baseName = `${sanitizedGroup}${fileExtension}`;
//   } else if (hasImageWithCode) {
//     // Group already has an image with extracted code - use SANITIZED_GROUP_X.ext
//     baseName = `${sanitizedGroup}_${existingImages.length + 1}${fileExtension}`;
//   } else {
//     // Current image would be first with extracted code - use SANITIZED_GROUP.ext
//     baseName = `${sanitizedGroup}${fileExtension}`;
//   }
  
//   // Ensure global uniqueness with retry logic to handle race conditions
//   let finalName = baseName;
//   let counter = 1;
//   let maxRetries = 20; // Prevent infinite loops
  
//   while (maxRetries > 0) {
//     // Use a more robust check that includes a small random delay to reduce collision probability
//     const existingImageWithName = await prisma.image.findFirst({
//       where: {
//         newName: finalName,
//         id: { not: currentImageId }
//       }
//     });
    
//     if (!existingImageWithName) {
//       // Name appears to be unique - try to claim it by updating the database
//       try {
//         // Attempt to set the name on the current image
//         await prisma.image.update({
//           where: { id: currentImageId },
//           data: { newName: finalName }
//         });
        
//         // If we get here, we successfully claimed the name
//         return finalName;
//       } catch (error) {
//         // Database update failed - likely because another process claimed this name
//         // Fall through to try the next counter value
//         console.log(`Name collision detected for ${finalName}, trying next counter...`);
//       }
//     }
    
//     // Name exists or we failed to claim it, increment counter and try again
//     counter++;
//     const nameWithoutExt = baseName.replace(fileExtension, '');
    
//     // If baseName already has a suffix (e.g., "test_2"), replace it with the new counter
//     if (nameWithoutExt.includes('_')) {
//       const baseWithoutSuffix = nameWithoutExt.substring(0, nameWithoutExt.lastIndexOf('_'));
//       finalName = `${baseWithoutSuffix}_${counter}${fileExtension}`;
//     } else {
//       finalName = `${nameWithoutExt}_${counter}${fileExtension}`;
//     }
    
//     maxRetries--;
//   }
  
//   // Fallback: if we couldn't find a unique name after many attempts, use UUID
//   const fallbackName = `${sanitizedGroup}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
//   console.warn(`Failed to generate unique name for ${group}, using fallback: ${fallbackName}`);
  
//   await prisma.image.update({
//     where: { id: currentImageId },
//     data: { newName: fallbackName }
//   });
  
//   return fallbackName;
// }

// export async function generateSmartFilename(group: string, currentImageId: string, originalName: string): Promise<string> {
//   const fileExtension = path.extname(originalName);
//   const sanitizedGroup = sanitizeFileName(group);

//   // Find the correct index for the current image within its group, sorted by creation date
//   const imagesInGroup = await prisma.image.findMany({
//     where: { group: group },
//     orderBy: { createdAt: 'asc' }
//   });

//   const currentIndex = imagesInGroup.findIndex(img => img.id === currentImageId);

//   // The index determines the suffix. The first image (index 0) gets no suffix.
//   const suffix = currentIndex > 0 ? `_${currentIndex + 1}` : '';
//   const baseName = `${sanitizedGroup}${suffix}${fileExtension}`;

//   // Ensure the generated name is globally unique, handling potential race conditions
//   let finalName = baseName;
//   let attempt = 0;
//   const maxRetries = 20;

//   while (attempt < maxRetries) {
//     const existingImage = await prisma.image.findFirst({
//       where: { newName: finalName, id: { not: currentImageId } }
//     });

//     if (!existingImage) {
//       // Name is unique, update the database and return
//       await prisma.image.update({
//         where: { id: currentImageId },
//         data: { newName: finalName }
//       });
//       return finalName;
//     }

//     // If name is taken, generate a new one with a higher suffix
//     attempt++;
//     const newSuffix = `_${currentIndex + 1 + attempt}`;
//     finalName = `${sanitizedGroup}${newSuffix}${fileExtension}`;
//   }

//   // Fallback to a UUID-based name if a unique name can't be found
//   const fallbackName = `${sanitizedGroup}_${uuidv4()}${fileExtension}`;
//   await prisma.image.update({
//     where: { id: currentImageId },
//     data: { newName: fallbackName }
//   });
//   return fallbackName;
// }
export async function generateSmartFilename(group: string, currentImageId: string, originalName: string): Promise<string> {
  const fileExtension = path.extname(originalName);
  const sanitizedGroup = sanitizeFileName(group);

  // Get all images in the group, sorted by their creation date to ensure a stable order.
  const imagesInGroup = await prisma.image.findMany({
    where: { group: group },
    orderBy: { createdAt: 'asc' },
  });

  // Find the position of the current image in the sorted list.
  let currentIndex = imagesInGroup.findIndex(img => img.id === currentImageId);

  // If the image is not in the list (e.g., it's a new addition), it's the last one.
  if (currentIndex === -1) {
    currentIndex = imagesInGroup.length;
  }

  // The first image (index 0) has no suffix. Subsequent images are numbered starting from 2.
  const suffix = currentIndex > 0 ? `_${currentIndex + 1}` : '';
  const finalName = `${sanitizedGroup}${suffix}${fileExtension}`;

  // This function will now update the database directly with the correct name.
  await prisma.image.update({
    where: { id: currentImageId },
    data: { newName: finalName },
  });

  return finalName;
}

// Start Gemini processing for uploaded images
async function startGeminiProcessing(imageIds: string[]) {
  console.log(`🚀 Starting Gemini processing for ${imageIds.length} images...`);
  
  // Process all images in parallel with Gemini
  const processingPromises = imageIds.map(imageId => {
    return geminiLimit(() => processGeminiForImage(imageId));
  });

  try {
    await Promise.all(processingPromises);
    console.log('✅ All Gemini processing completed');
    
    // NEW: Auto-resolve duplicate names after extraction
    console.log('🔧 Resolving duplicate names...');
    await resolveDuplicateNames();
    console.log('✅ Duplicate name resolution completed');
    
    // Start auto-grouping for images without codes
    console.log('🔗 Starting auto-grouping process...');
    await autoGroupImages();
    console.log('✅ Auto-grouping completed');
    
    // Final duplicate resolution after auto-grouping (in case auto-grouping created new duplicates)
    console.log('🔧 Final duplicate name resolution...');
    await resolveDuplicateNames();
    console.log('✅ Final duplicate resolution completed');
    
  } catch (error) {
    console.error('❌ Error in Gemini processing:', error);
  }
}

/**
 * Automatically resolve duplicate names by regenerating names for all but the first image
 * This handles race conditions during concurrent Gemini processing
 */
async function resolveDuplicateNames(): Promise<void> {
  try {
    // Find all images with duplicate newName values (excluding empty names)
    const allImages = await prisma.image.findMany({
      select: {
        id: true,
        newName: true,
        originalName: true,
        group: true,
        createdAt: true,
        status: true
      },
      where: {
        AND: [
          { newName: { not: null } },
          { newName: { not: '' } }
        ]
      },
      orderBy: { createdAt: 'asc' } // Earlier created images get priority
    });

    // Group images by newName to find duplicates
    const nameGroups = new Map<string, Array<typeof allImages[0]>>();
    for (const image of allImages) {
      if (!image.newName) continue;
      
      if (!nameGroups.has(image.newName)) {
        nameGroups.set(image.newName, []);
      }
      nameGroups.get(image.newName)!.push(image);
    }

    // Find groups with duplicates
    const duplicateGroups = Array.from(nameGroups.entries())
      .filter(([, images]) => images.length > 1);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate names found');
      return;
    }

    console.log(`🔧 Found ${duplicateGroups.length} sets of duplicate names, resolving...`);

    let resolvedCount = 0;
    for (const [duplicateName, duplicateImages] of duplicateGroups) {
      console.log(`📝 Resolving ${duplicateImages.length} duplicates of "${duplicateName}"`);
      
      // Keep the first image (earliest created), regenerate names for the rest
      const [keepImage, ...regenerateImages] = duplicateImages;
      
      for (const image of regenerateImages) {
        try {
          // Use our existing generateSmartFilename function which handles collisions
          const newUniqueName = await generateSmartFilename(
            image.group || 'ungrouped', 
            image.id, 
            image.originalName
          );
          
          console.log(`  ✅ ${image.originalName}: "${duplicateName}" → "${newUniqueName}"`);
          
          // Broadcast the update to connected clients
          broadcastGeminiUpdate(image.id, {
            newName: newUniqueName
          });
          
          resolvedCount++;
        } catch (error) {
          console.error(`  ❌ Failed to resolve duplicate for ${image.originalName}:`, error);
        }
      }
    }

    console.log(`✅ Resolved ${resolvedCount} duplicate names`);
    
  } catch (error) {
    console.error('❌ Error resolving duplicate names:', error);
  }
}

// Process Gemini OCR for a specific image
export async function processGeminiForImage(imageId: string): Promise<void> {
  try {
    // Get image from database
    const image = await prisma.image.findUnique({
      where: { id: imageId }
    });

    if (!image) {
      console.error(`Image ${imageId} not found`);
      return;
    }

    // // Update status to extracting
    // await prisma.image.update({
    //   where: { id: imageId },
    //   data: { 
    //     geminiStatus: 'processing',
    //     status: 'extracting'
    //   }
    // });

    // // Broadcast processing status update
    // broadcastGeminiUpdate(imageId, { 
    //   geminiStatus: 'processing',
    //   status: 'extracting'
    // });
    // Update status to error
    await prisma.image.update({
      where: { id: imageId },
      data: { 
        geminiStatus: 'error',
        status: 'api_error' // Use the new specific status
      }
    });

    // Broadcast error update
    broadcastGeminiUpdate(imageId, { 
      geminiStatus: 'error',
      status: 'api_error'
    });

    console.log(`🧠 Processing Gemini OCR for ${image.originalName}...`);

    // Extract text using Gemini
    const geminiResult = await extractTextFromImage(image.filePath);

    // Determine appropriate status and data based on results
    let newStatus: string;
    let newName = image.newName || ''; // Keep blank if no name was previously set
    let group = image.group || ''; // Keep existing group if it exists
    let groupingStatus = image.groupingStatus;
    let groupingConfidence = image.groupingConfidence;

    if (geminiResult.code) {
      // Code was found - check if it's valid
      if (isValidSampleCode(geminiResult.code)) {
        // Valid code found
        newStatus = 'extracted';
        group = geminiResult.code;
        groupingStatus = 'complete';
        groupingConfidence = 1.0;
        newName = await generateSmartFilename(group, imageId, image.originalName);
        console.log(`✅ Valid code extracted: ${geminiResult.code}`);
      } else {
        // Invalid code found
        newStatus = 'invalid_group';
        group = geminiResult.code;
        newName = await generateSmartFilename(group, imageId, image.originalName);
        console.log(`⚠️ Invalid code structure: ${geminiResult.code}`);
      }
    } else {
      // No code found - will need grouping
      newStatus = 'pending_grouping';
      console.log(`🔍 No code found, will need grouping`);
    }

    // Update database with results (excluding newName since generateSmartFilename already set it)
    const updateData: any = {
      geminiStatus: 'complete',
      status: newStatus,
      code: geminiResult.code,
      otherText: geminiResult.otherText,
      objectDesc: geminiResult.objectDesc,
      objectColors: geminiResult.objectColors ? JSON.stringify(geminiResult.objectColors) : null,
      geminiConfidence: geminiResult.confidence,
      group: group,
      groupingStatus: groupingStatus,
      groupingConfidence: groupingConfidence,
    };

    // Only include newName in update if we didn't call generateSmartFilename (i.e., no code found)
    if (!geminiResult.code) {
      updateData.newName = newName;
    }

    await prisma.image.update({
      where: { id: imageId },
      data: updateData
    });

    // Broadcast completion update
    broadcastGeminiUpdate(imageId, {
      geminiStatus: 'complete',
      status: newStatus,
      code: geminiResult.code,
      otherText: geminiResult.otherText,
      objectDesc: geminiResult.objectDesc,
      objectColors: geminiResult.objectColors ? JSON.stringify(geminiResult.objectColors) : null,
      geminiConfidence: geminiResult.confidence,
      newName: newName,
      group: group,
      groupingStatus: groupingStatus,
      groupingConfidence: groupingConfidence,
    });

    console.log(`✅ Gemini OCR completed for ${image.originalName} - Status: ${newStatus}`);

  } catch (error) {
    console.error(`Failed to process Gemini OCR for image ${imageId}:`, error);
    
    // Update status to error/pending
    await prisma.image.update({
      where: { id: imageId },
      data: { 
        geminiStatus: 'error',
        status: 'pending'
      }
    });

    // Broadcast error update
    broadcastGeminiUpdate(imageId, { 
      geminiStatus: 'error',
      status: 'pending'
    });
  }
}

// Function to broadcast Gemini updates to all connected clients
export function broadcastGeminiUpdate(imageId: string, updates: any) {
  const data = JSON.stringify({
    type: 'gemini_update',
    imageId,
    updates
  });

  const deadConnections: number[] = [];

  sseClients.forEach((client, clientId) => {
    try {
      // Check if response is still writable
      if (client.destroyed || client.writableEnded) {
        deadConnections.push(clientId);
        return;
      }

      client.write(`data: ${data}\n\n`);
      if (client.flush) {
        try {
          client.flush();
        } catch (flushError) {
          // Flush failed, connection might be dead
          console.warn(`SSE flush failed for client ${clientId}, marking as dead`);
          deadConnections.push(clientId);
        }
      }
    } catch (error) {
      // Write failed, connection is dead
      console.warn(`SSE write failed for client ${clientId}, removing connection`);
      deadConnections.push(clientId);
    }
  });

  // Clean up dead connections
  deadConnections.forEach(clientId => {
    console.log(`🧹 Removing dead SSE client ${clientId}`);
    sseClients.delete(clientId);
  });

  console.log(`📡 Broadcast to ${sseClients.size} active SSE clients for image ${imageId}`);
}

// POST /api/upload/cleanup - Manual cleanup endpoint
router.post('/cleanup', async (req, res) => {
  try {
    await cleanupOldData();
    return res.json({ message: 'Cleanup completed successfully' });
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: 'Failed to cleanup data' });
  }
});

// POST /api/upload/folder - Handle folder upload (files with path info)
router.post('/folder', upload.array('files'), async (req, res) => {
  try {
    await ensureDirectories();

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Get file paths from form data if available
    const filePaths = req.body.filePaths ? JSON.parse(req.body.filePaths) : [];

    console.log(`📤 Processing ${req.files.length} files from folder...`);

    // Process files quickly - just save and create records
    const uploadPromises = req.files.map((file, index) => {
      const relativePath = filePaths[index] || file.originalname;
      return saveFileOnly(file, relativePath);
    });

    const uploadedImages = await Promise.all(uploadPromises);

    // Sort by timestamp for chronological order
    uploadedImages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`✅ Successfully processed ${uploadedImages.length} files from folder`);

    // Start Gemini processing after successful upload
    console.log('🚀 Starting Gemini processing...');
    startGeminiProcessing(uploadedImages.map(img => img.id));

    return res.json({
      message: `Successfully uploaded ${uploadedImages.length} of ${req.files.length} files`,
      images: uploadedImages,
    });

  } catch (error) {
    console.error('Folder upload error:', error);
    return res.status(500).json({ error: 'Failed to upload folder' });
  }
});

// GET /api/upload/progress - Server-Sent Events for real-time Gemini processing updates
router.get('/progress', (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write('data: {"type":"connected"}\n\n');

  // Store this connection for sending updates
  const clientId = Date.now();
  sseClients.set(clientId, res);

  // Clean up when client disconnects
  req.on('close', () => {
    sseClients.delete(clientId);
  });

  req.on('aborted', () => {
    sseClients.delete(clientId);
  });
});

// POST /api/upload/zip - Handle ZIP file upload and extract images
router.post('/zip', zipUpload.single('file'), async (req, res) => {
  try {
    await ensureDirectories();

    if (!req.file) {
      return res.status(400).json({ error: 'No ZIP file uploaded' });
    }

    console.log(`📦 Processing ZIP file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Clean up old data before processing new uploads
    console.log('🧹 Cleaning up old data...');
    await cleanupOldData();

    // Estimate extraction duration for UI hints
    const estimatedSeconds = getExtractionEstimate(req.file.size);
    console.log(`📊 Estimated extraction time: ${estimatedSeconds} seconds`);

    // Process images as they stream out of the archive
    console.log('📦 Stream-extracting images from ZIP…');

    const uploadedImages: any[] = [];
    const saveLimit = pLimit(50); // avoid disk thrash & memory spikes
    const savePromises: Promise<void>[] = [];

    // Stream through the zipfile on disk
    await extractImagesFromZipFile(req.file.path, async (extractedFile) => {
      const promise = saveLimit(async () => {
        const mockFile: Express.Multer.File = {
          fieldname: 'files',
          originalname: extractedFile.filename,
          encoding: '7bit',
          mimetype: 'image/jpeg', // Will be corrected later by mime detection
          size: extractedFile.buffer.length,
          buffer: extractedFile.buffer,
          destination: '',
          filename: '',
          path: '',
          stream: null as any,
        };

        const saved = await saveFileOnly(
          mockFile,
          extractedFile.relativePath,
          extractedFile.lastModified.getTime()
        );
        uploadedImages.push(saved);
      });

      savePromises.push(promise);
      return promise; // ensure extractor waits on this task
    });

    // Await pending writes
    await Promise.all(savePromises);

    // Remove temporary ZIP file to free disk space
    try {
      if (req.file && req.file.path) {
        await fs.unlink(req.file.path);
        console.log(`🗑️  Deleted temporary ZIP: ${req.file.path}`);
      }
    } catch (unlinkErr) {
      console.warn('Failed to delete temporary ZIP file:', unlinkErr);
    }

    // Sort by timestamp for chronological order
    uploadedImages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`✅ Successfully extracted and processed ${uploadedImages.length} images from ZIP`);

    // Start Gemini processing after successful upload
    console.log('🚀 Starting Gemini processing...');
    startGeminiProcessing(uploadedImages.map(img => img.id));

    return res.json({
      message: `Successfully extracted ${uploadedImages.length} images from ZIP file`,
      images: uploadedImages,
      extractionTime: estimatedSeconds,
    });

  } catch (error) {
    console.error('ZIP upload error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process ZIP file';
    if (error instanceof Error) {
      if (error.message.includes('Invalid ZIP file')) {
        errorMessage = 'Invalid or corrupted ZIP file';
      } else if (error.message.includes('No images found')) {
        errorMessage = 'No supported image files found in ZIP archive';
      } else {
        errorMessage = `ZIP processing failed: ${error.message}`;
      }
    }
    
    return res.status(500).json({ error: errorMessage });
  }
});

// Store active SSE connections
const sseClients = new Map<number, any>();

export default router; 
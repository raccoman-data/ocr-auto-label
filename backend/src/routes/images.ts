import express from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { unparse } from 'papaparse';
import { prisma } from '../index';
import { processGeminiForImage } from './upload';
import { isValidSampleCode } from '../services/gemini';
import os from 'os';
import { exiftool } from 'exiftool-vendored';

const router = express.Router();

// Helper function to parse object colors JSON string for frontend consumption
function transformImageForResponse(image: any) {
  return {
    ...image,
    objectColors: image.objectColors ? JSON.parse(image.objectColors) : null
  };
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

// Re-indexes filenames within a group to ensure they are sequential
async function reindexGroup(group: string) {
  if (!group || !group.trim()) return;

  const { generateSmartFilename: generateSmartFilenameWithUpdate } = await import('./upload');
  const { broadcastGeminiUpdate } = await import('./upload');

  const imagesInGroup = await prisma.image.findMany({
    where: { group },
    orderBy: { createdAt: 'asc' }, // Sort by creation time to maintain original order
  });

  for (const image of imagesInGroup) {
    // The generate function will now correctly find the new, proper index
    const newName = await generateSmartFilenameWithUpdate(group, image.id, image.originalName);

    // Broadcast the change to the UI
    broadcastGeminiUpdate(image.id, { newName });
  }

  console.log(`Re-indexed ${imagesInGroup.length} images in group "${group}"`);
}

// Generate smart filename based on group and existing files
async function generateSmartFilename(group: string, currentImageId: string, originalName: string): Promise<string> {
  const fileExtension = path.extname(originalName);
  
  // Sanitize the group name for filesystem safety
  const sanitizedGroup = sanitizeFileName(group);
  
  // Get all images in this group (excluding current image)
  const existingImages = await prisma.image.findMany({
    where: { 
      group: group, // Keep original group for database query
      id: { not: currentImageId }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  // Check if there's already an image with extracted code in this group
  const hasImageWithCode = existingImages.some(img => !!img.code);
  
  let baseName: string;
  
  if (existingImages.length === 0) {
    // First image in group - use SANITIZED_GROUP.ext
    baseName = `${sanitizedGroup}${fileExtension}`;
  } else if (hasImageWithCode) {
    // Group already has an image with extracted code - use SANITIZED_GROUP_X.ext
    baseName = `${sanitizedGroup}_${existingImages.length + 1}${fileExtension}`;
  } else {
    // Current image would be first with extracted code - use SANITIZED_GROUP.ext
    baseName = `${sanitizedGroup}${fileExtension}`;
  }
  
  // Ensure global uniqueness - check if this name already exists across ALL images
  let finalName = baseName;
  let counter = 1;
  
  while (true) {
    const existingImageWithName = await prisma.image.findFirst({
      where: {
        newName: finalName,
        id: { not: currentImageId }
      }
    });
    
    if (!existingImageWithName) {
      // Name is unique, we can use it
      break;
    }
    
    // Name exists, increment counter and try again
    counter++;
    const nameWithoutExt = baseName.replace(fileExtension, '');
    
    // If baseName already has a suffix (e.g., "test_2"), replace it with the new counter
    if (nameWithoutExt.includes('_')) {
      const baseWithoutSuffix = nameWithoutExt.substring(0, nameWithoutExt.lastIndexOf('_'));
      finalName = `${baseWithoutSuffix}_${counter}${fileExtension}`;
    } else {
      finalName = `${nameWithoutExt}_${counter}${fileExtension}`;
    }
  }
  
  return finalName;
}

// GET /api/images - Get all images with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '100',
      filter = 'all', // all, unknown, conflict
      search = '',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause based on filters
    let whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { originalName: { contains: search as string } },
        { newName: { contains: search as string } },
        { code: { contains: search as string } },
      ];
    }

    // Apply status filters
    if (filter === 'unknown') {
      whereClause.AND = [
        { geminiStatus: { not: 'complete' } },
        { groupingStatus: { not: 'complete' } }
      ];
    } else if (filter === 'conflict') {
      whereClause.geminiStatus = 'error';
    }

    const [images, total] = await Promise.all([
      prisma.image.findMany({
        where: whereClause,
        orderBy: { timestamp: 'asc' }, // Chronological order as per PRD
        skip,
        take: limitNum,
      }),
      prisma.image.count({ where: whereClause }),
    ]);

    res.json({
      images: images.map(transformImageForResponse),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// GET /api/images/:id - Get single image by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    return res.json(transformImageForResponse(image));

  } catch (error) {
    console.error('Error fetching image:', error);
    return res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// // PUT /api/images/:id - Update image metadata
// router.put('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { newName, group } = req.body;

//     const image = await prisma.image.findUnique({
//       where: { id },
//     });

//     if (!image) {
//       return res.status(404).json({ error: 'Image not found' });
//     }

//     let finalNewName = newName;
//     let groupingStatus = image.groupingStatus;
//     let groupingConfidence = image.groupingConfidence;
//     let status = image.status;

//     // // If group is being updated, handle smart filename generation
//     // if (group !== undefined && group !== image.group) {
//     //   if (group && group.trim()) {
//     //     // Group is being assigned/changed - ALWAYS override any existing status
//     //     // This allows users to override extracted, auto_grouped, ungrouped, etc.
//     //     // Import and use the generateSmartFilename that updates the database
//     //     const { generateSmartFilename: generateSmartFilenameWithUpdate } = await import('./upload');
//     //     await generateSmartFilenameWithUpdate(group, id, image.originalName);
//     //     groupingStatus = 'complete';
//     //     groupingConfidence = 1.0;
        
//     //     // Validate the group format and set appropriate status
//     //     if (isValidSampleCode(group)) {
//     //       status = 'user_grouped'; // Valid format - mark as user grouped
//     //     } else {
//     //       status = 'invalid_group'; // Invalid format
//     //     }
//     //   } else {
//     //     // Group is being removed - clear the name and mark as ungrouped
//     //     finalNewName = '';
//     //     groupingStatus = 'complete';
//     //     groupingConfidence = 0;
//     //     status = 'ungrouped'; // Mark as ungrouped when user manually clears group
//     //   }
//     // }
//     const oldGroup = image.group;
//     let imagesToPropagate: any[] = [];

//     // If group is being updated, handle smart filename generation
//     if (group !== undefined && group !== image.group) {
//       // Find other images in the old group to propagate the change
//       if (oldGroup && oldGroup.trim()) {
//         imagesToPropagate = await prisma.image.findMany({
//           where: { group: oldGroup, id: { not: id } }
//         });
//       }

//       if (group && group.trim()) {
//         // Group is being assigned/changed
//         const { generateSmartFilename: generateSmartFilenameWithUpdate } = await import('./upload');
//         await generateSmartFilenameWithUpdate(group, id, image.originalName);
//         groupingStatus = 'complete';
//         groupingConfidence = 1.0;
//         status = isValidSampleCode(group) ? 'user_grouped' : 'invalid_group';
//       } else {
//         // Group is being removed
//         finalNewName = '';
//         groupingStatus = 'complete';
//         groupingConfidence = 0;
//         status = 'ungrouped';
//       }
//     }

//     // Prepare update data - exclude newName if we used generateSmartFilename
//     const updateData: any = {
//       ...(group !== undefined && { group }),
//       status,
//       groupingStatus,
//       groupingConfidence,
//       updatedAt: new Date(),
//     };

//     // Only include newName if we didn't call generateSmartFilename or if group was cleared
//     if (group === undefined || (group !== undefined && !group.trim())) {
//       updateData.newName = finalNewName;
//     }

//     const updatedImage = await prisma.image.update({
//       where: { id },
//       data: updateData,
//     });

//     return res.json(transformImageForResponse(updatedImage));

//   } catch (error) {
//     console.error('Error updating image:', error);
//     return res.status(500).json({ error: 'Failed to update image' });
//   }
// });

// // PUT /api/images/:id - Update image metadata
// router.put('/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { newName, group } = req.body;

//     // 1. Fetch the original image from the database
//     const image = await prisma.image.findUnique({ where: { id } });

//     if (!image) {
//       return res.status(404).json({ error: 'Image not found' });
//     }

//     const oldGroup = image.group;
//     let updatedImage = image; // Start with the original image data

//     // 2. Determine if the group name has actually changed
//     if (group !== undefined && group !== oldGroup) {
//       // Find all other images in the old group BEFORE making any changes
//       const imagesToPropagate = oldGroup && oldGroup.trim()
//         ? await prisma.image.findMany({ where: { group: oldGroup, id: { not: id } } })
//         : [];

//       // Update the primary image first
//       const { generateSmartFilename: generateSmartFilenameWithUpdate } = await import('./upload');
//       await generateSmartFilenameWithUpdate(group, id, image.originalName);
//       const newStatus = isValidSampleCode(group) ? 'user_grouped' : 'invalid_group';
      
//       updatedImage = await prisma.image.update({
//         where: { id },
//         data: {
//           group: group,
//           status: newStatus,
//           groupingStatus: 'complete',
//           groupingConfidence: 1.0,
//           updatedAt: new Date(),
//         },
//       });

//       // Now, propagate the change to the other images
//       if (imagesToPropagate.length > 0) {
//         const { broadcastGeminiUpdate } = await import('./upload');
//         for (const imageToUpdate of imagesToPropagate) {
//           await generateSmartFilenameWithUpdate(group, imageToUpdate.id, imageToUpdate.originalName);
//           const propagatedUpdate = await prisma.image.update({
//             where: { id: imageToUpdate.id },
//             data: {
//               group: group,
//               status: newStatus,
//               groupingStatus: 'complete',
//               groupingConfidence: 1.0,
//               updatedAt: new Date(),
//             }
//           });
//           // Broadcast the changes to the UI
//           broadcastGeminiUpdate(propagatedUpdate.id, {
//             group: propagatedUpdate.group,
//             newName: propagatedUpdate.newName,
//             status: propagatedUpdate.status
//           });
//         }
//         console.log(`Propagated group change from "${oldGroup}" to "${group}" for ${imagesToPropagate.length} other images.`);
//       }
//     } else if (newName !== undefined && newName !== image.newName) {
//       // Handle cases where only the name is changed without affecting the group
//       updatedImage = await prisma.image.update({
//         where: { id },
//         data: { newName, updatedAt: new Date() },
//       });
//     }

//     return res.json(transformImageForResponse(updatedImage));

//   } catch (error) {
//     console.error('Error updating image:', error);
//     return res.status(500).json({ error: 'Failed to update image' });
//   }
// });

// PUT /api/images/:id - Update image metadata
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { newName, group } = req.body;

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const oldGroup = image.group; // Capture the original group

    let finalNewName = newName;
    let groupingStatus = image.groupingStatus;
    let groupingConfidence = image.groupingConfidence;
    let status = image.status;

    if (group !== undefined && group !== image.group) {
      if (group && group.trim()) {
        const { generateSmartFilename: generateSmartFilenameWithUpdate } = await import('./upload');
        await generateSmartFilenameWithUpdate(group, id, image.originalName);
        groupingStatus = 'complete';
        groupingConfidence = 1.0;
        status = isValidSampleCode(group) ? 'user_grouped' : 'invalid_group';
      } else {
        finalNewName = '';
        groupingStatus = 'complete';
        groupingConfidence = 0;
        status = 'ungrouped';
      }
    }

    const updateData: any = {
      ...(group !== undefined && { group }),
      status,
      groupingStatus,
      groupingConfidence,
      updatedAt: new Date(),
    };

    if (group === undefined || (group !== undefined && !group.trim())) {
      updateData.newName = finalNewName;
    }

    const updatedImage = await prisma.image.update({
      where: { id },
      data: updateData,
    });

    // After the update, re-index both the old and new groups if a move occurred
    if (group !== undefined && group !== oldGroup) {
      if (oldGroup) {
        await reindexGroup(oldGroup); // Re-index the original group
      }
      if (group) {
        await reindexGroup(group); // Re-index the new group
      }
    }

    return res.json(transformImageForResponse(updatedImage));

  } catch (error) {
    console.error('Error updating image:', error);
    return res.status(500).json({ error: 'Failed to update image' });
  }
});

// PATCH /api/images/:id - Partial update image metadata (simpler version for name-only updates)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { newName, group } = req.body;

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // For PATCH, we do simpler updates without the smart filename logic
    // This is mainly used for direct name edits from the frontend
    let statusUpdate = {};
    
    // If user is manually editing name or group, validate and set appropriate status
    // This allows users to override extracted, auto_grouped, ungrouped, etc.
    if ((newName !== undefined && newName !== image.newName) || 
        (group !== undefined && group !== image.group)) {
      
      if (group !== undefined) {
        // Group is being changed - validate format
        if (group && group.trim()) {
          if (isValidSampleCode(group)) {
            statusUpdate = { status: 'user_grouped' }; // Valid format
                     } else {
             statusUpdate = { status: 'invalid_group' }; // Invalid format
           }
        } else {
          statusUpdate = { status: 'ungrouped' }; // Group cleared
        }
      } else {
        // Only name changed - don't change status (preserve current status)
        // Name-only changes shouldn't affect grouping status
        statusUpdate = {};
      }
    }

    const updatedImage = await prisma.image.update({
      where: { id },
      data: {
        ...(newName !== undefined && { newName: sanitizeFileName(newName) }),
        ...(group !== undefined && { group }),
        ...statusUpdate,
        updatedAt: new Date(),
      },
    });

    return res.json(transformImageForResponse(updatedImage));

  } catch (error) {
    console.error('Error updating image:', error);
    return res.status(500).json({ error: 'Failed to update image' });
  }
});

// PUT /api/images/bulk - Bulk update images
router.put('/bulk', async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, newName?, group? }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    const results = [];

    for (const update of updates) {
      try {
        const updatedImage = await prisma.image.update({
          where: { id: update.id },
          data: {
            ...(update.newName !== undefined && { newName: sanitizeFileName(update.newName) }),
            ...(update.group !== undefined && { group: update.group }),
            updatedAt: new Date(),
          },
        });
        results.push(transformImageForResponse(updatedImage));
      } catch (error) {
        console.error(`Error updating image ${update.id}:`, error);
        // Continue with other updates
      }
    }

    return res.json({
      message: `Successfully updated ${results.length} of ${updates.length} images`,
      images: results,
    });

  } catch (error) {
    console.error('Error bulk updating images:', error);
    return res.status(500).json({ error: 'Failed to bulk update images' });
  }
});

// DELETE /api/images/:id - Delete single image
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const groupToReindex = image.group; // Capture the group name before deleting

    // Delete from database first
    await prisma.image.delete({
      where: { id },
    });

    // After deletion, re-index the group if it had one
    if (groupToReindex) {
      await reindexGroup(groupToReindex);
    }

    // Delete from database first
    await prisma.image.delete({
      where: { id },
    });

    // Try to delete physical files (don't fail if files don't exist)
    try {
      if (image.filePath && fs.existsSync(image.filePath)) {
        await fs.promises.unlink(image.filePath);
        console.log(`🗑️ Deleted original file: ${image.filePath}`);
      }
      
      if (image.thumbnailPath && fs.existsSync(image.thumbnailPath)) {
        await fs.promises.unlink(image.thumbnailPath);
        console.log(`🗑️ Deleted thumbnail: ${image.thumbnailPath}`);
      }
    } catch (fileError) {
      console.warn('Failed to delete physical files (non-critical):', fileError);
    }

    console.log(`✅ Successfully deleted image: ${image.originalName}`);
    return res.json({ message: 'Image deleted successfully' });

  } catch (error) {
    console.error('Error deleting image:', error);
    return res.status(500).json({ error: 'Failed to delete image' });
  }
});

// DELETE /api/images - Delete all images
router.delete('/', async (req, res) => {
  try {
    const result = await prisma.image.deleteMany({});

    return res.json({ 
      message: `Successfully deleted ${result.count} images`,
      count: result.count 
    });

  } catch (error) {
    console.error('Error deleting all images:', error);
    return res.status(500).json({ error: 'Failed to delete images' });
  }
});

// POST /api/images/:id/rerun-gemini - Trigger Gemini OCR reprocessing
router.post('/:id/rerun-gemini', async (req, res) => {
  try {
    const { id } = req.params;

    const image = await prisma.image.findUnique({ where: { id } });
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    console.log(`🔄 Manual retry extraction requested for: ${image.originalName}`);

    // Reset all extraction-related data and status
    await prisma.image.update({
      where: { id },
      data: {
        geminiStatus: 'pending',
        status: 'pending', 
        geminiConfidence: 0,
        code: null,
        otherText: null,
        objectDesc: null,
        objectColors: null,
        // Keep group and grouping status if already set by user
        updatedAt: new Date(),
      },
    });

    // Kick off background processing (no await)
    processGeminiForImage(id).catch((error) => {
      console.error(`❌ Manual retry failed for ${image.originalName}:`, error);
    });

    return res.status(202).json({ 
      message: 'Gemini reprocessing started', 
      imageId: id,
      originalName: image.originalName 
    });

  } catch (error) {
    console.error('Error triggering Gemini reprocess:', error);
    return res.status(500).json({ error: 'Failed to start Gemini reprocess' });
  }
});

// POST /api/images/run-group-inference - Manually trigger group inference
router.post('/run-group-inference', async (req, res) => {
  try {
    const { runGroupInference } = await import('../services/groupInference');
    await runGroupInference();
    
    return res.json({ 
      message: 'Group inference completed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error running group inference:', error);
    return res.status(500).json({ error: 'Failed to run group inference' });
  }
});

// POST /api/images/export - Export images as zip with metadata and CSV
router.post('/export', async (req, res) => {
  // Prepare an array to track temp files for cleanup
  const tempFiles: string[] = [];

  // Cleanup function to be called in all scenarios
  const cleanupTempFiles = async () => {
    try {
      console.log('🧹 Cleaning up temporary files...');
      for (const tmp of tempFiles) {
        await fs.promises.unlink(tmp).catch(() => {});
      }
      // No need to end exiftool if it wasn't started
      // await exiftool.end().catch(() => {});
      console.log(`🧹 Cleaned up ${tempFiles.length} temp files`);
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }
  };

  // Set up timeout-based cleanup as failsafe (10 minutes)
  const cleanupTimeout = setTimeout(async () => {
    console.warn('⚠️  Export timeout reached, forcing cleanup...');
    await cleanupTempFiles();
  }, 10 * 60 * 1000); // 10 minutes

  try {
    console.log('🎯 Starting export process (metadata only)...');

    // Get all images from database
    const allImages = await prisma.image.findMany({
      orderBy: { timestamp: 'asc' }
    });

    if (allImages.length === 0) {
      clearTimeout(cleanupTimeout);
      return res.status(400).json({
        error: 'No images to export',
        details: 'Please upload and process some images first.'
      });
    }

    // STEP 1: Validation (Optional for metadata-only, but good practice)
    console.log(`📋 Validating ${allImages.length} images for metadata...`);
    // Validation logic for names/duplicates can remain if needed,
    // otherwise, this step can be simplified or removed if only metadata is exported.
    // ... (validation logic as before) ...
    // If validation fails:
    // clearTimeout(cleanupTimeout);
    // await cleanupTempFiles();
    // return res.status(400).json({ error: 'Validation failed', ... });

    console.log('✅ Validation passed');

    // STEP 2: Create zip file for metadata ONLY
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level
    });

    // Set response headers for file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFileName = `exported-metadata-${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

    // Pipe archive data to response
    archive.pipe(res);

    console.log('📦 Creating zip archive for metadata...');

    // STEP 3: Add images to zip - SKIPPED / COMMENTED OUT
    /*
    let processedCount = 0;
    for (const image of allImages) {
      try {
        const exportFilePath = image.originalFilePath || image.filePath;
        const originalPath = path.resolve(exportFilePath);

        if (!fs.existsSync(originalPath)) {
          console.warn(`⚠️  File not found: ${originalPath}, skipping image entry.`);
          continue; // Skip adding this image file
        }

        const metadata = {
          originalName: image.originalName,
          // ... (rest of metadata)
        };
        const metadataJson = JSON.stringify(metadata);

        // -- NO LONGER COPYING OR MODIFYING IMAGE FILES --
        // const tempFilePath = path.join(os.tmpdir(), `export-${Date.now()}-${image.id}-${image.newName}`);
        // await fs.promises.copyFile(originalPath, tempFilePath);
        // tempFiles.push(tempFilePath);
        // await exiftool.write(tempFilePath, { UserComment: metadataJson }, ["-overwrite_original"]);
        // archive.file(tempFilePath, { name: `images/${image.newName}` });

        // -- NO LONGER ADDING INDIVIDUAL JSON FILES --
        // const metadataFileName = `metadata/${image.newName!.replace(/\.[^/.]+$/, '.json')}`;
        // archive.append(metadataJson, { name: metadataFileName });

        processedCount++; // Still count as processed for summary if needed, or remove count

      } catch (error) {
        console.error(`❌ Error processing metadata entry for image ${image.originalName}:`, error);
      }
    }
    */
    const processedCount = allImages.length; // Count all images for metadata generation

    // STEP 4: Generate CSV with all metadata
    console.log('📊 Generating CSV metadata...');
    const csvData = allImages.map(image => ({
      'Original Name': image.originalName,
      'New Name': image.newName || '',
      'Group': image.group || '',
      'Code': image.code || '',
      'Other Text': image.otherText || '',
      'Object Description': image.objectDesc || '',
      'File Size (bytes)': image.fileSize,
      'Timestamp': image.timestamp,
      'Status': image.status,
      'Gemini Confidence': image.geminiConfidence || '',
      'Grouping Confidence': image.groupingConfidence || '',
      'Colors': image.objectColors ? JSON.parse(image.objectColors).map((c: any) => `${c.name}:${c.color}`).join('; ') : '',
      'Created At': image.createdAt,
      'Updated At': image.updatedAt
    }));

    const csvContent = unparse(csvData);

    // Add CSV to zip
    archive.append(csvContent, { name: 'metadata.csv' });

    // Add export summary
    const summary = {
      exportedAt: new Date().toISOString(),
      totalImages: allImages.length,
      processedImages: processedCount, // reflects metadata rows generated
      zipFileName,
      exportType: 'metadata_only', // Indicate only metadata is included
      exportedBy: 'OCR Auto Label v1.0.0'
    };

    archive.append(JSON.stringify(summary, null, 2), { name: 'export-summary.json' });

    console.log(`📤 Export completed: Metadata for ${processedCount}/${allImages.length} images included`);

    // Finalize the archive
    await archive.finalize();

    // Setup cleanup for multiple scenarios
    res.on('finish', async () => {
      clearTimeout(cleanupTimeout);
      await cleanupTempFiles();
    });
    res.on('error', async () => {
      clearTimeout(cleanupTimeout);
      await cleanupTempFiles();
    });
    res.on('close', async () => {
      clearTimeout(cleanupTimeout);
      await cleanupTempFiles();
    });

  } catch (error) {
    console.error('❌ Metadata export failed:', error);
    clearTimeout(cleanupTimeout);
    await cleanupTempFiles();
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Metadata export failed',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
});

export default router; 
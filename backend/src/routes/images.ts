import express from 'express';
import path from 'path';
import { prisma } from '../index';
import { processGeminiForImage } from './upload';
import { isValidSampleCode } from '../services/gemini';

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

    let finalNewName = newName;
    let groupingStatus = image.groupingStatus;
    let groupingConfidence = image.groupingConfidence;
    let status = image.status;

    // If group is being updated, handle smart filename generation
    if (group !== undefined && group !== image.group) {
      if (group && group.trim()) {
        // Group is being assigned/changed - ALWAYS override any existing status
        // This allows users to override extracted, auto_grouped, ungrouped, etc.
        finalNewName = await generateSmartFilename(group, id, image.originalName);
        groupingStatus = 'complete';
        groupingConfidence = 1.0;
        
        // Validate the group format and set appropriate status
        if (isValidSampleCode(group)) {
          status = 'user_grouped'; // Valid format - mark as user grouped
        } else {
          status = 'invalid_group'; // Invalid format
        }
      } else {
        // Group is being removed - clear the name and mark as ungrouped
        finalNewName = '';
        groupingStatus = 'complete';
        groupingConfidence = 0;
        status = 'ungrouped'; // Mark as ungrouped when user manually clears group
      }
    }

    const updatedImage = await prisma.image.update({
      where: { id },
      data: {
        ...(finalNewName !== undefined && { newName: finalNewName }),
        ...(group !== undefined && { group }),
        status,
        groupingStatus,
        groupingConfidence,
        updatedAt: new Date(),
      },
    });

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

    await prisma.image.delete({
      where: { id },
    });

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

    // Reset status locally
    await prisma.image.update({
      where: { id },
      data: {
        geminiStatus: 'pending',
        geminiConfidence: 0,
        updatedAt: new Date(),
      },
    });

    // Kick off background processing (no await)
    processGeminiForImage(id).catch(console.error);

    return res.status(202).json({ message: 'Gemini reprocessing started' });

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

export default router; 
import express from 'express';
import path from 'path';
import { prisma } from '../index';
import { processGeminiForImage } from './upload';

const router = express.Router();

// Helper function to parse palette JSON string for frontend consumption
function transformImageForResponse(image: any) {
  return {
    ...image,
    palette: image.palette ? JSON.parse(image.palette) : null
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

    res.json(transformImageForResponse(image));

  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
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

    // If group is being updated, handle smart filename generation
    if (group !== undefined && group !== image.group) {
      if (group && group.trim()) {
        // Group is being assigned/changed
        finalNewName = await generateSmartFilename(group, id, image.originalName);
        groupingStatus = 'complete';
        groupingConfidence = 1.0;
      } else {
        // Group is being removed
        finalNewName = image.originalName;
        groupingStatus = 'pending';
        groupingConfidence = 0;
      }
    }

    const updatedImage = await prisma.image.update({
      where: { id },
      data: {
        ...(finalNewName !== undefined && { newName: finalNewName }),
        ...(group !== undefined && { group }),
        groupingStatus,
        groupingConfidence,
        updatedAt: new Date(),
      },
    });

    res.json(transformImageForResponse(updatedImage));

  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Failed to update image' });
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
    const updatedImage = await prisma.image.update({
      where: { id },
      data: {
        ...(newName !== undefined && { newName }),
        ...(group !== undefined && { group }),
        updatedAt: new Date(),
      },
    });

    res.json(transformImageForResponse(updatedImage));

  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Failed to update image' });
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
            ...(update.newName !== undefined && { newName: update.newName }),
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

    res.json({
      message: `Successfully updated ${results.length} of ${updates.length} images`,
      images: results,
    });

  } catch (error) {
    console.error('Error bulk updating images:', error);
    res.status(500).json({ error: 'Failed to bulk update images' });
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

    res.json({ message: 'Image deleted successfully' });

  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// DELETE /api/images - Delete all images
router.delete('/', async (req, res) => {
  try {
    const result = await prisma.image.deleteMany({});

    res.json({ 
      message: `Successfully deleted ${result.count} images`,
      count: result.count 
    });

  } catch (error) {
    console.error('Error deleting all images:', error);
    res.status(500).json({ error: 'Failed to delete images' });
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

    res.status(202).json({ message: 'Gemini reprocessing started' });

  } catch (error) {
    console.error('Error triggering Gemini reprocess:', error);
    res.status(500).json({ error: 'Failed to start Gemini reprocess' });
  }
});

export default router; 
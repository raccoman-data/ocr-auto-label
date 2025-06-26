import { prisma } from '../index';

// Import SSE broadcast function from upload routes
let broadcastGeminiUpdate: Function;

// Lazy load to avoid circular imports
async function getBroadcastFunction() {
  if (!broadcastGeminiUpdate) {
    const { broadcastGeminiUpdate: broadcast } = await import('../routes/upload');
    broadcastGeminiUpdate = broadcast;
  }
  return broadcastGeminiUpdate;
}

export interface GroupingResult {
  imageId: string;
  suggestedGroup: string | null;
  confidence: number;
  reason: string;
}

/**
 * Auto-group images that don't have codes based on:
 * 1. Time proximity (±2 minutes)
 * 2. Object color similarity (≥2 shared colors)
 * 3. Object description matching
 */
export async function autoGroupImages(): Promise<GroupingResult[]> {
  console.log('🔗 Starting auto-grouping process...');
  
  // Get all images that need grouping (pending_grouping OR invalid_group status)
  // Include invalid groups since they might visually match valid nearby images
  const ungroupedImages = await prisma.image.findMany({
    where: {
      status: { in: ['pending_grouping', 'invalid_group'] }
    },
    orderBy: { timestamp: 'asc' }
  });

  if (ungroupedImages.length === 0) {
    console.log('✅ No images need grouping');
    return [];
  }

  console.log(`🔍 Processing ${ungroupedImages.length} images for auto-grouping...`);

  const results: GroupingResult[] = [];

  for (const image of ungroupedImages) {
    // Store original status to preserve invalid_group if auto-grouping fails
    const originalStatus = image.status;
    
    // Update status to show we're actively grouping this image
    await prisma.image.update({
      where: { id: image.id },
      data: { status: 'grouping' }
    });

    // Find similar images to group with
    const groupingResult = await findSimilarImagesForGrouping(image);
    results.push(groupingResult);

    // Apply the grouping result
    if (groupingResult.suggestedGroup) {
      // Generate smart filename for the auto-grouped image (this now updates newName in DB)
      const { generateSmartFilename } = await import('../routes/upload');
      await generateSmartFilename(groupingResult.suggestedGroup, image.id, image.originalName);
      
      // Update other fields (excluding newName since generateSmartFilename handled it)
      const updatedData = {
        group: groupingResult.suggestedGroup,
        status: 'auto_grouped',
        groupingStatus: 'complete',
        groupingConfidence: groupingResult.confidence
      };

      await prisma.image.update({
        where: { id: image.id },
        data: updatedData
      });

      // Broadcast the update (include newName from fresh query)
      const broadcast = await getBroadcastFunction();
      const updatedImage = await prisma.image.findUnique({ where: { id: image.id } });
      broadcast(image.id, {
        ...updatedData,
        newName: updatedImage?.newName
      });

      console.log(`✅ Auto-grouped ${image.originalName} → ${groupingResult.suggestedGroup} as ${updatedImage?.newName} (${groupingResult.reason})`);
    } else {
      // Preserve original status for invalid_group, otherwise mark as ungrouped
      const fallbackStatus = originalStatus === 'invalid_group' ? 'invalid_group' : 'ungrouped';
      
      const updatedData = {
        status: fallbackStatus,
        groupingStatus: 'complete',
        groupingConfidence: 0
      };

      await prisma.image.update({
        where: { id: image.id },
        data: updatedData
      });

      // Broadcast the update
      const broadcast = await getBroadcastFunction();
      broadcast(image.id, updatedData);

      console.log(`❌ Could not group ${image.originalName} - reverted to ${fallbackStatus}`);
    }
  }

  console.log(`✅ Auto-grouping complete: ${results.filter(r => r.suggestedGroup).length}/${results.length} images grouped`);
  return results;
}

/**
 * Find similar images for grouping based on time, colors, and description
 */
async function findSimilarImagesForGrouping(targetImage: any): Promise<GroupingResult> {
  // Get all other images within ±2 minutes
  const timeWindow = 2 * 60 * 1000; // 2 minutes in milliseconds
  const startTime = new Date(targetImage.timestamp.getTime() - timeWindow);
  const endTime = new Date(targetImage.timestamp.getTime() + timeWindow);

  const nearbyImages = await prisma.image.findMany({
    where: {
      id: { not: targetImage.id },
      timestamp: {
        gte: startTime,
        lte: endTime
      },
      // Only consider images with valid groups as potential sources
      group: { not: null },
      status: { in: ['extracted', 'auto_grouped', 'user_grouped'] }
    }
  });

  if (nearbyImages.length === 0) {
    return {
      imageId: targetImage.id,
      suggestedGroup: null,
      confidence: 0,
      reason: 'No nearby images with valid groups found'
    };
  }

  // Parse target image's object colors
  const targetColors = parseObjectColors(targetImage.objectColors);
  const targetDesc = targetImage.objectDesc;

  let bestMatch: any = null;
  let bestScore = 0;
  let bestReason = '';

  for (const candidateImage of nearbyImages) {
    let score = 0;
    let reasons: string[] = [];

    // Check object description match (highest priority)
    if (targetDesc && candidateImage.objectDesc) {
      const similarity = calculateTextSimilarity(targetDesc.toLowerCase(), candidateImage.objectDesc.toLowerCase());
      if (similarity >= 0.8) {
        // Exact or very similar match
        score += 0.8;
        reasons.push('identical object description');
      } else if (similarity >= 0.6) {
        // Good partial match (e.g., "spoon" vs "scoop")
        score += 0.6;
        reasons.push('similar object description');
      } else if (similarity >= 0.4) {
        // Partial match
        score += 0.3;
        reasons.push('partial object description match');
      }
    }

    // Check object color similarity
    const candidateColors = parseObjectColors(candidateImage.objectColors);
    const colorSimilarity = calculateColorSimilarity(targetColors, candidateColors);
    if (colorSimilarity >= 0.5) { // At least 50% color overlap
      score += colorSimilarity * 0.6;
      reasons.push(`${Math.round(colorSimilarity * 100)}% color similarity`);
    }

    // Time proximity bonus (closer = better)
    const timeDiff = Math.abs(targetImage.timestamp.getTime() - candidateImage.timestamp.getTime());
    const timeScore = Math.max(0, 1 - (timeDiff / timeWindow)) * 0.2;
    score += timeScore;
    if (timeScore > 0.1) {
      const minutes = Math.round(timeDiff / (60 * 1000));
      const seconds = Math.round((timeDiff % (60 * 1000)) / 1000);
      if (minutes > 0) {
        reasons.push(`${minutes}m${seconds}s apart`);
      } else {
        reasons.push(`${seconds}s apart`);
      }
    }

    if (score > bestScore && score > 0.35) { // Lowered minimum threshold from 0.4 to 0.35
      bestMatch = candidateImage;
      bestScore = score;
      bestReason = reasons.join(', ');
    }
  }

  if (bestMatch) {
    return {
      imageId: targetImage.id,
      suggestedGroup: bestMatch.group,
      confidence: Math.min(bestScore, 1.0),
      reason: bestReason
    };
  }

  return {
    imageId: targetImage.id,
    suggestedGroup: null,
    confidence: 0,
    reason: 'No sufficiently similar images found'
  };
}

/**
 * Parse object colors JSON string into array
 */
function parseObjectColors(objectColorsJson: string | null): Array<{color: string, name: string}> {
  if (!objectColorsJson) return [];
  
  try {
    return JSON.parse(objectColorsJson);
  } catch (error) {
    console.warn('Failed to parse object colors:', error);
    return [];
  }
}

/**
 * Calculate similarity between two sets of object colors
 * Returns 0-1 score based on shared colors (works with color names from Gemini)
 */
function calculateColorSimilarity(colors1: Array<{color: string, name: string}>, colors2: Array<{color: string, name: string}>): number {
  if (colors1.length === 0 || colors2.length === 0) return 0;

  let matches = 0;

  for (const color1 of colors1) {
    for (const color2 of colors2) {
      if (colorsAreSimilar(color1.color, color2.color)) {
        matches++;
        break; // Count each color only once
      }
    }
  }

  // Return ratio of matched colors to total unique colors
  return matches / Math.max(colors1.length, colors2.length);
}

/**
 * Check if two color names are similar (handles Gemini color names like "orange" vs "dark orange")
 */
function colorsAreSimilar(color1: string, color2: string): boolean {
  // Normalize color names to lowercase and remove common modifiers
  const normalize = (color: string) => {
    return color.toLowerCase()
      .replace(/\b(light|dark|bright|deep|pale|vivid)\s+/g, '') // Remove intensity modifiers
      .replace(/\s+/g, ' ')
      .trim();
  };

  const norm1 = normalize(color1);
  const norm2 = normalize(color2);

  // Direct match after normalization
  if (norm1 === norm2) return true;

  // Check if one color name contains the other (e.g., "orange" in "dark orange")
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check for common color synonyms
  const synonyms = [
    ['brown', 'chocolate', 'sienna', 'tan', 'beige'],
    ['orange', 'tangerine', 'amber'],
    ['red', 'crimson', 'scarlet'],
    ['blue', 'navy', 'azure'],
    ['green', 'lime', 'forest'],
    ['yellow', 'gold', 'golden'],
    ['purple', 'violet', 'magenta'],
    ['pink', 'rose', 'salmon'],
    ['gray', 'grey', 'silver'],
    ['black', 'charcoal'],
    ['white', 'cream', 'ivory']
  ];

  for (const group of synonyms) {
    if (group.includes(norm1) && group.includes(norm2)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate text similarity using word overlap
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  let matches = 0;
  for (const word1 of words1) {
    if (words2.includes(word1)) {
      matches++;
    }
  }
  
  // Return ratio of matched words to total unique words
  return matches / Math.max(words1.length, words2.length);
}

/**
 * Calculate color distance using simple RGB difference
 * @deprecated - This function expects hex colors but Gemini returns color names
 */
function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;

  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

/**
 * Convert hex color to RGB
 * @deprecated - This function expects hex colors but Gemini returns color names
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
} 
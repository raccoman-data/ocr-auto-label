import { prisma } from '../index';

// Common words to exclude from description matching
const COMMON_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'off', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
]);

// Type definitions for color families
interface ColorRange {
  h: [number, number];  // Hue range [min, max]
  s: [number, number];  // Saturation range [min, max]
  l: [number, number];  // Lightness range [min, max]
}

interface ColorFamily {
  name: string;
  ranges: ColorRange[];
}

// Color families for matching similar colors (not exact hex matches)
const COLOR_FAMILIES: ColorFamily[] = [
  {
    name: 'red',
    ranges: [
      { h: [0, 30], s: [30, 100], l: [20, 80] },      // Red-orange to red
      { h: [330, 360], s: [30, 100], l: [20, 80] }    // Red-pink to red
    ]
  },
  {
    name: 'orange',
    ranges: [
      { h: [15, 45], s: [40, 100], l: [30, 80] }      // Orange range
    ]
  },
  {
    name: 'yellow',
    ranges: [
      { h: [45, 75], s: [30, 100], l: [40, 90] }      // Yellow range
    ]
  },
  {
    name: 'green',
    ranges: [
      { h: [75, 165], s: [25, 100], l: [20, 80] }     // Green range
    ]
  },
  {
    name: 'blue',
    ranges: [
      { h: [180, 260], s: [30, 100], l: [20, 80] }    // Blue range
    ]
  },
  {
    name: 'purple',
    ranges: [
      { h: [260, 330], s: [30, 100], l: [20, 80] }    // Purple range
    ]
  },
  {
    name: 'brown',
    ranges: [
      { h: [15, 45], s: [20, 80], l: [15, 50] }       // Brown range
    ]
  },
  {
    name: 'beige',
    ranges: [
      { h: [30, 60], s: [10, 40], l: [60, 90] }       // Beige/tan range (light browns)
    ]
  },
  {
    name: 'tan',
    ranges: [
      { h: [25, 45], s: [15, 50], l: [50, 75] }       // Tan range (medium beiges)
    ]
  },
  {
    name: 'gray',
    ranges: [
      { h: [0, 360], s: [0, 20], l: [20, 80] }        // Gray range (low saturation)
    ]
  },
  {
    name: 'black',
    ranges: [
      { h: [0, 360], s: [0, 100], l: [0, 25] }        // Very dark colors
    ]
  },
  {
    name: 'white',
    ranges: [
      { h: [0, 360], s: [0, 20], l: [80, 100] }       // Very light colors
    ]
  }
];

/**
 * Convert hex color to HSL values
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
  const b = parseInt(cleanHex.substr(4, 2), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Get color family for a hex color
 */
function getColorFamily(hex: string): string | null {
  try {
    const hsl = hexToHSL(hex);
    
    for (const family of COLOR_FAMILIES) {
      for (const range of family.ranges) {
        const hInRange = (
          (range.h[0] <= range.h[1] && hsl.h >= range.h[0] && hsl.h <= range.h[1]) ||
          (range.h[0] > range.h[1] && (hsl.h >= range.h[0] || hsl.h <= range.h[1])) // Handle wrap-around
        );
        
        if (hInRange && 
            hsl.s >= range.s[0] && hsl.s <= range.s[1] && 
            hsl.l >= range.l[0] && hsl.l <= range.l[1]) {
          return family.name;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to parse color ${hex}:`, error);
    return null;
  }
}

/**
 * Extract meaningful words from object description (exclude common words)
 */
function extractMeaningfulWords(text: string | null): string[] {
  if (!text) return [];
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !COMMON_WORDS.has(word));
}

/**
 * Check if a color family should be ignored for matching
 */
function shouldIgnoreColorFamily(family: string | null): boolean {
  if (!family) return true;
  
  // Always ignore beige/tan (label backgrounds) and neutral colors in first pass
  const ignoredFamilies = ['beige', 'tan'];
  return ignoredFamilies.includes(family);
}

/**
 * Check if a color family is neutral (fallback colors)
 */
function isNeutralColorFamily(family: string | null): boolean {
  if (!family) return false;
  
  const neutralFamilies = ['white', 'black', 'gray', 'grey'];
  return neutralFamilies.includes(family);
}

/**
 * Get meaningful (non-neutral, non-beige) color families from an array
 */
function getMeaningfulColorFamilies(colors: Array<{color: string, name: string}>): string[] {
  return colors
    .slice(0, 3) // Only consider top 3 colors
    .map(c => getColorFamily(c.color))
    .filter(family => family && !shouldIgnoreColorFamily(family) && !isNeutralColorFamily(family)) as string[];
}

/**
 * Get neutral color families from an array (fallback)
 */
function getNeutralColorFamilies(colors: Array<{color: string, name: string}>): string[] {
  return colors
    .slice(0, 3) // Only consider top 3 colors
    .map(c => getColorFamily(c.color))
    .filter(family => family && !shouldIgnoreColorFamily(family) && isNeutralColorFamily(family)) as string[];
}

/**
 * Check if two color arrays have at least one matching color family
 * Priority: meaningful colors first, then neutral colors as fallback
 */
function hasMatchingColors(colors1: Array<{color: string, name: string}> | null, 
                          colors2: Array<{color: string, name: string}> | null): boolean {
  if (!colors1 || !colors2 || colors1.length === 0 || colors2.length === 0) {
    return false;
  }
  
  // First pass: Try to match meaningful (non-neutral, non-beige) colors
  const meaningful1 = getMeaningfulColorFamilies(colors1);
  const meaningful2 = getMeaningfulColorFamilies(colors2);
  
  if (meaningful1.length > 0 && meaningful2.length > 0) {
    // Both have meaningful colors - check for matches
    const hasMatch = meaningful1.some(family => meaningful2.includes(family));
    if (hasMatch) {
      return true;
    }
    // If both have meaningful colors but no match, don't fall back to neutrals
    return false;
  }
  
  // Second pass: Fall back to neutral colors only if no meaningful colors available
  if (meaningful1.length === 0 && meaningful2.length === 0) {
    const neutral1 = getNeutralColorFamilies(colors1);
    const neutral2 = getNeutralColorFamilies(colors2);
    
    return neutral1.some(family => neutral2.includes(family));
  }
  
  // If one has meaningful colors and the other doesn't, no match
  return false;
}

/**
 * Check if two object descriptions have at least two matching meaningful words
 */
function hasMatchingDescription(desc1: string | null, desc2: string | null): boolean {
  if (!desc1 || !desc2) return false;
  
  const words1 = extractMeaningfulWords(desc1);
  const words2 = extractMeaningfulWords(desc2);
  
  // Count how many meaningful words match
  const matchingWords = words1.filter(word => words2.includes(word));
  
  // Require at least 2 matching words for stronger confidence
  return matchingWords.length >= 2;
}

/**
 * Interface for image data needed for grouping
 */
interface ImageForGrouping {
  id: string;
  timestamp: Date;
  group: string | null;
  objectDesc: string | null;
  objectColors: string | null; // JSON string
  originalName: string;
}

/**
 * Main group inference algorithm
 */
export async function runGroupInference(): Promise<void> {
  console.log('🔍 Starting group inference for unlabeled images...');
  
  try {
    // Get all images sorted by timestamp
    const allImages = await prisma.image.findMany({
      select: {
        id: true,
        timestamp: true,
        group: true,
        objectDesc: true,
        objectColors: true,
        originalName: true,
        newName: true,
        groupingStatus: true,
        groupingConfidence: true
      },
      orderBy: { timestamp: 'asc' }
    });

    // Separate images into groups: labeled vs unlabeled
    const labeledImages = allImages.filter(img => img.group && img.group.trim() !== '');
    const unlabeledImages = allImages.filter(img => !img.group || img.group.trim() === '');
    
    console.log(`📊 Found ${unlabeledImages.length} unlabeled images and ${labeledImages.length} labeled images`);
    
    if (unlabeledImages.length === 0) {
      console.log('✅ No unlabeled images to process');
      return;
    }

    let inferencesCount = 0;
    
    // Process each unlabeled image
    for (const unlabeledImage of unlabeledImages) {
      const targetTimestamp = new Date(unlabeledImage.timestamp);
      
      // Find labeled images within ±3 minutes
      const timeWindowMs = 3 * 60 * 1000; // 3 minutes in milliseconds
      const candidateImages = labeledImages.filter(labeledImg => {
        const candidateTimestamp = new Date(labeledImg.timestamp);
        const timeDiff = Math.abs(targetTimestamp.getTime() - candidateTimestamp.getTime());
        return timeDiff <= timeWindowMs;
      });
      
      if (candidateImages.length === 0) {
        continue;
      }
      
      // Parse object colors for the unlabeled image
      let unlabeledColors: Array<{color: string, name: string}> | null = null;
      if (unlabeledImage.objectColors) {
        try {
          unlabeledColors = JSON.parse(unlabeledImage.objectColors);
        } catch (error) {
          console.warn(`Failed to parse colors for ${unlabeledImage.id}:`, error);
        }
      }
      
      // Find matching candidates
      const matches = candidateImages.filter(candidate => {
        // Parse candidate colors
        let candidateColors: Array<{color: string, name: string}> | null = null;
        if (candidate.objectColors) {
          try {
            candidateColors = JSON.parse(candidate.objectColors);
          } catch (error) {
            console.warn(`Failed to parse colors for candidate ${candidate.id}:`, error);
          }
        }
        
        // Check both criteria: description match AND color match
        const descriptionMatches = hasMatchingDescription(unlabeledImage.objectDesc, candidate.objectDesc);
        const colorMatches = hasMatchingColors(unlabeledColors, candidateColors);
        
        return descriptionMatches && colorMatches;
      });
      
      if (matches.length === 0) {
        continue;
      }
      
      // Sort by timestamp (most recent first) and take the first match
      matches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const bestMatch = matches[0];
      
      // Ensure bestMatch exists and has a group
      if (!bestMatch || !bestMatch.group) {
        continue;
      }
      
      // Inherit the group from the best match
      const inheritedGroup = bestMatch.group;
      
      // Generate a smart filename for this inherited group (now updates DB directly)
      const { generateSmartFilename } = await import('../routes/upload');
      await generateSmartFilename(inheritedGroup, unlabeledImage.id, unlabeledImage.originalName);
      
      // Update other fields (excluding newName since generateSmartFilename handled it)
      await prisma.image.update({
        where: { id: unlabeledImage.id },
        data: {
          group: inheritedGroup,
          groupingStatus: 'complete',
          groupingConfidence: 0.7, // Lower confidence since it's inferred
          updatedAt: new Date()
        }
      });
      
      inferencesCount++;
      
      // Get updated image with new name for logging
      const updatedImage = await prisma.image.findUnique({ where: { id: unlabeledImage.id } });
      console.log(`🔗 Inferred group "${inheritedGroup}" for ${unlabeledImage.originalName} as ${updatedImage?.newName} (matched with ${bestMatch.originalName})`);
    }
    
    console.log(`✅ Group inference completed: ${inferencesCount} images grouped`);
    
  } catch (error) {
    console.error('❌ Error in group inference:', error);
  }
} 
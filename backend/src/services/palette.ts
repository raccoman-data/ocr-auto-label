import sharp from 'sharp';

export interface ColorPalette {
  color: string;
  percentage: number;
  name: string;
}

export interface PaletteResult {
  palette: ColorPalette[];
  confidence: number;
}

/**
 * Extract the top-5 color palette from an image buffer
 * Uses Sharp's built-in color analysis for reliable extraction
 * Focuses on center 50% of image to avoid background colors
 */
export async function extractColorPalette(
  imageBuffer: Buffer,
  maxColors: number = 5
): Promise<PaletteResult> {
  try {
    // First get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 400;
    const originalHeight = metadata.height || 400;
    
    // Calculate center crop dimensions (75% zoom = center 75% of image)
    const cropWidth = Math.floor(originalWidth * 0.75);
    const cropHeight = Math.floor(originalHeight * 0.75);
    const left = Math.floor((originalWidth - cropWidth) / 2);
    const top = Math.floor((originalHeight - cropHeight) / 2);

    // Crop to center 50% and resize for processing
    const processedBuffer = await sharp(imageBuffer)
      .extract({ 
        left: Math.max(0, left), 
        top: Math.max(0, top), 
        width: Math.min(cropWidth, originalWidth), 
        height: Math.min(cropHeight, originalHeight) 
      })
      .resize(400, 400, { 
        fit: 'inside',
        withoutEnlargement: true
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = processedBuffer;
    const { width, height, channels } = info;

    // Simple color quantization using k-means-like approach
    const colors = extractColorsFromPixels(data, width, height, channels, maxColors);
    
    // Calculate confidence based on color diversity
    const confidence = calculatePaletteConfidence(colors);

    return {
      palette: colors,
      confidence
    };

  } catch (error) {
    console.error('Error extracting color palette:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extract color palette: ${errorMessage}`);
  }
}

/**
 * Extract dominant colors from pixel data using simple quantization
 */
function extractColorsFromPixels(
  data: Buffer, 
  width: number, 
  height: number, 
  channels: number,
  maxColors: number
): ColorPalette[] {
  const pixels: { r: number; g: number; b: number }[] = [];
  
  // Sample every 4th pixel to reduce processing time
  const step = 4;
  for (let i = 0; i < data.length; i += channels * step) {
    if (i + 2 < data.length) {
      const r = data[i];
      const g = data[i + 1]; 
      const b = data[i + 2];
      
      if (r !== undefined && g !== undefined && b !== undefined) {
        pixels.push({ r, g, b });
      }
    }
  }

  // Group similar colors (simple quantization)
  const colorBuckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  
  for (const pixel of pixels) {
    // Quantize to reduce similar colors (divide by 32 and multiply back)
    const quantR = Math.floor(pixel.r / 32) * 32;
    const quantG = Math.floor(pixel.g / 32) * 32;
    const quantB = Math.floor(pixel.b / 32) * 32;
    
    const key = `${quantR}-${quantG}-${quantB}`;
    
    if (colorBuckets.has(key)) {
      const bucket = colorBuckets.get(key);
      if (bucket) {
        bucket.count++;
        bucket.r = Math.round((bucket.r * (bucket.count - 1) + pixel.r) / bucket.count);
        bucket.g = Math.round((bucket.g * (bucket.count - 1) + pixel.g) / bucket.count);
        bucket.b = Math.round((bucket.b * (bucket.count - 1) + pixel.b) / bucket.count);
      }
    } else {
      colorBuckets.set(key, { count: 1, r: pixel.r, g: pixel.g, b: pixel.b });
    }
  }

  // Sort by frequency and take top colors
  const sortedColors = Array.from(colorBuckets.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, maxColors);

  const totalPixels = pixels.length;
  
  return sortedColors.map(([, bucket], index) => ({
    color: rgbToHex(bucket.r, bucket.g, bucket.b),
    percentage: Math.round((bucket.count / totalPixels) * 100),
    name: index === 0 ? 'Dominant' : `Color ${index + 1}`
  }));
}

/**
 * Convert RGB values to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculate confidence score based on color diversity and distribution
 */
function calculatePaletteConfidence(colors: ColorPalette[]): number {
  if (colors.length === 0) return 0;

  // Base confidence on number of colors found
  let confidence = Math.min(colors.length / 5, 1) * 0.6;

  // Boost confidence for good percentage distribution
  const totalPercentage = colors.reduce((sum, color) => sum + color.percentage, 0);
  if (totalPercentage > 70) {
    confidence += 0.2;
  }

  // Boost confidence for color diversity (different hues)
  const uniqueHues = new Set(colors.map(color => getHue(color.color)));
  confidence += (uniqueHues.size / colors.length) * 0.2;

  return Math.min(confidence, 1);
}

/**
 * Extract hue from hex color for diversity calculation
 */
function getHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if (diff === 0) return 0;

  let hue = 0;
  if (max === r) {
    hue = ((g - b) / diff) % 6;
  } else if (max === g) {
    hue = (b - r) / diff + 2;
  } else {
    hue = (r - g) / diff + 4;
  }

  return Math.round(hue * 60);
}

/**
 * Compare two color palettes for similarity
 * Returns a score from 0 (no similarity) to 1 (identical)
 */
export function comparePalettes(palette1: ColorPalette[], palette2: ColorPalette[]): number {
  if (!palette1.length || !palette2.length) return 0;

  let matchingColors = 0;
  const threshold = 40; // Color similarity threshold

  for (const color1 of palette1) {
    for (const color2 of palette2) {
      if (colorDistance(color1.color, color2.color) < threshold) {
        matchingColors++;
        break; // Count each color only once
      }
    }
  }

  return matchingColors / Math.max(palette1.length, palette2.length);
}

/**
 * Calculate color distance using Delta E (simplified)
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
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
} 
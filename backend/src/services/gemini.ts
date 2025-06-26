import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import sharp from 'sharp';
import { isValidSampleCode as centralizedValidation, generateGeminiPromptPatterns } from '../lib/sampleCodePatterns';

export interface GeminiResult {
  code: string | null;
  otherText: string | null;
  objectDesc: string | null;
  objectColors: Array<{color: string, name: string}> | null;
  confidence: number;
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Preprocess image to enhance text visibility for OCR
 * Applies contrast enhancement, sharpening, and noise reduction
 */
async function preprocessImageForOCR(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB raw (~5.3 MB base64) – under 6 MB API cap

    // Quick resize if too large - minimal processing for speed
    if (imageBuffer.length > MAX_SIZE_BYTES) {
      return sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    // If small enough, just convert to JPEG with minimal processing
    return sharp(imageBuffer)
      .jpeg({ quality: 85 })
      .toBuffer();

  } catch (error) {
    console.warn('Image preprocessing failed, using original:', error);
    return imageBuffer;
  }
}

/**
 * Validate if a sample code follows the expected pattern
 * Uses centralized pattern validation from sampleCodePatterns.ts
 */
export function isValidSampleCode(code: string | null): boolean {
  return centralizedValidation(code);
}

/**
 * Extract text information from image using Gemini Flash Vision
 * Looks for sample codes (MWI.xxx or KEN.xxx) and other text content
 */
export async function extractTextFromImage(imagePath: string): Promise<GeminiResult> {
  const startTime = Date.now();
  try {
    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Read and preprocess image file for better OCR accuracy
    const imageStart = Date.now();
    const originalImageBuffer = await fs.readFile(imagePath);
    const imageBuffer = await preprocessImageForOCR(originalImageBuffer);
    console.log(`📸 Image processing: ${Date.now() - imageStart}ms`);
    
    // Get the generative model (Gemini 2.0 Flash - proven reliable for OCR)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0, // Deterministic results for OCR
      }
    });

    // Prepare the prompt for OCR extraction
    const prompt = `You are reading handwritten sample codes on laboratory labels. These codes are CRITICAL for research - accuracy is paramount.

SAMPLE CODE PATTERNS (must match exactly):
${generateGeminiPromptPatterns()}

CRITICAL READING RULES:
- Each segment is separated by a PERIOD (.)
- Count periods carefully - they separate distinct values
- When you see consecutive numbers, check if there's a period between them
- For letter+number combinations (like "1A"), the letter comes AFTER the number
- COMMON ERROR: "11A" should be read as "1.1A" (check for missing period)
- If a number seems too large for its position, look for a missed period

🚨 CRITICAL D/0 CONFUSION RULE 🚨:
- In MWI.1 codes, position 5 MUST be [number][letter]: like "1A", "2B", "7D", etc.
- If you see what looks like "10" in position 5, it's probably "1D" (letter D, not zero) - similarly B gets mistaken for 8
- The pattern REQUIRES a letter A-D after the number in position 5
- "10" alone is INVALID - position 5 needs format like "1D", "2A", "3B", etc.
- ALWAYS double-check: does the "0" look like it could be a "D"?
- Remember: D's are often mistaken for 0s in handwriting and B's are often mistaken for 8's.

VALIDATION PROCESS:
1. Read the code character by character
2. Check if your reading matches one of the three patterns exactly
3. If ANY segment violates the range constraints, re-examine for missed periods
4. Pay special attention to numbers > 10 in positions that only allow 1-10

SPECIFIC CONSTRAINTS TO CHECK:
- Position 4 in MWI.1.X.X.[1-10][A-D].X.X: Numbers 11+ are IMPOSSIBLE
- If you read "11A", "12B", etc. in this position, you MISSED a period
- The correct reading is likely "1.1A", "1.2B", etc.
- Position 5 in MWI.1.X.X.X.[1-10][A-D].X.X: MUST have format [number][letter]
- If you read "10" in position 5, re-examine - it should be "1D" (D not 0)
- If you read "20", "30", etc. in position 5, look for the missing letter (probably D or B)
- Numbers 11+ alone in position 5 are IMPOSSIBLE - check for missed periods
- Position 5 examples: "1A", "2B", "7D", "10A" - never just "10"

SELF-VALIDATION CHECKLIST:
- Does the code start with "MWI" or "KEN"? 
- Are there exactly 5 or 6 periods?
- Does each numeric segment fall within the specified ranges?
- Are letters only A-D and only after numbers in allowed positions?
- If ANY constraint fails, re-examine the handwriting for missed periods

READ CHARACTER BY CHARACTER, validate against patterns, and self-correct if needed.

Additionally, analyze the PRIMARY OBJECT (not background) and extract its top 3 most prominent colors.

Respond only with JSON:
{
  "code": "MWI… or KEN… sample code if found, otherwise NA",
  "codeConfidence": 0.85,
  "otherText": "Any other text visible in the image, otherwise NA", 
  "objectDesc": "Describe the main object in 3 words or less, otherwise NA",
  "objectColors": [
    {"color": "#RRGGBB", "name": "descriptive color name"},
    {"color": "#RRGGBB", "name": "descriptive color name"},
    {"color": "#RRGGBB", "name": "descriptive color name"}
  ]
We }

CONFIDENCE SCORING for "codeConfidence" (0.0 to 1.0):
- 0.9-1.0: Crystal clear, perfectly legible handwriting, all segments clearly visible
- 0.7-0.9: Clear handwriting with the full code visible with minor ambiguity in 1-2 characters
- 0.5-0.7: Readable but some characters are unclear or smudged, full code may not be visible
- 0.3-0.5: Difficult to read, multiple characters uncertain
- 0.1-0.3: Very poor quality, mostly guessing
- 0.0: No code visible or completely illegible

Set codeConfidence to 0.0 if code is "NA".`;

    // Convert image to base64 for Gemini API
    const imageBase64 = imageBuffer.toString('base64');
    
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg', // Gemini accepts various formats
      },
    };

    // Generate content with image and prompt - with retry logic
    let text: string = '';
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        text = response.text();
        break; // Success, exit retry loop
        
      } catch (error: any) {
        console.log(`Gemini API attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error; // Re-throw on final attempt
        }
        
        // Shorter backoff: only 500ms instead of 1s, 2s, 4s
        console.log(`Retrying in 500ms...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Parse the JSON response - handle markdown code blocks
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
      jsonText = jsonText.slice(7, -3).trim(); // Remove ```json and ```
    } else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
      jsonText = jsonText.slice(3, -3).trim(); // Remove generic ```
    }
    
    try {
      const parsed = JSON.parse(jsonText);
      
      // Clean up the response - convert "NA" to null and use Gemini's confidence
      const code = parsed.code === 'NA' ? null : parsed.code;
      const otherText = parsed.otherText === 'NA' ? null : parsed.otherText;
      const objectDesc = parsed.objectDesc === 'NA' ? null : parsed.objectDesc;
      const objectColors = parsed.objectColors && Array.isArray(parsed.objectColors) && parsed.objectColors.length > 0 ? parsed.objectColors : null;
      
      // Use Gemini's confidence score for the code detection
      const confidence = parsed.codeConfidence || 0;

      return {
        code,
        otherText,
        objectDesc,
        objectColors,
        confidence
      };

    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', jsonText);
      console.error('Original response:', text);
      throw new Error(`Invalid JSON response from Gemini: ${jsonText}`);
    }

  } catch (error) {
    console.error('Error in Gemini text extraction:', error);
    
    // Return error result
    return {
      code: null,
      otherText: null,
      objectDesc: null,
      objectColors: null,
      confidence: 0
    };
  }
} 
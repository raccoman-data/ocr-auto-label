import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import sharp from 'sharp';

export interface GeminiResult {
  code: string | null;
  otherText: string | null;
  objectDesc: string | null;
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
    return await sharp(imageBuffer)
      // Enhance contrast to make text more distinct
      .normalize()
      // Sharpen the image to make text edges clearer
      .sharpen(1.5, 1, 2)
      // Increase contrast further
      .linear(1.2, -(128 * 1.2) + 128)
      // Convert back to JPEG with high quality
      .jpeg({ quality: 95 })
      .toBuffer();
  } catch (error) {
    console.warn('Image preprocessing failed, using original:', error);
    return imageBuffer;
  }
}

/**
 * Extract text information from image using Gemini Flash Vision
 * Looks for sample codes (MWI.xxx or KEN.xxx) and other text content
 */
export async function extractTextFromImage(imagePath: string): Promise<GeminiResult> {
  try {
    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Read and preprocess image file for better OCR accuracy
    const originalImageBuffer = await fs.readFile(imagePath);
    const imageBuffer = await preprocessImageForOCR(originalImageBuffer);
    
    // Get the generative model (Gemini 1.5 Flash - proven reliable for OCR)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0, // Deterministic results for OCR
      }
    });

    // Prepare the prompt for OCR extraction
    const prompt = `You are reading handwritten sample codes on laboratory labels. These codes are CRITICAL for research - accuracy is paramount.

SAMPLE CODE PATTERNS (must match exactly):
1. MWI.1.[1-3].[1-24].[1-10][A-D].[1-25].[1-12] 
   Example: MWI.1.2.15.7B.12.8 (exactly 6 periods, 7 segments)

2. MWI.0.[1-3].[1-6].[1-13].[1-27].[1-12]
   Example: MWI.0.1.4.10.15.7 (exactly 5 periods, 6 segments)

3. KEN.0.[1-2].[1-9].[1-8].[1-11].[1-12]
   Example: KEN.0.2.3.5.8.11 (exactly 5 periods, 6 segments)

CRITICAL READING RULES:
- Each segment is separated by a PERIOD (.)
- Count periods carefully - they separate distinct values
- When you see consecutive numbers, check if there's a period between them
- For letter+number combinations (like "1A"), the letter comes AFTER the number
- COMMON ERROR: "11A" should be read as "1.1A" (check for missing period)
- If a number seems too large for its position, look for a missed period

VALIDATION PROCESS:
1. Read the code character by character
2. Check if your reading matches one of the three patterns exactly
3. If ANY segment violates the range constraints, re-examine for missed periods
4. Pay special attention to numbers > 10 in positions that only allow 1-10

SPECIFIC CONSTRAINTS TO CHECK:
- Position 4 in MWI.1.X.X.[1-10][A-D].X.X: Numbers 11+ are IMPOSSIBLE
- If you read "11A", "12B", etc. in this position, you MISSED a period
- The correct reading is likely "1.1A", "1.2B", etc.

SELF-VALIDATION CHECKLIST:
- Does the code start with "MWI" or "KEN"? 
- Are there exactly 5 or 6 periods?
- Does each numeric segment fall within the specified ranges?
- Are letters only A-D and only after numbers in allowed positions?
- If ANY constraint fails, re-examine the handwriting for missed periods

READ CHARACTER BY CHARACTER, validate against patterns, and self-correct if needed.

Respond only with JSON:
{
  "code": "MWI… or KEN… sample code if found, otherwise NA",
  "otherText": "Any other text visible in the image, otherwise NA", 
  "objectDesc": "Describe the main object in 3 words or less, otherwise NA"
}`;

    // Convert image to base64 for Gemini API
    const imageBase64 = imageBuffer.toString('base64');
    
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg', // Gemini accepts various formats
      },
    };

    // Generate content with image and prompt
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

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
      
      // Clean up the response - convert "NA" to null and calculate confidence
      const code = parsed.code === 'NA' ? null : parsed.code;
      const otherText = parsed.otherText === 'NA' ? null : parsed.otherText;
      const objectDesc = parsed.objectDesc === 'NA' ? null : parsed.objectDesc;
      
      // Calculate confidence based on what was found
      let confidence = 0.5; // Base confidence
      if (code) confidence += 0.4; // High value for finding sample code
      if (otherText) confidence += 0.1; // Some value for other text
      if (objectDesc) confidence += 0.1; // Some value for object description
      confidence = Math.min(confidence, 1.0); // Cap at 1.0

      return {
        code,
        otherText,
        objectDesc,
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
      confidence: 0
    };
  }
} 
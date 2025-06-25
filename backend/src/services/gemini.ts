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
    const prompt = `Read the handwritten text on this sample label. Look for a code that starts with "MWI" or "KEN" followed by numbers and letters separated by periods.

Pattern: MWI.1.2.3.4A.5 (numbers, then number+letter, then number)

Be very careful to read every character exactly as written, including all periods between segments.

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
/**
 * Centralized Sample Code Pattern Configuration (Backend)
 * 
 * This file defines all valid sample code patterns in a human-readable format.
 * To add a new pattern, simply add it to the patterns array below.
 * 
 * No regex knowledge required! Just specify the ranges for each segment.
 * 
 * This is a duplicate of frontend/src/lib/sampleCodePatterns.ts to ensure
 * backend and frontend validation stays in sync.
 */

export interface SampleCodeSegment {
  name: string;
  description: string;
  type: 'fixed' | 'range' | 'rangeWithLetters';
  value?: string; // For fixed values like "MWI" or "0"
  min?: number;   // For ranges like 1-24
  max?: number;
  letters?: string[]; // For segments that can have letters like "A", "B", "C", "D"
}

export interface SampleCodePattern {
  id: string;
  name: string;
  description: string;
  example: string;
  segments: SampleCodeSegment[];
}

/**
 * Define all valid sample code patterns here
 * To add a new pattern, copy an existing one and modify the values
 */
export const SAMPLE_CODE_PATTERNS: SampleCodePattern[] = [
  {
    id: 'mwi_type_1',
    name: 'MWI Type 1',
    description: 'Malawi Type 1 sample codes',
    example: 'MWI.1.2.15.7B.12.8',
    segments: [
      { name: 'Country', description: 'Country code', type: 'fixed', value: 'MWI' },
      { name: 'Study Type', description: 'Study type', type: 'fixed', value: '1' },
      { name: 'Region', description: 'Geographic region', type: 'range', min: 1, max: 3 },
      { name: 'Area', description: 'Area within region', type: 'range', min: 1, max: 24 },
      { name: 'Sample', description: 'Sample number with letter', type: 'rangeWithLetters', min: 1, max: 10, letters: ['A', 'B', 'C', 'D'] },
      { name: 'Batch', description: 'Batch number', type: 'range', min: 1, max: 30 },
      { name: 'Month', description: 'Collection month', type: 'range', min: 1, max: 12 }
    ]
  },
  {
    id: 'mwi_type_0',
    name: 'MWI Type 0',
    description: 'Malawi Type 0 sample codes',
    example: 'MWI.0.1.4.10.15.7',
    segments: [
      { name: 'Country', description: 'Country code', type: 'fixed', value: 'MWI' },
      { name: 'Study Type', description: 'Study type', type: 'fixed', value: '0' },
      { name: 'Region', description: 'Geographic region', type: 'range', min: 1, max: 3 },
      { name: 'Area', description: 'Area within region', type: 'range', min: 1, max: 6 },
      { name: 'Sample', description: 'Sample number', type: 'range', min: 1, max: 13 },
      { name: 'Batch', description: 'Batch number', type: 'range', min: 1, max: 27 },
      { name: 'Month', description: 'Collection month', type: 'range', min: 1, max: 12 }
    ]
  },
  {
    id: 'ken_type_0',
    name: 'KEN Type 0',
    description: 'Kenya Type 0 sample codes',
    example: 'KEN.0.2.3.5.8.11',
    segments: [
      { name: 'Country', description: 'Country code', type: 'fixed', value: 'KEN' },
      { name: 'Study Type', description: 'Study type', type: 'fixed', value: '0' },
      { name: 'Region', description: 'Geographic region', type: 'range', min: 1, max: 2 },
      { name: 'Area', description: 'Area within region', type: 'range', min: 1, max: 9 },
      { name: 'Sample', description: 'Sample number', type: 'range', min: 1, max: 8 },
      { name: 'Batch', description: 'Batch number', type: 'range', min: 1, max: 11 },
      { name: 'Month', description: 'Collection month', type: 'range', min: 1, max: 12 }
    ]
  }
];

/**
 * Validates a sample code against all defined patterns
 * This replaces the need for complex regex patterns
 */
export function isValidSampleCode(code: string | null): boolean {
  if (!code) return false;
  
  const trimmedCode = code.trim().toUpperCase();
  const segments = trimmedCode.split('.');
  
  // Try each pattern
  for (const pattern of SAMPLE_CODE_PATTERNS) {
    if (segments.length !== pattern.segments.length) continue;
    
    let isValid = true;
    
    for (let i = 0; i < pattern.segments.length; i++) {
      const segment = segments[i];
      const definition = pattern.segments[i];
      
      if (!segment || !definition) {
        isValid = false;
        break;
      }
      
      if (definition.type === 'fixed') {
        if (segment !== definition.value) {
          isValid = false;
          break;
        }
      } else if (definition.type === 'range') {
        const num = parseInt(segment);
        const min = definition.min ?? 0;
        const max = definition.max ?? 0;
        if (isNaN(num) || num < min || num > max) {
          isValid = false;
          break;
        }
      } else if (definition.type === 'rangeWithLetters') {
        // Handle formats like "7B" where number is followed by letter
        const match = segment.match(/^(\d+)([A-Z])$/);
        if (!match) {
          isValid = false;
          break;
        }
        
        const num = parseInt(match[1]);
        const letter = match[2];
        const min = definition.min ?? 0;
        const max = definition.max ?? 0;
        const letters = definition.letters ?? [];
        
        if (num < min || num > max || !letters.includes(letter)) {
          isValid = false;
          break;
        }
      }
    }
    
    if (isValid) return true;
  }
  
  return false;
}

/**
 * Generate a human-readable description of a pattern in Gemini format
 * This creates the exact format Gemini expects: MWI.1.[1-3].[1-24].[1-10][A-D].[1-30].[1-12]
 */
function getPatternDescription(pattern: SampleCodePattern): string {
  const parts = pattern.segments.map(segment => {
    if (segment.type === 'fixed') {
      return segment.value || '';
    } else if (segment.type === 'range') {
      const min = segment.min ?? 0;
      const max = segment.max ?? 0;
      return `[${min}-${max}]`;
    } else if (segment.type === 'rangeWithLetters') {
      const min = segment.min ?? 0;
      const max = segment.max ?? 0;
      const letters = segment.letters ?? [];
      // Format as [1-10][A-D] instead of [1-10][A/B/C/D]  
      const letterRange = letters.length > 1 ? `${letters[0]}-${letters[letters.length - 1]}` : letters[0] || '';
      return `[${min}-${max}][${letterRange}]`;
    }
    return '?';
  });
  
  return parts.join('.');
}

/**
 * Generate the EXACT Gemini prompt patterns that match the original format
 * This ensures Gemini sees identical patterns as before, but pulled from config
 */
export function generateGeminiPromptPatterns(): string {
  return SAMPLE_CODE_PATTERNS.map((pattern, index) => {
    const patternSyntax = getPatternDescription(pattern);
    let result = `${index + 1}. ${patternSyntax}\n   Example: ${pattern.example} (exactly ${pattern.segments.length - 1} periods, ${pattern.segments.length} segments)`;
    
    // Add special notes for MWI.1 pattern (the D/0 confusion note)
    if (pattern.id === 'mwi_type_1') {
      result += '\n   Common D/0 case: MWI.1.1.18.1D.7.11 (NOT MWI.1.1.18.10.7.11)';
    }
    
    return result;
  }).join('\n\n');
} 
/**
 * Centralized Sample Code Pattern Configuration
 * 
 * This file defines all valid sample code patterns in a human-readable format.
 * To add a new pattern, simply add it to the patterns array below.
 * 
 * No regex knowledge required! Just specify the ranges for each segment.
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
      
      if (definition.type === 'fixed') {
        if (segment !== definition.value) {
          isValid = false;
          break;
        }
      } else if (definition.type === 'range') {
        const num = parseInt(segment);
        if (isNaN(num) || num < definition.min! || num > definition.max!) {
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
        
        if (num < definition.min! || num > definition.max! || !definition.letters!.includes(letter)) {
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
 * Get validation errors for a sample code
 * Returns human-readable error messages
 */
export function validateSampleCode(code: string | null): string[] {
  if (!code) return ['Sample code is required'];
  
  const trimmedCode = code.trim().toUpperCase();
  const segments = trimmedCode.split('.');
  const errors: string[] = [];
  
  // Find the closest matching pattern
  for (const pattern of SAMPLE_CODE_PATTERNS) {
    if (segments.length !== pattern.segments.length) continue;
    
    const patternErrors: string[] = [];
    
    for (let i = 0; i < pattern.segments.length; i++) {
      const segment = segments[i];
      const definition = pattern.segments[i];
      
      if (definition.type === 'fixed') {
        if (segment !== definition.value) {
          patternErrors.push(`${definition.name} must be "${definition.value}", got "${segment}"`);
        }
      } else if (definition.type === 'range') {
        const num = parseInt(segment);
        if (isNaN(num)) {
          patternErrors.push(`${definition.name} must be a number, got "${segment}"`);
        } else if (num < definition.min! || num > definition.max!) {
          patternErrors.push(`${definition.name} must be between ${definition.min}-${definition.max}, got ${num}`);
        }
      } else if (definition.type === 'rangeWithLetters') {
        const match = segment.match(/^(\d+)([A-Z])$/);
        if (!match) {
          patternErrors.push(`${definition.name} must be a number followed by a letter (${definition.letters!.join('/')}) like "7B", got "${segment}"`);
        } else {
          const num = parseInt(match[1]);
          const letter = match[2];
          
          if (num < definition.min! || num > definition.max!) {
            patternErrors.push(`${definition.name} number must be between ${definition.min}-${definition.max}, got ${num}`);
          }
          if (!definition.letters!.includes(letter)) {
            patternErrors.push(`${definition.name} letter must be one of: ${definition.letters!.join(', ')}, got "${letter}"`);
          }
        }
      }
    }
    
    // If this pattern had fewer errors, use it
    if (patternErrors.length === 0) return []; // Valid!
    if (errors.length === 0 || patternErrors.length < errors.length) {
      errors.splice(0, errors.length, ...patternErrors);
    }
  }
  
  // If no patterns matched at all
  if (errors.length === 0) {
    errors.push(`Invalid format. Expected one of: ${SAMPLE_CODE_PATTERNS.map(p => p.example).join(', ')}`);
  }
  
  return errors;
}

/**
 * Get all valid pattern examples for display
 */
export function getValidPatternExamples(): string[] {
  return SAMPLE_CODE_PATTERNS.map(pattern => `${pattern.example} (${pattern.description})`);
}

/**
 * Generate a human-readable description of a pattern
 */
export function getPatternDescription(pattern: SampleCodePattern): string {
  const parts = pattern.segments.map(segment => {
    if (segment.type === 'fixed') {
      return segment.value;
    } else if (segment.type === 'range') {
      return `[${segment.min}-${segment.max}]`;
    } else if (segment.type === 'rangeWithLetters') {
      return `[${segment.min}-${segment.max}][${segment.letters!.join('/')}]`;
    }
    return '?';
  });
  
  return parts.join('.');
}

/**
 * Generate the exact pattern syntax that Gemini expects
 */
export function generateGeminiPromptPatterns(): string {
  return SAMPLE_CODE_PATTERNS.map((pattern, index) => {
    const patternSyntax = getPatternDescription(pattern);
    return `${index + 1}. ${patternSyntax}\n   Example: ${pattern.example} (exactly ${pattern.segments.length - 1} periods, ${pattern.segments.length} segments)`;
  }).join('\n\n');
} 
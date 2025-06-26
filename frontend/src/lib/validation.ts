/**
 * Sample code validation utilities
 * Validates codes against the predefined patterns used in the Gemini service
 */

export interface ValidationResult {
  isValid: boolean;
  pattern?: string;
  errors: string[];
  warnings: string[];
}

// Define the expected patterns from the Gemini service
const SAMPLE_CODE_PATTERNS = {
  MWI_TYPE_1: {
    pattern: /^MWI\.1\.[1-3]\.\d+\.[1-9]\d*[A-D]\.\d+\.\d+$/,
    description: 'MWI.1.[1-3].[1-24].[1-10][A-D].[1-25].[1-12]',
    segments: 7,
    periods: 6,
    validate: (segments: string[]) => {
      const [prefix, type, region, area, sample, batch, month] = segments;
      const errors: string[] = [];
      
      if (prefix !== 'MWI') errors.push('Must start with MWI');
      if (type !== '1') errors.push('Second segment must be 1 for this pattern');
      
      const regionNum = parseInt(region);
      if (regionNum < 1 || regionNum > 3) errors.push('Region must be 1-3');
      
      const areaNum = parseInt(area);
      if (areaNum < 1 || areaNum > 24) errors.push('Area must be 1-24');
      
      // Sample should be [1-10][A-D]
      const sampleMatch = sample.match(/^(\d+)([A-D])$/);
      if (!sampleMatch) {
        errors.push('Sample must be number followed by letter A-D');
      } else {
        const sampleNum = parseInt(sampleMatch[1]);
        if (sampleNum < 1 || sampleNum > 10) errors.push('Sample number must be 1-10');
      }
      
      const batchNum = parseInt(batch);
      if (batchNum < 1 || batchNum > 25) errors.push('Batch must be 1-25');
      
      const monthNum = parseInt(month);
      if (monthNum < 1 || monthNum > 12) errors.push('Month must be 1-12');
      
      return errors;
    }
  },
  
  MWI_TYPE_0: {
    pattern: /^MWI\.0\.[1-3]\.\d+\.\d+\.\d+\.\d+$/,
    description: 'MWI.0.[1-3].[1-6].[1-13].[1-27].[1-12]',
    segments: 6,
    periods: 5,
    validate: (segments: string[]) => {
      const [prefix, type, region, area, sample, batch, month] = segments;
      const errors: string[] = [];
      
      if (prefix !== 'MWI') errors.push('Must start with MWI');
      if (type !== '0') errors.push('Second segment must be 0 for this pattern');
      
      const regionNum = parseInt(region);
      if (regionNum < 1 || regionNum > 3) errors.push('Region must be 1-3');
      
      const areaNum = parseInt(area);
      if (areaNum < 1 || areaNum > 6) errors.push('Area must be 1-6');
      
      const sampleNum = parseInt(sample);
      if (sampleNum < 1 || sampleNum > 13) errors.push('Sample must be 1-13');
      
      const batchNum = parseInt(batch);
      if (batchNum < 1 || batchNum > 27) errors.push('Batch must be 1-27');
      
      const monthNum = parseInt(month);
      if (monthNum < 1 || monthNum > 12) errors.push('Month must be 1-12');
      
      return errors;
    }
  },
  
  KEN_TYPE_0: {
    pattern: /^KEN\.0\.[1-2]\.\d+\.\d+\.\d+\.\d+$/,
    description: 'KEN.0.[1-2].[1-9].[1-8].[1-11].[1-12]',
    segments: 6,
    periods: 5,
    validate: (segments: string[]) => {
      const [prefix, type, region, area, sample, batch, month] = segments;
      const errors: string[] = [];
      
      if (prefix !== 'KEN') errors.push('Must start with KEN');
      if (type !== '0') errors.push('Second segment must be 0 for this pattern');
      
      const regionNum = parseInt(region);
      if (regionNum < 1 || regionNum > 2) errors.push('Region must be 1-2');
      
      const areaNum = parseInt(area);
      if (areaNum < 1 || areaNum > 9) errors.push('Area must be 1-9');
      
      const sampleNum = parseInt(sample);
      if (sampleNum < 1 || sampleNum > 8) errors.push('Sample must be 1-8');
      
      const batchNum = parseInt(batch);
      if (batchNum < 1 || batchNum > 11) errors.push('Batch must be 1-11');
      
      const monthNum = parseInt(month);
      if (monthNum < 1 || monthNum > 12) errors.push('Month must be 1-12');
      
      return errors;
    }
  }
};

/**
 * Validates a sample code against all known patterns
 */
export function validateSampleCode(code: string | null | undefined): ValidationResult {
  if (!code || typeof code !== 'string') {
    return {
      isValid: false,
      errors: ['No code provided'],
      warnings: []
    };
  }

  const trimmedCode = code.trim();
  
  if (!trimmedCode) {
    return {
      isValid: false,
      errors: ['Code is empty'],
      warnings: []
    };
  }

  // Split by periods to check structure
  const segments = trimmedCode.split('.');
  const warnings: string[] = [];

  // Check against each pattern
  for (const [patternName, patternDef] of Object.entries(SAMPLE_CODE_PATTERNS)) {
    // Check segment count first
    if (segments.length === patternDef.segments) {
      // Run detailed validation
      const errors = patternDef.validate(segments);
      
      if (errors.length === 0) {
        return {
          isValid: true,
          pattern: patternDef.description,
          errors: [],
          warnings: []
        };
      } else {
        // Partial match - right structure but wrong values
        return {
          isValid: false,
          pattern: patternDef.description,
          errors: errors,
          warnings: [`Code structure matches ${patternDef.description} but has invalid values`]
        };
      }
    }
  }

  // No pattern matched - provide helpful feedback
  const errors: string[] = [];
  
  if (segments.length < 6) {
    errors.push(`Too few segments (${segments.length}). Expected 6-7 segments separated by periods.`);
  } else if (segments.length > 7) {
    errors.push(`Too many segments (${segments.length}). Expected 6-7 segments separated by periods.`);
  } else {
    errors.push('Code structure does not match any known pattern');
  }

  const prefix = segments[0];
  if (!['MWI', 'KEN'].includes(prefix)) {
    errors.push('Code must start with MWI or KEN');
  }

  return {
    isValid: false,
    errors,
    warnings: [
      'Expected patterns:',
      '• MWI.1.[1-3].[1-24].[1-10][A-D].[1-25].[1-12]',
      '• MWI.0.[1-3].[1-6].[1-13].[1-27].[1-12]',
      '• KEN.0.[1-2].[1-9].[1-8].[1-11].[1-12]'
    ]
  };
}

/**
 * Get validation status for display in UI
 */
export function getValidationStatus(code: string | null | undefined): 'valid' | 'invalid' | 'unknown' {
  if (!code) return 'unknown';
  
  const result = validateSampleCode(code);
  if (result.isValid) return 'valid';
  return 'invalid';
}

/**
 * Get a short validation message for tooltips
 */
export function getValidationMessage(code: string | null | undefined): string {
  if (!code) return 'No code detected';
  
  const result = validateSampleCode(code);
  
  if (result.isValid) {
    return `✓ Valid: ${result.pattern}`;
  }
  
  if (result.errors.length > 0) {
    return `✗ Invalid: ${result.errors[0]}`;
  }
  
  return '✗ Invalid code format';
} 
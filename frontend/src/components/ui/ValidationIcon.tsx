import React from 'react';
import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getValidationStatus, getValidationMessage, validateSampleCode } from '../../lib/validation';

interface ValidationIconProps {
  code: string | null | undefined;
  className?: string;
  showTooltip?: boolean;
}

/**
 * ValidationIcon component
 * Displays validation status for sample codes with appropriate colors and icons
 */
export function ValidationIcon({ code, className, showTooltip = true }: ValidationIconProps) {
  const status = getValidationStatus(code);
  const message = getValidationMessage(code);
  const validation = validateSampleCode(code);

  // Determine icon and styling based on validation status
  const getStatusConfig = () => {
    switch (status) {
      case 'valid':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          title: 'Valid Code'
        };
      case 'invalid':
        return {
          icon: AlertTriangle,
          color: 'text-red-600', 
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          title: 'Invalid Code'
        };
      case 'unknown':
      default:
        return {
          icon: HelpCircle,
          color: 'text-gray-400',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          title: 'No Code'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Create detailed tooltip content
  const getTooltipContent = () => {
    if (!showTooltip) return null;

    let content = message;
    
    if (validation.errors.length > 0) {
      content += '\n\nErrors:\n' + validation.errors.map(e => `• ${e}`).join('\n');
    }
    
    if (validation.warnings.length > 0) {
      content += '\n\nExpected formats:\n' + validation.warnings.slice(1).join('\n');
    }

    return content;
  };

  const tooltipContent = getTooltipContent();

  return (
    <div 
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors',
        config.bgColor,
        config.borderColor,
        className
      )}
      title={tooltipContent || undefined}
    >
      <Icon 
        className={cn('w-3 h-3', config.color)} 
        strokeWidth={2}
      />
    </div>
  );
}

/**
 * Detailed validation display component for use in sidebars or forms
 */
interface ValidationDetailsProps {
  code: string | null | undefined;
  className?: string;
}

export function ValidationDetails({ code, className }: ValidationDetailsProps) {
  const validation = validateSampleCode(code);
  const status = getValidationStatus(code);

  if (!code) {
    return (
      <div className={cn('text-sm text-gray-500', className)}>
        No code detected
      </div>
    );
  }

  return (
    <div className={cn('text-sm space-y-2', className)}>
      <div className="flex items-center gap-2">
        <ValidationIcon code={code} showTooltip={false} />
        <span className={cn(
          'font-medium',
          status === 'valid' ? 'text-green-700' : status === 'invalid' ? 'text-red-700' : 'text-gray-700'
        )}>
          {status === 'valid' ? 'Valid Code' : status === 'invalid' ? 'Invalid Code' : 'Unknown Format'}
        </span>
      </div>

      {validation.pattern && (
        <div className="text-xs text-gray-600">
          Pattern: {validation.pattern}
        </div>
      )}

      {validation.errors.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-red-700">Issues:</div>
          <ul className="text-xs text-red-600 space-y-1">
            {validation.errors.map((error, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-red-400">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && status === 'invalid' && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-amber-700">Expected formats:</div>
          <ul className="text-xs text-amber-600 space-y-1">
            {validation.warnings.slice(1).map((warning, index) => (
              <li key={index} className="font-mono">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 
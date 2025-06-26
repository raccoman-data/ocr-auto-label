import React from 'react';
import { Palette, Brain, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProcessingStatus } from '@/types';
import { ValidationIcon } from '../ui/ValidationIcon';

interface StatusIconsProps {
  paletteStatus: ProcessingStatus;
  geminiStatus: ProcessingStatus;
  groupingStatus: ProcessingStatus;
  paletteConfidence?: number;
  geminiConfidence?: number;
  groupingConfidence?: number;
  hasCode?: boolean; // Whether Gemini found a sample code
  code?: string | null; // The detected code for validation
}

export function StatusIcons({ 
  paletteStatus, 
  geminiStatus, 
  groupingStatus,
  paletteConfidence,
  geminiConfidence,
  groupingConfidence,
  hasCode,
  code
}: StatusIconsProps) {
  
  const getStatusIcon = (
    status: ProcessingStatus, 
    Icon: React.ComponentType<any>, 
    label: string,
    confidence?: number,
    isGemini: boolean = false
  ) => {
    const baseClasses = "w-5 h-5 transition-all duration-200";
    const confidenceText = confidence ? ` (${(confidence * 100).toFixed(1)}%)` : '';
    
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted" title={`${label}: Pending${confidenceText}`}>
            <Icon className={cn(baseClasses, isGemini ? "text-yellow-500" : "text-muted-foreground/40")} />
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 animate-pulse" title={`${label}: Processing${confidenceText}`}>
            <Icon className={cn(baseClasses, isGemini ? "text-yellow-600" : "text-amber-600")} />
          </div>
        );
      case 'complete':
        // For Gemini: green if code found, blue if no code found
        if (isGemini) {
          const bgColor = hasCode ? "bg-emerald-100" : "bg-blue-100";
          const iconColor = hasCode ? "text-emerald-600" : "text-blue-600";
          const statusText = hasCode ? "Code Found" : "No Code Found";
          return (
            <div className={`flex items-center justify-center w-7 h-7 rounded-full ${bgColor}`} title={`${label}: ${statusText}${confidenceText}`}>
              <Icon className={cn(baseClasses, iconColor)} />
            </div>
          );
        }
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100" title={`${label}: Complete${confidenceText}`}>
            <Icon className={cn(baseClasses, "text-emerald-600")} />
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-100" title={`${label}: Error${confidenceText}`}>
            <Icon className={cn(baseClasses, "text-red-600")} />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted" title={`${label}: Unknown${confidenceText}`}>
            <Icon className={cn(baseClasses, "text-muted-foreground/40")} />
          </div>
        );
    }
  };

  return (
    <div className="flex items-center justify-center gap-1">
      {/* Palette Status */}
      {getStatusIcon(paletteStatus, Palette, 'Color Palette', paletteConfidence)}
      
      {/* Gemini Status */}
      {getStatusIcon(geminiStatus, Brain, 'Code Detection', geminiConfidence, true)}
      
      {/* Grouping Status */}
      {getStatusIcon(groupingStatus, Link2, 'Grouping', groupingConfidence)}
      
      {/* Validation Status - Only show when Gemini has found a code */}
      {hasCode && code && (
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-50" title="Code Format Validation">
          <ValidationIcon code={code} className="w-5 h-5" />
        </div>
      )}
    </div>
  );
} 
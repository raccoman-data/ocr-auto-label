import React from 'react';
import { Palette, Brain, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProcessingStatus } from '@/types';

interface StatusIconsProps {
  paletteStatus: ProcessingStatus;
  geminiStatus: ProcessingStatus;
  groupingStatus: ProcessingStatus;
  paletteConfidence?: number;
  geminiConfidence?: number;
  groupingConfidence?: number;
}

export function StatusIcons({ 
  paletteStatus, 
  geminiStatus, 
  groupingStatus,
  paletteConfidence,
  geminiConfidence,
  groupingConfidence
}: StatusIconsProps) {
  
  const getStatusIcon = (
    status: ProcessingStatus, 
    Icon: React.ComponentType<any>, 
    label: string,
    confidence?: number
  ) => {
    const baseClasses = "w-5 h-5 transition-all duration-200";
    const confidenceText = confidence ? ` (${(confidence * 100).toFixed(1)}%)` : '';
    
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted" title={`${label}: Pending${confidenceText}`}>
            <Icon className={cn(baseClasses, "text-muted-foreground/40")} />
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 animate-pulse" title={`${label}: Processing${confidenceText}`}>
            <Icon className={cn(baseClasses, "text-amber-600")} />
          </div>
        );
      case 'complete':
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
      {getStatusIcon(geminiStatus, Brain, 'Code Detection', geminiConfidence)}
      
      {/* Grouping Status */}
      {getStatusIcon(groupingStatus, Link2, 'Grouping', groupingConfidence)}
    </div>
  );
} 
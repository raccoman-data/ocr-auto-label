import React, { useMemo } from 'react';
import { useImageStore } from '@/stores/imageStore';

export function ProcessingStatus() {
  const { images } = useImageStore();

  const status = useMemo(() => {
    if (images.length === 0) {
      return null;
    }

    // Count statuses
    const statusCounts = images.reduce((acc, img) => {
      const status = img.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = images.length;
    const pending = statusCounts.pending || 0;
    const extracting = statusCounts.extracting || 0;
    const extracted = statusCounts.extracted || 0;
    const pendingGrouping = statusCounts.pending_grouping || 0;
    const grouping = statusCounts.grouping || 0;
    const autoGrouped = statusCounts.auto_grouped || 0;
    const userGrouped = statusCounts.user_grouped || 0;
    const invalidGroup = statusCounts.invalid_group || 0;
    const ungrouped = statusCounts.ungrouped || 0;

    // Calculate progress
    const extractionComplete = extracted + pendingGrouping + grouping + autoGrouped + userGrouped + invalidGroup + ungrouped;
    const allProcessingComplete = extracted + autoGrouped + userGrouped + invalidGroup + ungrouped;

    // Determine state
    if (extracting > 0 || pending > 0) {
      const progress = Math.round((extractionComplete / total) * 100);
      return {
        text: 'Extracting with AI',
        progress: `${progress}%`,
        color: 'bg-blue-50/70 border-blue-200/60',
        textColor: 'text-blue-600',
        isActive: true
      };
    } else if (grouping > 0 || pendingGrouping > 0) {
      const progress = Math.round((allProcessingComplete / total) * 100);
      return {
        text: 'Auto Grouping',
        progress: `${progress}%`,
        color: 'bg-purple-50/70 border-purple-200/60',
        textColor: 'text-purple-600',
        isActive: true
      };
    } else {
      return {
        text: `${total} ready for review`,
        progress: null,
        color: 'bg-green-50/70 border-green-200/60',
        textColor: 'text-green-600',
        isActive: false
      };
    }
  }, [images]);

  if (!status) {
    return null;
  }

  return (
    <div className={`
      inline-flex items-center rounded-md border text-sm h-9
      transition-all duration-300
      ${status.color} ${status.textColor}
    `}>
      <div className="flex items-center gap-2 px-3 min-w-0">
        <div className="w-1.5 h-1.5 flex-shrink-0">
          {status.isActive && (
            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
          )}
        </div>
        
        <span className="font-normal whitespace-nowrap">
          {status.text}
        </span>
        
        <div className="w-8 flex justify-end flex-shrink-0">
          {status.progress && (
            <span className="text-xs opacity-60">
              {status.progress}
            </span>
          )}
        </div>
      </div>
    </div>
  );
} 
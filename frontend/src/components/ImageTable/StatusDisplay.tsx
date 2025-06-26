import React from 'react';
import { cn } from '@/lib/utils';
import { Image } from '@/types';

interface StatusDisplayProps {
  status: Image['status'];
  className?: string;
}

export function StatusDisplay({ status, className }: StatusDisplayProps) {
  const getStatusConfig = (status: Image['status']) => {
    switch (status) {
      case 'pending':
        return {
          text: 'Pending',
          className: 'bg-gray-100 text-gray-600 border-gray-200',
          description: 'Waiting to start processing'
        };
      case 'extracting':
        return {
          text: 'Extracting',
          className: 'bg-blue-100 text-blue-700 border-blue-200',
          description: 'AI is analyzing the image'
        };
      case 'extracted':
        return {
          text: 'Extracted',
          className: 'bg-green-100 text-green-700 border-green-200',
          description: 'Valid code successfully extracted'
        };
      case 'invalid_group':
        return {
          text: 'Invalid Group',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          description: 'Group format is invalid'
        };
      case 'pending_grouping':
        return {
          text: 'Pending Group',
          className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          description: 'No code found, waiting for similarity grouping'
        };
      case 'grouping':
        return {
          text: 'Grouping',
          className: 'bg-gray-200 text-gray-700 border-gray-300',
          description: 'Finding similar images to group with'
        };
      case 'auto_grouped':
        return {
          text: 'Auto Grouped',
          className: 'bg-green-100 text-green-700 border-green-200',
          description: 'Automatically grouped with similar images'
        };
      case 'ungrouped':
        return {
          text: 'Ungrouped',
          className: 'bg-red-100 text-red-700 border-red-200',
          description: 'Could not find group for this image'
        };
      case 'user_grouped':
        return {
          text: 'User Grouped',
          className: 'bg-green-100 text-green-700 border-green-200',
          description: 'Manually assigned to group by user'
        };
      default:
        return {
          text: 'Unknown',
          className: 'bg-gray-100 text-gray-600 border-gray-200',
          description: 'Status unknown'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div 
      className={cn(
        'inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border',
        config.className,
        className
      )}
      title={config.description}
    >
      {config.text}
    </div>
  );
} 
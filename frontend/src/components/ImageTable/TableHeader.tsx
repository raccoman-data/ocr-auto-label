import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageStore } from '@/stores/imageStore';

export function TableHeader() {
  const { sort, toggleSort } = useImageStore();

  const SortButton = ({ field, children }: { field: 'timestamp' | 'originalName' | 'newName' | 'group', children: React.ReactNode }) => {
    const isActive = sort.field === field;
    const isAsc = sort.order === 'asc';
    
    return (
      <button
        onClick={() => toggleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        <div className="flex flex-col">
          <ChevronUp className={cn(
            "w-3 h-3 -mb-1",
            isActive && isAsc ? "text-primary" : "text-muted-foreground/50"
          )} />
          <ChevronDown className={cn(
            "w-3 h-3",
            isActive && !isAsc ? "text-primary" : "text-muted-foreground/50"
          )} />
        </div>
      </button>
    );
  };

  return (
    <div className="h-12 border-b border-border bg-card sticky top-0 z-20 flex items-center text-xs font-semibold text-muted-foreground tracking-wide">
      {/* Preview Column */}
      <div className="w-20 linear-cell">
        Preview
      </div>
      
      {/* Spacer */}
      <div className="w-4 linear-cell"></div>
      
      {/* Original Name Column */}
      <div className="w-48 linear-cell min-w-[10rem]">
        <SortButton field="originalName">Original Name</SortButton>
      </div>
      
      {/* New Name Column */}
      <div className="flex-1 linear-cell min-w-[16rem] -ml-4">
        <SortButton field="newName">New Name</SortButton>
      </div>
      
      {/* Group Column */}
      <div className="w-56 linear-cell -ml-2 -mr-2">
        <SortButton field="group">Group</SortButton>
      </div>
      
      {/* Timestamp Column */}
      <div className="w-48 linear-cell -ml-2">
        <SortButton field="timestamp">Timestamp</SortButton>
      </div>
      
      {/* Status Column */}
      <div className="w-24 linear-cell text-right pr-2">
        Status
      </div>
    </div>
  );
} 
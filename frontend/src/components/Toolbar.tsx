import React, { useState } from 'react';
import { Filter, Download, Trash2, HelpCircle, ChevronDown } from 'lucide-react';
import { useImageStore } from '@/stores/imageStore';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { KeyboardShortcutsPanel } from '@/components/KeyboardShortcuts';
import { cleanupAllData } from '@/lib/api';
import { FilterOption } from '@/types';
import { cn } from '@/lib/utils';

// Filter option types - simplified for summary views only
interface FilterOptionConfig {
  value: FilterOption;
  label: string;
  count: true;
  description?: string;
}



// Filter configuration with just summary views
const filterConfig: { options: FilterOptionConfig[] } = {
  options: [
    { value: 'all', label: 'All Images', count: true },
    { value: 'complete', label: 'Complete', count: true, description: 'Extracted, auto-grouped, or user-grouped' },
    { value: 'pending', label: 'Pending', count: true, description: 'Currently processing or waiting' },
    { value: 'needs_attention', label: 'Needs Attention', count: true, description: 'Invalid groups or ungrouped' },
  ]
};

export function Toolbar() {
  const [isClearing, setIsClearing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const {
    filter,
    setFilter,
    getFilteredImages,
    clearAll,
    images
  } = useImageStore();

  const filteredImages = getFilteredImages();
  const hasImages = images.length > 0;

  // Calculate counts for each filter option efficiently without mutating store
  const getFilterCount = React.useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Base counts
    counts['all'] = images.length;
    
    // Initialize all counters
    counts['complete'] = 0;
    counts['pending'] = 0;
    counts['needs_attention'] = 0;
    
    // Individual status counters
    const statusCounts: Record<string, number> = {};
    
    // Count each image by status
    images.forEach(img => {
      const status = img.status || 'pending';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Group into summary categories
      if (['extracted', 'auto_grouped', 'user_grouped'].includes(status)) {
        counts['complete']++;
      } else if (['pending', 'extracting', 'pending_grouping', 'grouping'].includes(status)) {
        counts['pending']++;
      } else if (['invalid_group', 'ungrouped'].includes(status)) {
        counts['needs_attention']++;
      }
    });
    
    // Merge individual status counts
    Object.assign(counts, statusCounts);
    
    return (filterValue: FilterOption): number => counts[filterValue] || 0;
  }, [images]);

  const handleFilterChange = (value: FilterOption) => {
    setFilter(value);
    setFilterOpen(false);
  };

  const getFilterLabel = (filterValue: FilterOption): string => {
    const allOptions = filterConfig.options;
    return allOptions.find(option => option.value === filterValue)?.label || filterValue;
  };

  const handleExport = () => {
    // TODO: Implement export functionality (this will also apply changes)
    console.log('Export and apply changes');
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all images and data? This cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      await cleanupAllData();
      clearAll(); // Clear all state immediately
      console.log('✅ All data cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
      alert('Failed to clear data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      {/* Left side - Basic info */}
      <div className="flex items-center gap-6">
        {hasImages && (
          <span className="text-sm text-muted-foreground font-medium">
            {filteredImages.length} of {images.length} images
          </span>
        )}
      </div>

      {/* Right side - Help, Filter, Clear, and Export */}
      <div className="flex items-center gap-3">
        {/* Keyboard shortcuts help - always visible */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 px-3 text-muted-foreground hover:text-foreground"
              title="Keyboard shortcuts"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-4" align="end">
            <KeyboardShortcutsPanel variant="compact" />
          </PopoverContent>
        </Popover>

        {hasImages && (
          <>
            {/* Enhanced Filter Dropdown */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 px-3 min-w-[140px] justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>{getFilterLabel(filter)}</span>
                  </div>
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="max-h-96 overflow-auto">
                  {filterConfig.options.map((option) => {
                    const isSelected = filter === option.value;
                    const count = getFilterCount(option.value);
                    
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleFilterChange(option.value)}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-accent/50 transition-colors",
                          isSelected && "bg-accent text-accent-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Label and description */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{option.label}</div>
                            {'description' in option && option.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {option.description}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Count badge - always on the right */}
                        <span className={cn(
                          "px-2 py-0.5 text-xs rounded-full font-medium",
                          isSelected 
                            ? "bg-primary/20 text-primary" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              onClick={handleClearAll}
              disabled={isClearing}
              variant="outline"
              className="flex items-center gap-2 px-4 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              {isClearing ? 'Clearing...' : 'Clear All'}
            </Button>
          </>
        )}
        
        <Button
          onClick={handleExport}
          disabled={!hasImages}
          className="flex items-center gap-2 px-4"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>
    </div>
  );
} 
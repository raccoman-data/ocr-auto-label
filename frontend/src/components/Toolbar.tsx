import React, { useState } from 'react';
import { Filter, Download, Trash2, HelpCircle, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { useImageStore } from '@/stores/imageStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { KeyboardShortcutsPanel } from '@/components/KeyboardShortcuts';
import { cleanupAllData, exportImages } from '@/lib/api';
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
  const [isExporting, setIsExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    errors: string[];
  }>({ title: '', message: '', errors: [] });
  const {
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
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

  const handleExport = async () => {
    if (!hasImages) return;
    
    setIsExporting(true);
    try {
      await exportImages();
      console.log('✅ Export completed successfully');
    } catch (error) {
      console.error('❌ Export failed:', error);
      
      // Check if it's a validation error and show detailed feedback
      if (error instanceof Error && error.message.includes('Validation failed')) {
        try {
          // Try to parse the error response for validation details
          const errorData = JSON.parse(error.message.split('Validation failed')[1] || '{}');
          if (errorData.validationErrors) {
            setErrorDetails({
              title: 'Export Failed',
              message: 'Export failed due to validation errors. Please fix the issues below and try again.',
              errors: errorData.validationErrors
            });
          } else {
            setErrorDetails({
              title: 'Export Validation Failed',
              message: 'Please check that all images have valid names and there are no duplicates.',
              errors: []
            });
          }
        } catch {
          setErrorDetails({
            title: 'Export Validation Failed',
            message: 'Please check that all images have valid names and there are no duplicates.',
            errors: []
          });
        }
      } else {
        setErrorDetails({
          title: 'Export Failed',
          message: error instanceof Error ? error.message : 'An unknown error occurred while exporting.',
          errors: []
        });
      }
      setShowErrorDialog(true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAll = () => {
    setShowClearDialog(true);
  };

  const confirmClearAll = async () => {
    setIsClearing(true);
    try {
      await cleanupAllData();
      clearAll(); // Clear all state immediately
      console.log('✅ All data cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
      setErrorDetails({
        title: 'Clear Failed',
        message: 'Failed to clear data. Please try again.',
        errors: []
      });
      setShowErrorDialog(true);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="h-16 border-b border-border bg-card flex items-center">
      {/* Left section - matches table width exactly (100% - sidebar width - left padding) */}
      <div className="flex-1 flex items-center gap-4 pl-4" style={{ width: 'calc(100% - 26rem)' }}>
        <ProcessingStatus />
        
        {/* Search and Filter */}
        {hasImages && (
          <div className="flex-1 flex items-center gap-3">
            {/* Search - takes remaining space */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search-input"
                  placeholder="Search codes, descriptions, colors, and more..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Filter */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 px-3 min-w-[120px] justify-between text-slate-500"
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
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{option.label}</div>
                          {'description' in option && option.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {option.description}
                            </div>
                          )}
                        </div>
                      </div>
                      
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
          </div>
        )}
      </div>

      {/* Actions - fixed width to align with sidebar */}
      <div className="flex items-center gap-3 w-[26rem] justify-end pr-6">
        {/* Help */}
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
          <Button
            onClick={handleClearAll}
            disabled={isClearing}
            variant="outline"
            className="flex items-center gap-2 px-4 text-slate-500 hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Clearing...' : 'Clear All'}
          </Button>
        )}
        
        <Button
          onClick={handleExport}
          disabled={!hasImages || isExporting}
          className="flex items-center gap-2 px-4"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </div>

      {/* Confirmation Dialog for Clear All */}
      <ConfirmationModal
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        title="Clear All Data"
        description="Are you sure you want to clear all images and data? This action cannot be undone."
        confirmText="Clear All"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmClearAll}
      />

      {/* Error Dialog for Export/Clear errors */}
      <ErrorDialog
        open={showErrorDialog}
        onOpenChange={setShowErrorDialog}
        title={errorDetails.title}
        message={errorDetails.message}
        errors={errorDetails.errors}
      />
    </div>
  );
} 
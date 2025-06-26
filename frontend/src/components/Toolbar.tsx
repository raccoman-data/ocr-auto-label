import React, { useState } from 'react';
import { Filter, Download, Trash2, HelpCircle } from 'lucide-react';
import { useImageStore } from '@/stores/imageStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { KeyboardShortcutsPanel } from '@/components/KeyboardShortcuts';
import { cleanupAllData } from '@/lib/api';

export function Toolbar() {
  const [isClearing, setIsClearing] = useState(false);
  const {
    filter,
    setFilter,
    getFilteredImages,
    clearAll
  } = useImageStore();

  const images = getFilteredImages();
  const hasImages = images.length > 0;

  const handleFilterChange = (value: string) => {
    setFilter(value as 'all' | 'unknown' | 'conflict' | 'invalid_codes');
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
            {images.length} images
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
            <Select value={filter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-36">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="conflict">Conflict</SelectItem>
                <SelectItem value="invalid_codes">Invalid Codes</SelectItem>
              </SelectContent>
            </Select>

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
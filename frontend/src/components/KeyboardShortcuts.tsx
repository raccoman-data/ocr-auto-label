import React from 'react';
import { Badge } from '@/components/ui/badge';

// Helper function to detect if user is on Mac/Windows for correct key display
const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'navigation' | 'selection' | 'editing';
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  { keys: ['↑', '↓'], description: 'Navigate up/down in table', category: 'navigation' },
  { keys: [isMac ? 'Cmd' : 'Ctrl', 'F'], description: 'Focus search', category: 'navigation' },
  
  // Selection
  { keys: ['Shift', '↑/↓'], description: 'Multi-select images', category: 'selection' },
  
  // Editing
  { keys: [isMac ? 'Cmd' : 'Ctrl', 'C'], description: 'Copy group', category: 'editing' },
  { keys: [isMac ? 'Cmd' : 'Ctrl', 'V'], description: 'Paste group to selection', category: 'editing' },
  { keys: [isMac ? 'Cmd' : 'Ctrl', 'G'], description: 'Edit group for selection', category: 'editing' },
  { keys: [isMac ? 'Delete' : 'Backspace'], description: 'Clear groups for selection', category: 'editing' },
  { keys: [isMac ? 'Cmd' : 'Ctrl', 'Shift', isMac ? 'Delete' : 'Backspace'], description: 'Delete selected images', category: 'editing' },
];

interface KeyboardShortcutsPanelProps {
  variant?: 'panel' | 'compact';
  className?: string;
}

export function KeyboardShortcutsPanel({ variant = 'panel', className = '' }: KeyboardShortcutsPanelProps) {
  if (variant === 'compact') {
    return (
      <div className={`w-80 ${className}`}>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Keyboard Shortcuts</h3>
        <div className="space-y-1.5">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-xs text-gray-700">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <React.Fragment key={keyIndex}>
                    <kbd className="px-1.5 py-0.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded shadow-sm">
                      {key}
                    </kbd>
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className="text-gray-400 text-xs">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-foreground mb-4">Keyboard Shortcuts</h3>
      
      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground leading-tight">
              {shortcut.description}
            </span>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {shortcut.keys.map((key, keyIndex) => (
                <React.Fragment key={keyIndex}>
                  <kbd className="px-1.5 py-0.5 text-xs font-medium text-foreground bg-white/70 border border-border rounded shadow-sm">
                    {key}
                  </kbd>
                  {keyIndex < shortcut.keys.length - 1 && (
                    <span className="text-muted-foreground text-xs">+</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 
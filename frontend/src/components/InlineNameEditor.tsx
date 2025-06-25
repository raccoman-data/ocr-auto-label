import React from 'react';
import { cn } from '@/lib/utils';

interface InlineNameEditorProps {
  currentName: string;
  placeholder?: string;
  originalName?: string; // Add originalName to extract extension from
  onSave: (newName: string) => void;
  variant?: 'table' | 'sidebar';
  className?: string;
}

// Regex to capture last file extension (e.g. ".jpg", ".jpeg", ".png")
const EXT_REGEX = /(\.[^.]+)$/;

/**
 * InlineNameEditor – lightly-wrapped `contentEditable` filename editor.
 * We keep the file extension (e.g. ".jpg") outside of the editable region so
 * users always start typing BEFORE the extension – just like Finder / Explorer.
 */
export function InlineNameEditor({
  currentName,
  placeholder = 'Unnamed',
  originalName,
  onSave,
  variant = 'table',
  className,
}: InlineNameEditorProps) {
  // Split the current name into base name + extension once on mount / prop change
  const splitName = React.useCallback((name: string) => {
    const match = name.match(EXT_REGEX);
    if (match) {
      return { base: name.replace(EXT_REGEX, ''), ext: match[1] };
    }
    
    // Fallback: try to extract extension from originalName if available
    if (originalName) {
      const originalMatch = originalName.match(EXT_REGEX);
      if (originalMatch) {
        return { base: name, ext: originalMatch[1] };
      }
    }
    
    // Second fallback: try placeholder (might include extension)
    const placeholderMatch = placeholder.match(EXT_REGEX);
    return placeholderMatch
      ? { base: name, ext: placeholderMatch[1] }
      : { base: name, ext: '' };
  }, [placeholder, originalName]);

  const [{ base, ext }, setParts] = React.useState(() => splitName(currentName));
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  // Keep local state in sync with prop updates (e.g. external rename)
  React.useEffect(() => {
    if (!isEditing) {
      setParts(splitName(currentName));
    }
  }, [currentName, isEditing, splitName]);

  // Commit helper
  const commit = React.useCallback(() => {
    const trimmed = base.trim();
    const newFullName = trimmed + ext;
    // Save if there's any content (base name) or if the full name changed
    // This ensures we preserve extensions even when base name is empty
    if ((trimmed || ext) && newFullName !== currentName) {
      onSave(newFullName);
    }
  }, [base, ext, currentName, onSave]);

  // ----- Event Handlers ----- //
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLDivElement).blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setParts(splitName(currentName));
      (e.currentTarget as HTMLDivElement).blur();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setParts({ base: e.currentTarget.innerText, ext });
  };

  const handleFocus = () => {
    setIsEditing(true);
    // Move caret to end of editable text (just before the extension)
    const el = contentRef.current;
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const handleBlur = () => {
    commit();
    setIsEditing(false);
  };

  // Keep caret at end while editing to avoid RTL-like behavior when React re-renders
  React.useEffect(() => {
    if (isEditing && contentRef.current) {
      const el = contentRef.current;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [base, isEditing]);

  const variantClasses = variant === 'table'
    ? 'text-sm'
    : 'text-xs';

  return (
    <div className={cn('inline-flex items-center', className)}>
      {/* Editable base-name */}
      <div
        ref={contentRef}
        className={cn(
          'min-h-[1.5rem] rounded hover:bg-accent/30 focus:bg-accent/30 focus:ring-2 focus:ring-primary/40 transition-colors outline-none',
          !base && 'text-muted-foreground italic',
          variantClasses,
          'border-none bg-transparent',
          'w-full'
        )}
        dir="ltr"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-placeholder={placeholder}
      >
        {base}
      </div>
      {/* Static extension (non-editable) */}
      {ext && (
        <span className={cn('text-muted-foreground select-none', variant === 'table' ? 'text-sm' : 'text-xs', '-ml-px')}>{ext}</span>
      )}
    </div>
  );
} 
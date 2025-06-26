import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageStore } from '@/stores/imageStore';

interface InlineNameEditorProps {
  currentName: string;
  placeholder?: string;
  originalName?: string; // Add originalName to extract extension from
  imageId?: string; // Add imageId to check for duplicates
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
 * 
 * Now includes duplicate name detection with visual warnings.
 */
export function InlineNameEditor({
  currentName,
  placeholder = 'Unnamed',
  originalName,
  imageId,
  onSave,
  variant = 'table',
  className,
}: InlineNameEditorProps) {
  const { images } = useImageStore();
  
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

  // Check for duplicate names
  const isDuplicate = React.useMemo(() => {
    if (!base.trim() || !imageId) return false;
    
    const fullName = base.trim() + ext;
    return images.some(img => 
      img.id !== imageId && 
      img.newName?.trim() === fullName
    );
  }, [base, ext, imageId, images]);

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
    // Convert spaces to underscores for valid filenames
    const sanitizedText = e.currentTarget.innerText.replace(/\s+/g, '_');
    setParts({ base: sanitizedText, ext });
    
    // Update the content if sanitization changed the text
    if (sanitizedText !== e.currentTarget.innerText) {
      e.currentTarget.innerText = sanitizedText;
      // Keep cursor at end after sanitization
      const range = document.createRange();
      range.selectNodeContents(e.currentTarget);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
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

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Get pasted text and sanitize it
    const pastedText = e.clipboardData.getData('text/plain');
    const sanitizedText = pastedText.replace(/\s+/g, '_');
    
    // Insert sanitized text at current cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(sanitizedText));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Update state with the new content
    const newContent = e.currentTarget.innerText;
    setParts({ base: newContent, ext });
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
    <div className={cn('inline-flex items-center gap-1', className)}>
      {/* Editable base-name */}
      <div
        ref={contentRef}
        className={cn(
          'min-h-[1.5rem] rounded hover:bg-accent/30 focus:bg-accent/30 focus:ring-2 transition-colors outline-none',
          !base && 'text-muted-foreground italic',
          variantClasses,
          'border-none bg-transparent w-full',
          // Duplicate name styling
          isDuplicate && !isEditing && 'ring-2 ring-destructive/50 bg-destructive/5',
          isDuplicate && isEditing && 'focus:ring-destructive/60'
        )}
        dir="ltr"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        title={isDuplicate ? 'Duplicate name detected!' : undefined}
      >
        {base}
      </div>
      
      {/* Static extension (non-editable) */}
      {ext && (
        <span className={cn(
          'text-muted-foreground select-none -ml-px',
          variant === 'table' ? 'text-sm' : 'text-xs'
        )}>
          {ext}
        </span>
      )}
      
      {/* Duplicate warning icon */}
      {isDuplicate && !isEditing && (
        <div title="Duplicate name detected!">
          <AlertTriangle 
            className={cn(
              'flex-shrink-0 text-destructive',
              variant === 'table' ? 'w-4 h-4' : 'w-3 h-3'
            )}
          />
        </div>
      )}
    </div>
  );
} 
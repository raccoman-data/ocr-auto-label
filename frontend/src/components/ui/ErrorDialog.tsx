import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, CheckCircle } from 'lucide-react';

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  errors?: string[];
  actionText?: string;
}

export function ErrorDialog({
  open,
  onOpenChange,
  title,
  message,
  errors = [],
  actionText = "OK",
}: ErrorDialogProps) {
  const [copied, setCopied] = React.useState(false);

  // Format the full error text for copying
  const fullErrorText = React.useMemo(() => {
    let text = `${title}\n\n${message}`;
    if (errors.length > 0) {
      text += '\n\nDetailed errors:\n';
      text += errors.map((error, index) => `${index + 1}. ${error}`).join('\n');
    }
    return text;
  }, [title, message, errors]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullErrorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left mt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        
        {errors.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-foreground mb-2">
              Validation errors ({errors.length}):
            </h4>
            <div className="bg-muted rounded-md p-3 max-h-60 overflow-y-auto">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {errors.map((error, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-amber-500 font-medium">{index + 1}.</span>
                    <span className="flex-1">{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex items-center gap-2"
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Details
              </>
            )}
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            {actionText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
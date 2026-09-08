import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AttendeeNote } from '@/types/attendee';

interface NoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (text: string) => void;
  attendeeName: string;
  initialText?: string;
}

export const NoteModal = ({ open, onOpenChange, onSave, attendeeName, initialText }: NoteModalProps) => {
  const [noteText, setNoteText] = useState(initialText ?? '');

  useEffect(() => {
    if (open) {
      setNoteText(initialText ?? '');
    }
  }, [open, initialText]);

  const handleSave = () => {
    if (noteText.trim()) {
      onSave(noteText.trim());
      setNoteText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg bg-popover">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">{initialText ? 'Edit Note' : 'Add Note'}</DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{attendeeName}</p>
        </DialogHeader>
        <div className="py-3 sm:py-4">
          <Textarea
            placeholder="What did you discuss? Any follow-up actions? Key insights..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="min-h-[100px] sm:min-h-[120px] bg-background resize-none text-sm"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-2">
            Timestamp will be added automatically
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!noteText.trim()} className="w-full sm:w-auto text-xs sm:text-sm">
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { AttendeeNote } from '@/types/attendee';
import { X, Edit, Trash2 } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import * as attendeeDataService from '@/services/attendeeDataService';

interface ViewAllNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes?: AttendeeNote[]; // Optional now
  attendeeId: string; // Required to load notes
  attendeeName: string;
  onEditNote?: (noteId: string, initialText: string) => void;
  onDeleteNote?: (noteId: string) => void;
}

export const ViewAllNotesModal = ({
  open,
  onOpenChange,
  notes: propNotes,
  attendeeId,
  attendeeName,
  onEditNote,
  onDeleteNote,
}: ViewAllNotesModalProps) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [notes, setNotes] = useState<AttendeeNote[]>(propNotes || []);
  const [loading, setLoading] = useState(false);

  // Load notes when modal opens
  useEffect(() => {
    if (open && attendeeId) {
      setLoading(true);
      attendeeDataService.getNotes(attendeeId).then((loadedNotes) => {
        setNotes(loadedNotes);
        setLoading(false);
      });
    }
  }, [open, attendeeId]);

  const sortedNotes = [...notes].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-popover">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-semibold text-center sm:text-left">
            All Notes for {attendeeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">Loading notes...</p>
            </div>
          ) : notes.length > 0 ? (
            sortedNotes.map((note) => (
              <div
                key={note.id}
                className="bg-muted/30 rounded-xl p-4 border border-border/50"
              >
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-foreground break-words leading-relaxed">
                    {note.text}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {format(note.timestamp, 'MMM dd, yyyy • h:mm a')}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditNote?.(note.id, note.text)}
                        className="text-xs px-3 py-2 h-8 rounded-lg"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-600 dark:text-gray-400 text-xs px-3 py-2 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => {
                          setNoteToDelete(note.id);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">
                No notes yet for {attendeeName}
              </p>
            </div>
          )}
        </div>

        {notes.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {notes.length} note{notes.length !== 1 ? 's' : ''} total
            </p>
          </div>
        )}

        <DeleteConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          onConfirm={() => {
            if (noteToDelete) {
              console.log('Deleting note from ViewAllNotesModal:', noteToDelete);
              // Remove from local state immediately for instant UI feedback
              setNotes(prevNotes => prevNotes.filter(note => note.id !== noteToDelete));
              // Then call the parent delete function
              onDeleteNote?.(noteToDelete);
              setNoteToDelete(null);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

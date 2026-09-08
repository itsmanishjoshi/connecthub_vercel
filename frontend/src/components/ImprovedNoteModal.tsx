import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { AttendeeNote } from '@/types/attendee';
import { Plus, Edit, Trash2, FileText, Clock, CloudOff } from 'lucide-react';
import * as attendeeDataService from '@/services/attendeeDataService';
import { toast } from 'sonner';

interface ImprovedNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendeeId: string;
  attendeeName: string;
  editingNoteId?: string | null;
  editingNoteText?: string;
  onSave?: () => void; // Callback to refresh parent
}

export const ImprovedNoteModal = ({ 
  open, 
  onOpenChange, 
  attendeeId, 
  attendeeName,
  editingNoteId,
  editingNoteText,
  onSave 
}: ImprovedNoteModalProps) => {
  const [notes, setNotes] = useState<AttendeeNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [currentEditingNoteId, setCurrentEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Initialize editing state from props
  useEffect(() => {
    if (editingNoteId && editingNoteText) {
      setCurrentEditingNoteId(editingNoteId);
      setEditingText(editingNoteText);
    } else {
      setCurrentEditingNoteId(null);
      setEditingText('');
    }
  }, [editingNoteId, editingNoteText]);

  // Load notes when modal opens
  useEffect(() => {
    if (open && attendeeId) {
      setLoading(true);
      attendeeDataService.getNotes(attendeeId).then((loadedNotes) => {
        setNotes(loadedNotes || []);
        setLoading(false);
      });
    }
  }, [open, attendeeId]);

  useEffect(() => {
    const onLocalSave = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === 'note') {
        toast.message('Saved on this device — will sync when you\'re back online', { duration: 4500 });
      }
    };
    window.addEventListener('connecthub:local-save', onLocalSave);
    return () => window.removeEventListener('connecthub:local-save', onLocalSave);
  }, []);

  const handleSaveNewNote = async () => {
    if (!newNoteText.trim()) return;
    
    setSaving(true);
    try {
      await attendeeDataService.saveNote(attendeeId, newNoteText.trim());
      setNewNoteText('');
      
      // Reload notes
      const updatedNotes = await attendeeDataService.getNotes(attendeeId);
      setNotes(updatedNotes || []);
      
      onSave?.(); // Refresh parent
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditNote = (noteId: string, text: string) => {
    setCurrentEditingNoteId(noteId);
    setEditingText(text);
  };

  const handleSaveEdit = async () => {
    if (!editingText.trim() || !currentEditingNoteId) return;
    
    setSaving(true);
    try {
      await attendeeDataService.updateNote(currentEditingNoteId, editingText.trim());
      setCurrentEditingNoteId(null);
      setEditingText('');
      
      // Reload notes
      const updatedNotes = await attendeeDataService.getNotes(attendeeId);
      setNotes(updatedNotes || []);
      
      onSave?.(); // Refresh parent
    } catch (error) {
      console.error('Error updating note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    
    try {
      await attendeeDataService.deleteNote(noteToDelete);
      
      // Remove from local state immediately for better UX
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteToDelete));
      
      onSave?.(); // Refresh parent
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note. Please try again.');
    } finally {
      setDeleteConfirmOpen(false);
      setNoteToDelete(null);
    }
  };

  const sortedNotes = [...notes].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-0 p-4 sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-6 bg-popover">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8 text-base sm:text-lg">
              <FileText className="h-5 w-5 shrink-0" />
              <span className="min-w-0 break-words">Notes for {attendeeName}</span>
            {notes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {notes.length} note{notes.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </DialogTitle>
          {!navigator.onLine ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <CloudOff className="h-3.5 w-3.5" />
              Offline — notes save on this device and sync later
            </p>
          ) : null}
          <DialogDescription className="sr-only">
            View and manage notes for {attendeeName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Existing Notes */}
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading notes...</p>
            </div>
          ) : notes.length > 0 ? (
            <ScrollArea className="max-h-[min(42vh,360px)] flex-1 pr-2 sm:max-h-[300px]">
              <div className="space-y-3">
                {sortedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-muted/30 rounded-lg p-3 border border-border/50"
                  >
                    {currentEditingNoteId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="min-h-[80px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentEditingNoteId(null);
                              setEditingText('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={saving || !editingText.trim()}
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-foreground break-words leading-relaxed">
                          {note.text}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(note.timestamp, 'MMM dd, yyyy • h:mm a')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditNote(note.id, note.text)}
                              className="h-9 min-w-[44px] px-2 text-xs touch-manipulation"
                            >
                              <Edit className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNote(note.id)}
                              className="h-9 min-w-[44px] px-2 text-xs text-red-600 hover:text-red-700 touch-manipulation"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
              <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No notes yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first note below
              </p>
            </div>
          )}

          {/* Add New Note */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {notes.length > 0 ? 'Add Another Note' : 'Add Your First Note'}
              </label>
              <Textarea
                placeholder="What did you discuss? Any follow-up actions? Key insights..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="min-h-[120px] text-base sm:text-sm touch-manipulation"
                autoFocus={notes.length === 0}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveNewNote}
                  disabled={saving || !newNoteText.trim()}
                  className="h-11 w-full touch-manipulation sm:w-auto"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      {notes.length > 0 ? 'Add Another Note' : 'Add Note'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="left-[50%] translate-x-[-50%]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNote} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

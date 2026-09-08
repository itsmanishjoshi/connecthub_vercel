import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building, User, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MeetingNote } from '@/services/notebookService';

interface NotebookNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: MeetingNote | null;
  companies: any[];
  onSave: (note: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
}

const NotebookNoteModal = ({
  open,
  onOpenChange,
  note,
  companies,
  onSave,
}: NotebookNoteModalProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'meeting' | 'call' | 'email' | 'note' | 'research'>('note');
  const [category, setCategory] = useState<'person' | 'company' | 'opportunity' | 'general'>('general');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent' | ''>('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [participantValue, setParticipantValue] = useState('');
  const [participantLocked, setParticipantLocked] = useState(false);
  const [participantSelectedFromList, setParticipantSelectedFromList] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
  const participantInputRef = useRef<HTMLInputElement | null>(null);

  // Get all unique decision makers from companies
  const getDecisionMakers = (): string[] => {
    const decisionMakers = new Set<string>();
    companies.forEach(company => {
      if (company.decisionMaker) {
        decisionMakers.add(company.decisionMaker);
      }
    });
    return Array.from(decisionMakers).sort();
  };

  // Get all unique company names
  const getCompanyNames = (): string[] => {
    return companies.map(c => c.companyName).sort();
  };

  // Get all participants (companies + decision makers)
  const getAllParticipants = (): string[] => {
    const participants = new Set<string>();
    getCompanyNames().forEach(name => participants.add(name));
    getDecisionMakers().forEach(name => participants.add(name));
    return Array.from(participants).sort();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Reset form when modal opens or note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setType(note.type);
      setCategory(note.category);
      setPriority(note.priority);
      setDate(note.date || '');
      setTime(note.time || '');
      setDuration(note.duration || '');
      setLocation(note.location || '');
      setParticipantValue(note.participants?.[0] || '');
      setParticipantLocked(!!note.participants?.[0] && note.metadata?.participantSource === 'list');
      setParticipantSelectedFromList(note.metadata?.participantSource === 'list');
      setTags(note.tags || []);
    } else {
      setTitle('');
      setContent('');
      setType('note');
      setCategory('general');
      setPriority('');
      setDate('');
      setTime('');
      setDuration('');
      setLocation('');
      setParticipantValue('');
      setParticipantLocked(false);
      setParticipantSelectedFromList(false);
      setTags([]);
    }
    setFocusedSuggestionIndex(-1);
  }, [note, open]);

  const selectParticipantFromList = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setParticipantValue(v);
    setParticipantLocked(true);
    setParticipantSelectedFromList(true);
    setFocusedSuggestionIndex(-1);
    setShowSuggestions(false);
    participantInputRef.current?.focus();
  };

  const clearParticipant = () => {
    setParticipantValue('');
    setParticipantLocked(false);
    setParticipantSelectedFromList(false);
    setFocusedSuggestionIndex(-1);
    setShowSuggestions(false);
    participantInputRef.current?.focus();
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "⚠️ Missing Information",
        description: "Please enter both title and content.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    const noteData: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
      title: title.trim(),
      content: content.trim(),
      type,
      category,
      priority,
      status: note?.status ?? 'draft',
      date: date || undefined,
      time: time || undefined,
      duration: duration || undefined,
      location: location || undefined,
      participants: participantValue.trim() ? [participantValue.trim()] : [],
      tags,
      relatedEntity: undefined,
      metadata: {
        ...(note?.metadata || {}),
        participantSource: participantSelectedFromList ? 'list' : 'free',
      }
    };

    onSave(noteData);
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] bg-popover p-6 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">
            {note ? 'Edit Note' : 'Add New Note'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-hidden">
          {/* Title and Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title" className="text-sm font-medium mb-2 block">
                Title *
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter note title..."
                className="focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            
            <div>
              <Label htmlFor="type" className="text-sm font-medium mb-2 block">
                Type
              </Label>
              <Select value={type} onValueChange={(value) => setType(value as any)}>
                <SelectTrigger className="focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">🤝 Meeting</SelectItem>
                  <SelectItem value="call">📞 Call</SelectItem>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="note">📝 Note</SelectItem>
                  <SelectItem value="research">🔍 Research</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Priority
            </Label>
            <div className="flex gap-2">
              {[
                { value: 'low', label: '🟢 Low', color: 'bg-green-100 text-green-800 border-green-200' },
                { value: 'medium', label: '🟡 Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                { value: 'high', label: '🟠 High', color: 'bg-orange-100 text-orange-800 border-orange-200' },
                { value: 'urgent', label: '🔴 Urgent', color: 'bg-red-100 text-red-800 border-red-200' }
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value as 'low' | 'medium' | 'high' | 'urgent' | '')}
                  className={`px-3 py-1.5 rounded-md border-2 transition-all ${
                    priority === p.value 
                      ? `${p.color} border-current ring-2 ring-offset-2 ring-current` 
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="text-xs font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <Label htmlFor="content" className="text-sm font-medium mb-2 block">
              Content *
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter note content..."
              className="min-h-[120px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Calendar Integration Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="date" className="text-sm font-medium mb-2 block">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:brightness-0 dark:[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer hover:[&::-webkit-calendar-picker-indicator]:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] dark:hover:[&::-webkit-calendar-picker-indicator]:drop-shadow-[0_0_8px_rgba(147,197,253,0.5)]"
              />
            </div>
            <div>
              <Label htmlFor="time" className="text-sm font-medium mb-2 block">
                Time
              </Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:brightness-0 dark:[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer hover:[&::-webkit-calendar-picker-indicator]:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] dark:hover:[&::-webkit-calendar-picker-indicator]:drop-shadow-[0_0_8px_rgba(147,197,253,0.5)]"
              />
            </div>
            <div>
              <Label htmlFor="location" className="text-sm font-medium mb-2 block">
                Place
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Meeting place"
                className="focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          {/* Participants and Tags Field */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="participants" className="text-sm font-medium mb-2 block">
                Participants
              </Label>
              <div className="relative">
                <Input
                  id="participants"
                  ref={participantInputRef}
                  value={participantValue}
                  onChange={(e) => {
                    if (participantLocked) return;
                    setParticipantValue(e.target.value);
                    setParticipantSelectedFromList(false);
                    setFocusedSuggestionIndex(-1);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    const query = participantValue.trim().toLowerCase();
                    const filteredSuggestions = query
                      ? getAllParticipants()
                          .filter(p => p.toLowerCase().includes(query))
                          .slice(0, 6)
                      : [];

                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setFocusedSuggestionIndex(prev => 
                        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setFocusedSuggestionIndex(prev => 
                        prev > 0 ? prev - 1 : -1
                      );
                    } else if (e.key === 'Enter' && focusedSuggestionIndex >= 0) {
                      e.preventDefault();
                      const selected = filteredSuggestions[focusedSuggestionIndex];
                      if (selected) {
                        selectParticipantFromList(selected);
                      }
                    } else if (e.key === 'Enter') {
                      // Free text is allowed; do not force selection.
                      setShowSuggestions(false);
                    }
                  }}
                  placeholder="e.g., ABC Corp John Doe"
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  readOnly={participantLocked}
                  className={participantLocked ? 'pr-10 cursor-default focus-visible:ring-0 focus-visible:ring-offset-0' : 'focus-visible:ring-0 focus-visible:ring-offset-0'}
                />

                {participantLocked && participantValue.trim().length > 0 && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={clearParticipant}
                    aria-label="Clear participant"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                
                {/* Participants Suggestions Dropdown */}
                {showSuggestions && !participantLocked && participantValue.trim().length > 0 && getAllParticipants().length > 0 && (
                  <div className="absolute z-50 w-full bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                    {getAllParticipants().filter(p => 
                      p.toLowerCase().includes(participantValue.trim().toLowerCase())
                    ).slice(0, 6).map((participant, index) => (
                      <div
                        key={index}
                        className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                          index === focusedSuggestionIndex 
                            ? 'bg-blue-50 dark:bg-blue-900' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          selectParticipantFromList(participant);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getCompanyNames().includes(participant) ? (
                              <Building className="w-4 h-4 text-blue-500" />
                            ) : (
                              <User className="w-4 h-4 text-green-500" />
                            )}
                            <span className="text-sm">{participant}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="tags" className="text-sm font-medium mb-2 block">
                Tags
              </Label>
              <Input
                id="tags"
                value={tags.join(', ') || ''}
                onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                placeholder="e.g., important, follow-up"
                className="focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-1 pb-6">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {note ? '✏️ Update' : '📝 Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotebookNoteModal;

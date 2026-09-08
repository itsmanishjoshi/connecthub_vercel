import { useState, useEffect, useRef } from 'react';
import { Attendee, STATUS_OPTIONS, AttendeeNote } from '@/types/attendee';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Copy, Pencil, X, Mic, Linkedin, Loader2, Plus, User, XIcon, Camera } from 'lucide-react';
import * as attendeeDataService from '@/services/attendeeDataService';
import { getStatus as getStatusLocal } from '@/utils/localStorage';
import { format } from 'date-fns';
import { updateAttendee, uploadProfilePicture } from '@/lib/eventsApi';
import { ImageCropDialog } from '@/components/ImageCropDialog';
import { PhotoPicker } from '@/components/PhotoPicker';
import { useToast } from '@/hooks/use-toast';
import { openJellySoon, type JellyOpenDetail } from '@/lib/jellyEvents';
import { formatIceBreaker, formatTalkingPoint, splitIceBreakers, splitTalkingPoints } from '@/lib/profileNotes';
import { conversationsForAttendee, listConversations, listInsights, meetingBriefFromInsights, type Conversation } from '@/services/conversationService';
import { unlockUi } from '@/lib/unlockUi';
import { getAvatarUrl } from '@/utils/avatarHelper';

interface AttendeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendee: Attendee;
  onAddNote: () => void;
  onChangeStatus: () => void;
  onEditNote?: (noteId: string, initialText: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onViewAllNotes?: () => void;
  onUpdateAttendee?: (attendee: Attendee) => void;
  eventId?: string;
  eventName?: string;
  canEdit?: boolean;
}

const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatWhen = (value: string | number | Date | null | undefined): string => {
  if (value == null || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return format(date, 'dd MMM yyyy, HH:mm');
  } catch {
    return '';
  }
};

const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-teal-500',
    'bg-purple-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-cyan-500',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export const AttendeeModal = ({
  open,
  onOpenChange,
  attendee,
  onAddNote: _onAddNote,
  onChangeStatus,
  onEditNote,
  onDeleteNote,
  onViewAllNotes,
  onUpdateAttendee,
  eventId,
  eventName,
  canEdit = false,
}: AttendeeModalProps) => {
  const { toast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [insights, setInsights] = useState<string>('');
  const [isEditingInsights, setIsEditingInsights] = useState(false);
  const [isSavingInsights, setIsSavingInsights] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationNotes, setConversationNotes] = useState<Record<string, string>>({});
  const [meetingBrief, setMeetingBrief] = useState<{ summary: string; nextAction: string; followup: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<AttendeeNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const notesSectionRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Attendee>(attendee);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [linkedInOpen, setLinkedInOpen] = useState(false);
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [savingLinkedIn, setSavingLinkedIn] = useState(false);

  const closeModal = () => {
    unlockUi();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) unlockUi();
    return () => unlockUi();
  }, [open]);

  // Load insights when modal opens
  useEffect(() => {
    if (open && attendee.id) {
      loadInsights();
      listConversations()
        .then(async (rows) => {
          const mine = conversationsForAttendee(rows, attendee.id);
          setConversations(mine);
          const notes: Record<string, string> = {};
          let brief: { summary: string; nextAction: string; followup: string } | null = null;
          for (const conversation of mine.slice(0, 5)) {
            const rowsForConvo = await listInsights(conversation.id).catch(() => []);
            const mapped = meetingBriefFromInsights(rowsForConvo);
            if (!brief && (mapped.followup || mapped.nextAction || mapped.summary)) {
              brief = { summary: mapped.summary, nextAction: mapped.nextAction, followup: mapped.followup };
            }
            const pains = rowsForConvo.filter((item) => item.kind === 'pain_point').slice(0, 2).map((item) => item.title || item.body);
            const opportunity = rowsForConvo.find((item) => item.kind === 'opportunity');
            notes[conversation.id] = [pains.length ? `Pain points: ${pains.join('; ')}` : '', opportunity ? `Opportunity: ${opportunity.title || opportunity.body}` : '']
              .filter(Boolean)
              .join(' · ');
          }
          setMeetingBrief(brief);
          setConversationNotes(notes);
        })
        .catch(() => {
          setConversations([]);
          setMeetingBrief(null);
        });
    }
  }, [open, attendee.id]);

  const loadInsights = async () => {
    try {
      const data = await attendeeDataService.getInsights(attendee.id);
      setInsights(data || '');
    } catch (error) {
      console.error('Failed to load insights:', error);
    }
  };

  const handleSaveInsights = async () => {
    setIsSavingInsights(true);
    try {
      const success = await attendeeDataService.saveInsights(attendee.id, insights);
      if (success) {
        setIsEditingInsights(false);
        toast({ title: 'Insights saved successfully' });
        // Reload insights to confirm save
        await loadInsights();
      } else {
        toast({ title: 'Failed to save insights', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to save insights:', error);
      toast({ title: 'Failed to save insights', variant: 'destructive' });
    } finally {
      setIsSavingInsights(false);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (noteToDelete) {
      onDeleteNote?.(noteToDelete);
      setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteToDelete));
      setNoteToDelete(null);
      setDeleteConfirmOpen(false);
    }
  };

  let statuses: Array<keyof typeof STATUS_OPTIONS> = [];
  try {
    statuses = getStatusLocal(attendee.id).filter((status) => status in STATUS_OPTIONS);
  } catch {
    statuses = [];
  }
  const displayStatus = (
    ['high_priority', 'meeting_required', 'follow_up_needed', 'deal_potential', 'strong_connect', 'watchlist'] as const
  ).find((status) => statuses.includes(status)) || null;

  useEffect(() => {
    if (open && attendee.id) {
      setLoadingNotes(true);
      attendeeDataService.getNotes(attendee.id).then((loadedNotes) => {
        setNotes(Array.isArray(loadedNotes) ? loadedNotes : []);
        setLoadingNotes(false);
      }).catch(() => {
        setNotes([]);
        setLoadingNotes(false);
      });
    }
  }, [open, attendee.id]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(attendee);
    }
  }, [attendee, isEditing]);

  const startEditing = () => {
    setDraft(attendee);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(attendee);
    setIsEditing(false);
  };

  const openPhotoFile = (file: File) => {
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
  };

  const saveCroppedPhoto = async (blob: Blob) => {
    setSavingPhoto(true);
    try {
      const file = new File([blob], `${attendee.id}.jpg`, { type: 'image/jpeg' });
      const url = await uploadProfilePicture(file, attendee.id);
      await updateAttendee(attendee.id, { profile_pic_url: url });
      const next = { ...attendee, photo: url };
      setDraft((current) => ({ ...current, photo: url }));
      onUpdateAttendee?.(next);
      toast({ title: 'Photo saved' });
    } catch (error) {
      console.error('Failed to save photo:', error);
      toast({ title: 'Could not save that photo', variant: 'destructive' });
    } finally {
      if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setSavingPhoto(false);
    }
  };

  const saveEditing = async () => {
    setSaving(true);
    try {
      // Combine keyPoints array back to string with " | " separator
      const keyInsightsString = (draft.keyPoints || []).filter(k => k.trim()).join(' | ');
      
      // Update in Supabase
      await updateAttendee(attendee.id, {
        name: draft.name,
        company: draft.company,
        designation: draft.designation,
        industry: draft.sector,
        city: draft.location,
        linkedin_url: draft.linkedin,
        profile_pic_url: draft.photo,
        key_insights: keyInsightsString || undefined,
      });

      // Update local state
      onUpdateAttendee?.(draft);
      setIsEditing(false);

      toast({
        title: 'Success',
        description: 'Attendee details updated successfully',
      });
    } catch (error) {
      console.error('Failed to update attendee:', error);
      toast({
        title: 'Error',
        description: 'Failed to update attendee details',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const photoUrl = isEditing ? draft.photo : attendee.photo;
  const avatarSrc = getAvatarUrl(attendee.name, photoUrl, attendee.id);
  const talkingPoints = splitTalkingPoints((attendee.keyPoints || []).join('\n'));
  const iceBreakers = splitIceBreakers((attendee.iceBreakers || []).join('\n'));
  const cityLabel = attendee.location?.trim() || '-';

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => { if (!next) unlockUi(); onOpenChange(next); }}>
      <DialogContent 
        hideClose
        className="fixed bottom-0 left-[50%] top-auto flex max-h-[92dvh] w-[calc(100vw-0.5rem)] max-w-none translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl border-0 bg-popover p-0 shadow-2xl data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:bottom-auto sm:top-[50%] sm:max-h-[85vh] sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:translate-y-[-50%] sm:rounded-2xl lg:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('[data-radix-dropdown-menu-content], [data-radix-popper-content-wrapper]')) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">{attendee.name}</DialogTitle>
        <DialogDescription className="sr-only">
          {attendee.designation ? `${attendee.designation} at ${attendee.company || 'this event'}` : 'Person profile'}
        </DialogDescription>

          {/* Compact Header */}
          <div className="relative shrink-0 border-b border-border bg-popover/95 px-3 py-2.5 backdrop-blur-sm sm:px-5 sm:py-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full hover:bg-accent sm:top-3 sm:right-3"
              onClick={closeModal}
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Avatar - tap for view / choose / take, not always-visible buttons */}
              {(() => {
                const avatarFace = avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={attendee.name}
                    className={`h-12 w-12 rounded-full border-2 border-border object-cover sm:h-16 sm:w-16 ${
                      attendee.competitor ? 'ring-2 ring-red-500/30' : ''
                    }`}
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-slate-700 sm:h-16 sm:w-16 dark:bg-slate-600 ${
                      attendee.competitor ? 'ring-2 ring-red-500/30' : ''
                    }`}>
                    <User className="h-6 w-6 text-slate-300 sm:h-8 sm:w-8 dark:text-slate-400" />
                  </div>
                );

                const avatarWithBadges = (
                  <div className="relative shrink-0">
                    {avatarFace}
                    {attendee.speaker && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-background shadow-md">
                        <Mic className="w-2.5 h-2.5 sm:w-2.5 sm:h-2.5" />
                      </div>
                    )}
                    {canEdit && (
                      <span className={`absolute flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm sm:h-6 sm:w-6 ${
                        attendee.speaker ? '-bottom-0.5 -left-0.5' : '-bottom-0.5 -right-0.5'
                      }`}>
                        <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </span>
                    )}
                  </div>
                );

                return (
                  <PhotoPicker
                    previewUrl={photoUrl || null}
                    onFile={openPhotoFile}
                    allowChange={canEdit}
                    disabled={savingPhoto}
                  >
                    {avatarWithBadges}
                  </PhotoPicker>
                );
              })()}

              {/* Name and Actions */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full bg-background text-sm sm:text-lg font-semibold"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate">{attendee.name}</h2>
                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-full hover:bg-accent p-0"
                        aria-label="LinkedIn"
                        onClick={() => {
                          if (attendee.linkedin) {
                            window.open(attendee.linkedin, '_blank', 'noopener,noreferrer');
                          } else {
                            setLinkedInOpen(true);
                          }
                        }}
                      >
                        <Linkedin className="h-4 w-4 sm:h-4 sm:w-4 text-[#0A66C2]" />
                      </Button>
                      {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 sm:w-8 sm:h-8 p-0 hover:bg-transparent"
                        aria-label={isEditing ? 'Close edit' : 'Edit details'}
                        onClick={() => (isEditing ? cancelEditing() : startEditing())}
                      >
                        {isEditing ? <X className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" /> : <Pencil className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />}
                      </Button>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                  {displayStatus && STATUS_OPTIONS[displayStatus] && (
                    <Badge className={`bg-status-${displayStatus} text-white text-[9px] sm:text-xs px-1 py-0 sm:px-1.5`}>
                      {STATUS_OPTIONS[displayStatus].label}
                    </Badge>
                  )}
                </div>
                {canEdit && !isEditing ? <p className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">Tap the photo to view or change it</p> : null}
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="space-y-2.5 sm:space-y-3">
            {/* Details Section */}
            <div className="bg-muted/30 rounded-lg p-2.5 sm:p-4">
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Name</p>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="bg-background text-sm h-9" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">LinkedIn URL</p>
                    <Input
                      value={draft.linkedin ?? ''}
                      onChange={(e) => setDraft({ ...draft, linkedin: e.target.value || undefined })}
                      className="bg-background text-sm h-9"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Company</p>
                    <Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} className="bg-background text-sm h-9" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Industry</p>
                    <Input
                      value={draft.sector ?? ''}
                      onChange={(e) => setDraft({ ...draft, sector: e.target.value || undefined })}
                      className="bg-background text-sm h-9"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Designation</p>
                    <Input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} className="bg-background text-sm h-9" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">City</p>
                    <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className="bg-background text-sm h-9" />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <p className="text-xs text-muted-foreground">Profile photo (square) - tap the picture above</p>
                    <Input
                      value={draft.photo ?? ''}
                      onChange={(e) => setDraft({ ...draft, photo: e.target.value || '' })}
                      className="bg-background text-sm h-9"
                      placeholder="Or paste a photo URL from the sheet"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Key Insights</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDraft({ ...draft, keyPoints: [...(draft.keyPoints || []), ''] })}
                        className="h-7 px-2 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Insight
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {(draft.keyPoints || []).map((point, index) => (
                        <div key={index} className="flex gap-2">
                          <Textarea
                            value={point}
                            onChange={(e) => {
                              const newPoints = [...(draft.keyPoints || [])];
                              newPoints[index] = e.target.value;
                              setDraft({ ...draft, keyPoints: newPoints });
                            }}
                            className="bg-background text-sm min-h-[60px] resize-none"
                            placeholder={`Insight ${index + 1}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newPoints = (draft.keyPoints || []).filter((_, i) => i !== index);
                              setDraft({ ...draft, keyPoints: newPoints });
                            }}
                            className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {(draft.keyPoints || []).length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No insights added yet. Click "Add Insight" to add one.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Company</p>
                    <p className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground">{attendee.company || '-'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Industry</p>
                    <p className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground">{attendee.sector || '-'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Designation</p>
                    <p className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground">{attendee.designation || '-'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">City</p>
                    <p className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground">{cityLabel}</p>
                  </div>
                </div>
              )}

            {isEditing && (
              <div className="flex justify-end gap-2 pt-3 border-t border-border mt-3">
                <Button type="button" variant="outline" size="sm" onClick={cancelEditing} className="text-xs sm:text-sm h-8 sm:h-9">
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveEditing}
                  disabled={saving}
                  className="text-xs sm:text-sm h-8 sm:h-9"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            )}
            </div>

            {/* Key Insights and Notes */}
            <div className="space-y-2.5 sm:space-y-3">
              {meetingBrief && (meetingBrief.followup || meetingBrief.nextAction || meetingBrief.summary) && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">After the meeting</p>
                  {meetingBrief.nextAction && <p className="mt-1 text-xs text-slate-800 dark:text-slate-200">{meetingBrief.nextAction}</p>}
                  {meetingBrief.summary && !meetingBrief.nextAction && <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{meetingBrief.summary}</p>}
                  {meetingBrief.followup && (
                    <Button size="sm" variant="ghost" className="mt-2 h-8 px-2 text-xs" onClick={() => navigator.clipboard.writeText(meetingBrief.followup)}>
                      <Copy className="mr-1 h-3 w-3" />Copy follow-up
                    </Button>
                  )}
                </div>
              )}

              {talkingPoints.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white mb-2">Talking points</h3>
                  <ul className="space-y-2 sm:space-y-2.5">
                    {talkingPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <p className="min-w-0 flex-1 text-[13px] leading-relaxed sm:text-sm">{formatTalkingPoint(point)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {talkingPoints.length === 0 && iceBreakers.length === 0 && (
                <p className="text-[11px] text-muted-foreground">Import a profile or talking-points file to fill this card.</p>
              )}
              {iceBreakers.length > 0 && (
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white mb-2">Ice breakers</h3>
                  <ul className="space-y-2 sm:space-y-2.5">
                    {iceBreakers.map((point, index) => (
                      <li key={index} className="min-w-0 pl-0.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-100 sm:text-sm">
                        {formatIceBreaker(point)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {attendee.website && (
                <p className="text-xs text-slate-500">
                  <a href={attendee.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{attendee.website}</a>
                </p>
              )}

              {/* User Insights Section */}
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Directory brief</h3>
                    <p className="text-[10px] text-muted-foreground">Visible to everyone on this event.</p>
                  </div>
                  {canEdit && !isEditingInsights && insights && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingInsights(true)}
                      className="h-7 px-2 text-xs"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {isEditingInsights ? (
                  <div className="space-y-2">
                    <Textarea
                      value={insights}
                      onChange={(e) => setInsights(e.target.value)}
                      placeholder="Add your insights about this attendee..."
                      className="min-h-[80px] text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditingInsights(false);
                          loadInsights(); // Reset to original
                        }}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveInsights}
                        disabled={isSavingInsights}
                        className="h-8 text-xs"
                      >
                        {isSavingInsights ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : insights ? (
                  <p className="text-[11px] sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {insights}
                  </p>
                ) : canEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingInsights(true)}
                    className="w-full h-9 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add directory brief
                  </Button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No directory brief yet.</p>
                )}
              </div>

              <div className="border-t border-border pt-3" ref={notesSectionRef}>
                <h3 className="mb-1 text-xs font-semibold text-slate-900 sm:text-sm dark:text-white">Private notes</h3>
                <p className="mb-2 text-[10px] text-muted-foreground">Only you can see these, including recordings and follow-ups.</p>
                <div className="mb-2 flex gap-2">
                  <Textarea
                    value={draftNote}
                    onChange={(event) => setDraftNote(event.target.value)}
                    placeholder={`Note about ${attendee.name}…`}
                    className="min-h-[64px] text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  className="mb-3 h-8 text-xs"
                  disabled={savingNote || !draftNote.trim()}
                  onClick={async () => {
                    if (!draftNote.trim()) return;
                    setSavingNote(true);
                    try {
                      const saved = await attendeeDataService.saveNote(attendee.id, draftNote.trim());
                      setNotes((current) => [saved, ...current]);
                      setDraftNote('');
                    } finally {
                      setSavingNote(false);
                    }
                  }}
                >
                  {savingNote ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                  Save note
                </Button>
                {loadingNotes ? (
                  <p className="text-[11px] text-muted-foreground">Loading notes…</p>
                ) : notes.length ? (
                  <div className="space-y-2">
                    {notes.slice(0, 6).map((note) => (
                      <div key={note.id} className="rounded-lg border border-border px-3 py-2">
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">{note.text}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{formatWhen(note.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No typed notes yet.</p>
                )}
              </div>

              <div className="border-t border-border pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Recorded conversations</h3>
                </div>
                {conversations.length ? conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className="mb-2 w-full rounded-lg border border-border px-3 py-2 text-left"
                    onClick={() => {
                      closeModal();
                      openJellySoon({ mode: 'voice', conversationId: conversation.id, attendeeId: attendee.id, eventId });
                    }}
                  >
                    <p className="text-xs font-medium text-slate-900 dark:text-white">{conversation.title || 'Conversation'}</p>
                    <p className="text-[11px] text-slate-500">
                      {conversation.started_at ? formatWhen(conversation.started_at) : 'Draft'}
                      {conversation.duration_seconds ? ` · ${Math.round(conversation.duration_seconds / 60)} min` : ''}
                    </p>
                    {conversationNotes[conversation.id] && (
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{conversationNotes[conversation.id]}</p>
                    )}
                  </button>
                )) : (
                  <p className="text-[11px] text-muted-foreground">No captured conversations with this person yet.</p>
                )}
              </div>
            </div>
          </div>
          </div>

          {!isEditing && (
            <footer className="shrink-0 border-t border-border bg-popover/95 px-3 py-2.5 backdrop-blur-sm sm:px-5">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-10 flex-1 text-xs sm:text-sm"
                  onClick={() => {
                    const detail: JellyOpenDetail = {
                      mode: 'voice',
                      autoStart: true,
                      attendeeId: attendee.id,
                      attendeeName: attendee.name,
                      companyName: attendee.company,
                      eventId,
                      eventName,
                      suggestedTitle: [attendee.name, eventName, new Date().toLocaleString()].filter(Boolean).join(' · '),
                    };
                    closeModal();
                    openJellySoon(detail);
                  }}
                >
                  <Mic className="mr-1.5 h-3.5 w-3.5" />
                  Record
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 flex-1 text-xs text-foreground sm:text-sm"
                  onClick={() => {
                    const detail: JellyOpenDetail = {
                      mode: 'chat',
                      attendeeId: attendee.id,
                      attendeeName: attendee.name,
                      companyName: attendee.company,
                      eventId,
                      eventName,
                      prompt: `Brief me on ${attendee.name}${attendee.company ? ` at ${attendee.company}` : ''}${eventName ? ` for ${eventName}` : ''}. Who they are, what to say, past notes, and any follow-up I owe.`,
                    };
                    closeModal();
                    openJellySoon(detail);
                  }}
                >
                  Brief me
                </Button>
              </div>
            </footer>
          )}
      </DialogContent>
    </Dialog>

      <Dialog open={linkedInOpen} onOpenChange={setLinkedInOpen}>
        <DialogContent className="sm:max-w-md bg-popover">
          <DialogHeader>
            <DialogTitle>Add LinkedIn Profile</DialogTitle>
            <DialogDescription>
              Enter the LinkedIn profile URL for {attendee.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={linkedInUrl}
              onChange={(e) => setLinkedInUrl(e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className="bg-background"
            />
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setLinkedInOpen(false);
                  setLinkedInUrl('');
                }}
                disabled={savingLinkedIn}
              >
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  if (!linkedInUrl.trim()) {
                    toast({
                      title: 'Error',
                      description: 'Please enter a LinkedIn URL',
                      variant: 'destructive',
                    });
                    return;
                  }
                  
                  setSavingLinkedIn(true);
                  try {
                    await updateAttendee(attendee.id, {
                      linkedin_url: linkedInUrl,
                    });
                    
                    // Update local state
                    const updatedAttendee = { ...attendee, linkedin: linkedInUrl };
                    onUpdateAttendee?.(updatedAttendee);
                    
                    toast({
                      title: 'Success',
                      description: 'LinkedIn URL added successfully',
                    });
                    
                    setLinkedInOpen(false);
                    setLinkedInUrl('');
                  } catch (error) {
                    console.error('Failed to update LinkedIn URL:', error);
                    toast({
                      title: 'Error',
                      description: 'Failed to add LinkedIn URL',
                      variant: 'destructive',
                    });
                  } finally {
                    setSavingLinkedIn(false);
                  }
                }}
                disabled={savingLinkedIn}
              >
                {savingLinkedIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 w-full max-w-[280px] shadow-2xl left-[calc(50%-4mm)] translate-x-[-50%] relative">
            <div className="flex items-start gap-3">
              <X className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Delete this note?
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-tight">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    <ImageCropDialog
      open={Boolean(cropSrc)}
      onOpenChange={(next) => {
        if (!next) {
          if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }
      }}
      imageSrc={cropSrc || ''}
      title="Crop profile photo"
      aspectRatio={1}
      circularCrop
      onCropComplete={saveCroppedPhoto}
    />
    </>
  );
};

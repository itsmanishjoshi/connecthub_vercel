import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle2, AlertCircle, CalendarIcon, Lock } from 'lucide-react';
import { createEvent, updateEvent, uploadEventPicture } from '@/lib/eventsApi';
import { useAuth } from '@/context/SimpleAuthContext';
import { format } from 'date-fns';
import { ImageCropDialog } from './ImageCropDialog';
import { EventPictureField } from './EventPictureField';
import { PeopleIngestPanel } from './PeopleIngestPanel';
import { EventAccessPanel } from './EventAccessPanel';

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateEventModal({ open, onOpenChange, onSuccess }: CreateEventModalProps) {
  const { userId, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'details' | 'upload' | 'success'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ count: number; errors: string[] } | null>(null);
  const [eventPictureFile, setEventPictureFile] = useState<File | null>(null);
  const [eventPicturePreview, setEventPicturePreview] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    place: '',
  });
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [accessPin, setAccessPin] = useState('');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleEventPictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be under 8 MB.');
      return;
    }
    if (tempImageUrl?.startsWith('blob:')) URL.revokeObjectURL(tempImageUrl);
    const url = URL.createObjectURL(file);
    setTempImageUrl(url);
    setCropDialogOpen(true);
  };

  const handleCropComplete = (blob: Blob) => {
    const file = new File([blob], 'event-picture.jpg', { type: 'image/jpeg' });
    if (eventPicturePreview?.startsWith('blob:')) URL.revokeObjectURL(eventPicturePreview);
    setEventPictureFile(file);
    setEventPicturePreview(URL.createObjectURL(file));
    if (tempImageUrl?.startsWith('blob:')) URL.revokeObjectURL(tempImageUrl);
    setTempImageUrl(null);
  };

  const generateSlug = (name: string) => {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36);
    return `${baseSlug}-${timestamp}`;
  };

  const handleCreateEvent = async () => {
    if (!formData.name || !formData.date || !formData.place) {
      setError('Please fill in all required fields');
      return;
    }

    if (isPrivate && accessPin && (accessPin.length !== 4 || !/^\d{4}$/.test(accessPin))) {
      setError('Door code must be 4 digits, or leave it blank');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const slug = generateSlug(formData.name);
      const creatorName = profile?.isAdmin ? 'Admin' : (profile?.firstName || 'User');
      const eventPayload = {
        name: formData.name,
        slug,
        date: formData.date,
        place: formData.place,
        created_by: userId || undefined,
        creator_name: creatorName,
        is_private: isPrivate,
        ...(isPrivate && accessPin ? { access_pin: accessPin } : {}),
      };

      const event = await createEvent(eventPayload);

      if (eventPictureFile) {
        try {
          const eventPictureUrl = await uploadEventPicture(eventPictureFile, event.id);
          await updateEvent(event.id, { event_picture_url: eventPictureUrl });
        } catch (err: unknown) {
          console.error('Failed to upload event picture:', err);
          setError(
            `Event saved, but the picture did not upload (${err instanceof Error ? err.message : 'unknown error'}). You can add a photo later from Edit event.`
          );
        }
      }

      setEventId(event.id);
      setCreatedSlug(event.slug || slug);
      setStep('upload');
    } catch (err: any) {
      console.error('Create event error:', err);
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('details');
    setFormData({
      name: '',
      date: '',
      place: '',
    });
    setStartDate(undefined);
    setEndDate(undefined);
    setStartDateOpen(false);
    setEndDateOpen(false);
    setIsPrivate(false);
    setAccessPin('');
    setEventId(null);
    setCreatedSlug(null);
    setUploadResult(null);
    setError(null);
    setEventPictureFile(null);
    setEventPicturePreview(null);
    setCropDialogOpen(false);
    if (tempImageUrl?.startsWith('blob:')) URL.revokeObjectURL(tempImageUrl);
    setTempImageUrl(null);
    onOpenChange(false);
    if (step === 'success') {
      onSuccess();
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
        <DialogHeader>
          <DialogTitle>
            {step === 'details' && 'Create event'}
            {step === 'upload' && 'People and access'}
            {step === 'success' && 'Event is ready'}
          </DialogTitle>
          <DialogDescription>
            {step === 'details' && 'Who can find this event, and what they can change later'}
            {step === 'upload' && 'Invite the team, then bring the room in'}
            {step === 'success' && 'Your event is ready'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="Event name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Event Date *</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'dd MMM yyyy') : 'Start Date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        if (date) {
                          if (endDate) {
                            handleInputChange('date', `${format(date, 'dd MMM')} - ${format(endDate, 'dd MMM, yyyy')}`);
                          } else {
                            handleInputChange('date', format(date, 'dd MMM, yyyy'));
                          }
                        }
                        setStartDateOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'dd MMM yyyy') : 'End Date (Optional)'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        setEndDate(date);
                        if (startDate) {
                          if (date) {
                            handleInputChange('date', `${format(startDate, 'dd MMM')} - ${format(date, 'dd MMM, yyyy')}`);
                          } else {
                            handleInputChange('date', format(startDate, 'dd MMM, yyyy'));
                          }
                        }
                        setEndDateOpen(false);
                      }}
                      disabled={(date) => startDate ? date < startDate : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {formData.date && (
                <p className="text-sm text-muted-foreground">{formData.date}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="place">Event Place *</Label>
              <Input
                id="place"
                placeholder="Location"
                value={formData.place}
                onChange={(e) => handleInputChange('place', e.target.value)}
              />
            </div>

            <EventPictureField
              inputId="create-event-picture"
              preview={eventPicturePreview}
              onPick={handleEventPictureChange}
              onRemove={() => {
                if (eventPicturePreview?.startsWith('blob:')) URL.revokeObjectURL(eventPicturePreview);
                setEventPicturePreview(null);
                setEventPictureFile(null);
              }}
            />

            {/* Privacy Settings */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="is-private" className="cursor-pointer">Private event</Label>
                    <p className="text-xs text-muted-foreground">Hidden on home until you invite someone</p>
                  </div>
                </div>
                <Switch
                  id="is-private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                />
              </div>
              
              {isPrivate && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="access-pin">Door code (optional)</Label>
                  <Input
                    id="access-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4 digits"
                    value={accessPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setAccessPin(value);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Invite by username is the usual path. A door code is only for someone who already has the event link.
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={handleCreateEvent}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Event...
                </>
              ) : (
                'Create Event'
              )}
            </Button>
          </div>
        )}

        {step === 'upload' && eventId && (
          <div className="space-y-4">
            <EventAccessPanel eventId={eventId} isPrivate={isPrivate} />
            <PeopleIngestPanel eventId={eventId} onSaved={() => setStep('success')} />
            <Button variant="ghost" onClick={() => setStep('success')} className="w-full">
              Continue without importing
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <div>
              <p className="text-lg font-medium mb-2">Ready for the room</p>
              <p className="text-sm text-muted-foreground">
                Invite editors if others should change details. Notes and recordings stay private to each person.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const slug = createdSlug;
                handleClose();
                if (slug) navigate(`/connect-hub/hub?event=${encodeURIComponent(slug)}`);
              }}
            >
              Open event
            </Button>
            <Button variant="ghost" onClick={handleClose} className="w-full">
              Back to home
            </Button>
          </div>
        )}
      </DialogContent>

    </Dialog>
    <ImageCropDialog
      open={cropDialogOpen}
      onOpenChange={setCropDialogOpen}
      imageSrc={tempImageUrl || ''}
      title="Crop event photo"
      aspectRatio={16 / 9}
      onCropComplete={handleCropComplete}
    />
    </>
  );
}

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertCircle, CalendarIcon, Trash2, Lock } from 'lucide-react';
import { updateEvent, uploadEventPicture, deleteEvent, type Event } from '@/lib/eventsApi';
import { format } from 'date-fns';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { ImageCropDialog } from './ImageCropDialog';
import { EventPictureField } from './EventPictureField';
import { PeopleIngestPanel } from './PeopleIngestPanel';
import { EventAccessPanel } from './EventAccessPanel';
import { useAuth } from '@/context/SimpleAuthContext';
import { canDeleteEvent } from '@/lib/eventAccess';

interface EditEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event | null;
  onSuccess: () => void;
}

export function EditEventModal({ open, onOpenChange, event, onSuccess }: EditEventModalProps) {
  const { userId, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventPictureFile, setEventPictureFile] = useState<File | null>(null);
  const [eventPicturePreview, setEventPicturePreview] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  const [clearPicture, setClearPicture] = useState(false);

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

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name || '',
        date: event.date || '',
        place: event.place || '',
      });
      setEventPicturePreview(event.event_picture_url || null);
      setEventPictureFile(null);
      setClearPicture(false);
      setIsPrivate(event.is_private || false);
      setAccessPin('');
    }
  }, [event]);

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
    setClearPicture(false);
    if (tempImageUrl?.startsWith('blob:')) URL.revokeObjectURL(tempImageUrl);
    setTempImageUrl(null);
  };

  const handleUpdateEvent = async () => {
    if (!event || !formData.name || !formData.date || !formData.place) {
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
      const updateData: any = {
        name: formData.name,
        date: formData.date,
        place: formData.place,
        is_private: isPrivate,
      };
      if (!isPrivate) {
        updateData.access_pin = null;
      } else if (accessPin) {
        updateData.access_pin = accessPin;
      }

      if (eventPictureFile) {
        try {
          const uploadedUrl = await uploadEventPicture(eventPictureFile, event.id);
          updateData.event_picture_url = uploadedUrl;
        } catch (err: unknown) {
          console.error('Failed to upload event picture:', err);
          setError(
            `Details can still be saved. Picture upload failed (${err instanceof Error ? err.message : 'unknown error'}).`
          );
        }
      } else if (clearPicture) {
        updateData.event_picture_url = null;
      }

      await updateEvent(event.id, updateData);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || 'Failed to update event');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
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
    setError(null);
    setEventPictureFile(null);
    setEventPicturePreview(null);
    setClearPicture(false);
    setDeleteDialogOpen(false);
    setCropDialogOpen(false);
    if (tempImageUrl?.startsWith('blob:')) URL.revokeObjectURL(tempImageUrl);
    setTempImageUrl(null);
    onOpenChange(false);
  };

  const handleDeleteEvent = async () => {
    if (!event) return;

    setLoading(true);
    setError(null);

    try {
      await deleteEvent(event.id);
      setDeleteDialogOpen(false);
      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || 'Failed to delete event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] lg:max-w-[700px] max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Update the event details
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Event Name *</Label>
            <Input
              id="edit-name"
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
            <Label htmlFor="edit-place">Event Place *</Label>
            <Input
              id="edit-place"
              placeholder="Location"
              value={formData.place}
              onChange={(e) => handleInputChange('place', e.target.value)}
            />
          </div>

          <EventPictureField
            inputId="edit-event-picture"
            preview={eventPicturePreview}
            onPick={handleEventPictureChange}
            onRemove={() => {
              if (eventPicturePreview?.startsWith('blob:')) URL.revokeObjectURL(eventPicturePreview);
              setEventPicturePreview(null);
              setEventPictureFile(null);
              setClearPicture(true);
            }}
          />

          {/* Privacy Settings */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="edit-is-private" className="cursor-pointer">Private event</Label>
                    <p className="text-xs text-muted-foreground">Hidden on home until invited</p>
                  </div>
                </div>
                <Switch
                  id="edit-is-private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                />
              </div>
              
              {isPrivate && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="edit-access-pin">Door code (optional)</Label>
                  <Input
                    id="edit-access-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder={event?.has_door_code ? 'Leave blank to keep current' : '4 digits'}
                    value={accessPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setAccessPin(value);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {event?.has_door_code
                      ? 'A door code is already set. Enter a new one only if you want to replace it. The current code cannot be shown again.'
                      : 'Invite people below. A door code is only for someone who already has the event link.'}
                  </p>
                </div>
              )}
            </div>

            {event?.id && <EventAccessPanel eventId={event.id} isPrivate={isPrivate} />}

          {event && (
            <PeopleIngestPanel eventId={event.id} onSaved={onSuccess} />
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleUpdateEvent}
              disabled={loading}
              className="flex-1 order-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all border-0 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Event'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="order-2 sm:order-2 border-0 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-sm"
            >
              Cancel
            </Button>
            {canDeleteEvent(event, userId, isAdmin) && (
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={loading}
              className="order-3 sm:order-3 border-0 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 shadow-sm"
            >
              <Trash2 className="w-4 h-4 sm:mr-0" />
              <span className="sm:hidden ml-2">Delete</span>
            </Button>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteEvent}
          title="Delete Event"
          description={`Are you sure you want to delete "${event?.name}"? This action cannot be undone and will also delete all attendees associated with this event.`}
        />

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

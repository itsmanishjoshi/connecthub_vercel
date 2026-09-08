import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { createAttendee, updateAttendee, deleteAttendee, type Attendee, type CreateAttendeeData, type UpdateAttendeeData } from '@/lib/eventsApi';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface AttendeeManageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  attendee?: Attendee | null;
  mode: 'add' | 'edit';
  onSuccess: () => void;
}

export function AttendeeManageModal({ open, onOpenChange, eventId, attendee, mode, onSuccess }: AttendeeManageModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    designation: '',
    company: '',
    industry: '',
    location: '',
    profile_pic_url: '',
    linkedin_url: '',
    key_insights: '',
    ice_breakers: '',
    website_url: '',
    event_association: '',
  });

  useEffect(() => {
    if (attendee && mode === 'edit') {
      setFormData({
        name: attendee.name || '',
        designation: attendee.designation || '',
        company: attendee.company || '',
        industry: attendee.industry || '',
        location: (attendee.city || attendee.location || '').trim(),
        profile_pic_url: attendee.profile_pic_url || '',
        linkedin_url: attendee.linkedin_url || '',
        key_insights: attendee.key_insights || '',
        ice_breakers: attendee.ice_breakers || '',
        website_url: attendee.website_url || '',
        event_association: attendee.event_association || '',
      });
    } else {
      setFormData({
        name: '',
        designation: '',
        company: '',
        industry: '',
        location: '',
        profile_pic_url: '',
        linkedin_url: '',
        key_insights: '',
        ice_breakers: '',
        website_url: '',
        event_association: '',
      });
    }
    setError(null);
  }, [attendee, mode, open]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'add') {
        const data: CreateAttendeeData = {
          event_id: eventId,
          name: formData.name.trim(),
          designation: formData.designation.trim() || undefined,
          company: formData.company.trim() || undefined,
          industry: formData.industry.trim() || undefined,
          location: formData.location.trim() || undefined,
          profile_pic_url: formData.profile_pic_url.trim() || undefined,
          linkedin_url: formData.linkedin_url.trim() || undefined,
          key_insights: formData.key_insights.trim() || undefined,
          ice_breakers: formData.ice_breakers.trim() || undefined,
          website_url: formData.website_url.trim() || undefined,
        };
        await createAttendee(data);
      } else if (attendee) {
        const data: UpdateAttendeeData = {
          name: formData.name.trim(),
          designation: formData.designation.trim() || undefined,
          company: formData.company.trim() || undefined,
          industry: formData.industry.trim() || undefined,
          location: formData.location.trim() || undefined,
          profile_pic_url: formData.profile_pic_url.trim() || undefined,
          linkedin_url: formData.linkedin_url.trim() || undefined,
          key_insights: formData.key_insights.trim() || undefined,
          ice_breakers: formData.ice_breakers.trim() || undefined,
          website_url: formData.website_url.trim() || undefined,
        };
        await updateAttendee(attendee.id, data);
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || `Failed to ${mode} attendee`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!attendee) return;

    setLoading(true);
    setError(null);

    try {
      await deleteAttendee(attendee.id);
      setDeleteDialogOpen(false);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete attendee');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      designation: '',
      company: '',
      industry: '',
      location: '',
      profile_pic_url: '',
      linkedin_url: '',
      key_insights: '',
      ice_breakers: '',
      website_url: '',
      event_association: '',
    });
    setError(null);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {mode === 'add' ? 'Add New Attendee' : 'Edit Attendee'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {mode === 'add' 
                ? 'Enter the attendee details. Only name is required.' 
                : 'Update the attendee information.'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <div className="overflow-y-auto flex-1 pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              {/* Name - Required - Full width */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name" className="text-sm">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              {/* Designation */}
              <div className="space-y-1.5">
                <Label htmlFor="designation" className="text-sm">Designation</Label>
                <Input
                  id="designation"
                  placeholder="Job title or role"
                  value={formData.designation}
                  onChange={(e) => handleInputChange('designation', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              {/* Company */}
              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-sm">Company</Label>
                <Input
                  id="company"
                  placeholder="Company or organization"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              {/* Industry */}
              <div className="space-y-1.5">
                <Label htmlFor="industry" className="text-sm">Industry</Label>
                <Input
                  id="industry"
                  placeholder="Industry or sector"
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-sm">Location</Label>
                <Input
                  id="location"
                  placeholder="City or location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              {/* Profile Picture URL - Full width */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="profile_pic_url" className="text-sm">Profile Picture URL</Label>
                <Input
                  id="profile_pic_url"
                  placeholder="https://example.com/photo.jpg"
                  value={formData.profile_pic_url}
                  onChange={(e) => handleInputChange('profile_pic_url', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              {/* LinkedIn URL - Full width */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="linkedin_url" className="text-sm">LinkedIn URL</Label>
                <Input
                  id="linkedin_url"
                  placeholder="https://linkedin.com/in/username"
                  value={formData.linkedin_url}
                  onChange={(e) => handleInputChange('linkedin_url', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="website_url" className="text-sm">Website</Label>
                <Input
                  id="website_url"
                  placeholder="https://company.com"
                  value={formData.website_url}
                  onChange={(e) => handleInputChange('website_url', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              {/* Key Insights - Full width */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="key_insights" className="text-sm">Key Insights</Label>
                <Input
                  id="key_insights"
                  placeholder="Separate multiple insights with |"
                  value={formData.key_insights}
                  onChange={(e) => handleInputChange('key_insights', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ice_breakers" className="text-sm">Ice breakers</Label>
                <Input
                  id="ice_breakers"
                  placeholder="Talking points, separated by |"
                  value={formData.ice_breakers}
                  onChange={(e) => handleInputChange('ice_breakers', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>

              {/* Event Association - Full width */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="event_association" className="text-sm">Event Association</Label>
                <Input
                  id="event_association"
                  placeholder="e.g., Speaker, Sponsor, Attendee"
                  value={formData.event_association}
                  onChange={(e) => handleInputChange('event_association', e.target.value)}
                  disabled={loading}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0">
            {mode === 'edit' && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={loading}
                className="sm:mr-auto h-9"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !formData.name.trim()}
              className="h-9"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === 'add' ? 'Add Attendee' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Attendee"
        description={`Are you sure you want to delete ${attendee?.name}? This action cannot be undone.`}
      />
    </>
  );
}

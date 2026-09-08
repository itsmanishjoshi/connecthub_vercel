import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { passwordError } from '@/lib/passwordRules';
import { useAuth } from '@/context/SimpleAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Download, Trash2, User, Lock, Camera, Save, Loader2, LogOut, QrCode, RefreshCw, Users, UserPlus, CheckSquare, Square, Shield } from 'lucide-react';
import { AppRibbonBar, AppRibbonBrand, AppRibbonRow } from '@/components/AppRibbon';
import { toast } from 'sonner';
import { resolveAvatarUrl, uploadUserAvatar } from '@/lib/avatarUpload';
import { ImageCropDialog } from '@/components/ImageCropDialog';
import { PhotoPicker } from '@/components/PhotoPicker';
import { QRCodeGenerator, generateVCard, downloadQRCode } from '@/components/QRCodeGenerator';
import { IdentityQRCard } from '@/components/IdentityQRCard';
import { QRCodeModal } from '@/components/QRCodeModal';
import { supabase } from '@/lib/supabaseClient';
import * as authService from '@/lib/authService';
import { fetchEvents } from '@/lib/eventsApi';
import type { Event } from '@/lib/eventsApi';

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    profile,
    userId,
    deleteAccount, 
    changePassword, 
    updateProfile, 
    refreshProfile, 
    signOut, 
    isAdmin,
    getAllUsers,
    addUser,
    deleteUser: deleteUserAuth,
  } = useAuth();
  
  const [activeTab, setActiveTab] = useState('general');
  const [profileSubTab, setProfileSubTab] = useState('personal');
  
  // Personal Info state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNo: '',
    company: '',
    designation: '',
    city: '',
    linkedinUrl: '',
    avatarUrl: '',
  });
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete account dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // QR Code state
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrCreatedAt, setQrCreatedAt] = useState<string>('');

  // Export functionality state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // User Management state (Admin only)
  interface UserItem {
    username: string;
    password: string;
    id: string;
  }
  const [users, setUsers] = useState<UserItem[]>([]);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Check URL params for tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && (tab === 'general' || tab === 'profile' || tab === 'users')) {
      setActiveTab(tab);
    }
  }, [location]);

  // Load profile data
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        mobileNo: profile.mobileNo || '',
        company: profile.company || '',
        designation: profile.designation || '',
        city: profile.city || '',
        linkedinUrl: profile.linkedinUrl || '',
        avatarUrl: profile.avatarUrl || '',
      });
      setAvatarPreview(resolveAvatarUrl(profile.avatarUrl) || '');

      // Load QR code
      loadQRCode();
    }
  }, [profile]);

  const loadQRCode = async () => {
    if (!profile) {
      return;
    }
    try {
      // Get QR code with metadata
      const qrMetadata = await authService.getQRCodeMetadata(profile.id);
      
      if (qrMetadata) {
        setQrCodeData(qrMetadata.qr_data);
        setQrCreatedAt(qrMetadata.created_at);
        setQrGenerated(true);
      }
      
      // Load QR code URL from profile
      const qrUrl = await authService.getQRCodeUrl(profile.id);
      if (qrUrl) {
        setQrCodeUrl(qrUrl);
      }
    } catch (error) {
      console.error('Failed to load QR code (non-critical):', error);
      // Don't throw - just continue without QR code
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'users') {
      loadUsers();
    }
  }, [isAdmin, activeTab]);

  const loadUsers = async () => {
    if (!isAdmin) return;
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    setAvatarFile(croppedBlob);
    const previewUrl = URL.createObjectURL(croppedBlob);
    setAvatarPreview(previewUrl);
    toast.success('Photo cropped! Click Save to update your profile.');
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) {
      return formData.avatarUrl;
    }

    if (!userId) {
      toast.error('Please log in to upload profile picture');
      return formData.avatarUrl;
    }

    try {
      return await uploadUserAvatar(userId, avatarFile);
    } catch (error) {
      console.error('Unexpected error in avatar upload:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload profile photo');
      return formData.avatarUrl;
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.firstName.trim() || !formData.company.trim()) {
      toast.error('Name and Company are required');
      return;
    }

    setIsSaving(true);
    
    try {
      const avatarUrl = await uploadAvatar();

      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobileNo: formData.mobileNo,
        company: formData.company,
        designation: formData.designation,
        city: formData.city,
        linkedinUrl: formData.linkedinUrl,
        avatarUrl: avatarUrl,
      });

      await refreshProfile();

      setAvatarFile(null);
      setAvatarPreview(resolveAvatarUrl(avatarUrl) || '');

      if (avatarFile) {
        toast.success('Profile picture saved successfully!');
      } else {
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount(deletePassword);
      toast.success('Account deleted successfully');
      setDeleteDialogOpen(false);
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
      setDeletePassword('');
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    const problem = passwordError(passwordData.newPassword, passwordData.confirmPassword, passwordData.oldPassword);
    if (problem) {
      toast.error(problem);
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordData.oldPassword, passwordData.newPassword);
      toast.success('Password changed successfully');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // QR Code handlers
  const handleGenerateQR = async () => {
    if (!profile) {
      toast.error('Profile not found');
      return;
    }

    setIsGeneratingQR(true);
    
    try {
      // Validate required fields
      if (!formData.firstName || !formData.lastName) {
        toast.error('First name and last name are required');
        setIsGeneratingQR(false);
        return;
      }

      // Generate vCard data
      const vCardData = generateVCard({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobileNo: formData.mobileNo,
        company: formData.company,
        designation: formData.designation,
        city: formData.city,
        linkedinUrl: formData.linkedinUrl,
      });

      // Set data so QR renders - this is the main action
      setQrCodeData(vCardData);
      setQrGenerated(true);
      setIsGeneratingQR(false);
      
      // Try to save to database in background (don't block on this)
      setTimeout(async () => {
        try {
          await authService.saveQRCode(profile.id, vCardData);
          await loadQRCode(); // Reload to get created_at timestamp
        } catch (error) {
          console.error('Settings: Failed to save QR code to database (non-critical):', error);
          // Don't show error to user - QR is already generated and visible
        }
      }, 100);
      
      toast.success('QR Code generated successfully!');
    } catch (error) {
      console.error('Settings: Error in QR generation:', error);
      setIsGeneratingQR(false);
      toast.error('Failed to generate QR code. Please try again.');
    }
  };

  const handleDownloadQR = () => {
    const canvas = document.querySelector('.qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      downloadQRCode(canvas, `${formData.firstName}-${formData.lastName}-QR.png`);
      toast.success('QR Code downloaded!');
    }
  };

  // User Management handlers
  const handleAddNewUser = async () => {
    if (!newUserForm.username.trim() || !newUserForm.password.trim()) {
      toast.error('Username and password are required');
      return;
    }

    if (!newUserForm.email.trim()) {
      toast.error('Email is required');
      return;
    }

    setIsAddingUser(true);
    try {
      await addUser(
        newUserForm.username, 
        newUserForm.password, 
        newUserForm.email
      );
      toast.success('User created successfully!');
      setAddUserDialogOpen(false);
      setNewUserForm({ username: '', email: '', password: '' });
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      await deleteUserAuth(userId);
      toast.success('User deleted successfully');
      loadUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleExportData = async () => {
    if (!profile) {
      toast.error('Please log in to export notes');
      return;
    }
    
    try {
      // Load events
      const eventsList = await fetchEvents();
      setEvents(eventsList);
      setSelectedEventIds([]); // Reset selection
      setExportDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load events');
    }
  };

  const handleConfirmExport = async () => {
    if (!profile) return;
    
    if (!userId) {
      toast.error('Sign in again to export your notes.');
      return;
    }

    setIsExporting(true);
    try {
      if (selectedEventIds.length === 0) {
        toast.error('Please select at least one event');
        setIsExporting(false);
        return;
      }

      // Export each selected event separately
      for (const eventId of selectedEventIds) {
        const event = events.find(e => e.id === eventId);
        if (!event) continue;

        try {
          const csvContent = await authService.exportAttendeeNotesCSV(userId, [eventId]);
          
          if (!csvContent || csvContent.split('\n').length <= 1) {
            continue;
          }
          
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `attendee-notes-${event.slug || event.name}-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error(`Error exporting ${event.name}:`, error);
        }
      }

      if (selectedEventIds.length === 1) {
        toast.success('Notes exported successfully!');
      } else {
        toast.success(`${selectedEventIds.length} events exported successfully!`);
      }
      
      setExportDialogOpen(false);
    } catch (error: any) {
      console.error('Export error:', error);
      
      // Show more specific error message
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        toast.error('Notes table not found. Please contact support to set up the database.');
      } else if (error.message?.includes('permission')) {
        toast.error('Permission denied. Please contact support.');
      } else {
        toast.error(error.message || 'Failed to export notes');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEventIds.length === events.length) {
      setSelectedEventIds([]);
    } else {
      setSelectedEventIds(events.map(e => e.id));
    }
  };

  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
      setIsSigningOut(false);
    }
  };

  const menuItems = [
    { id: 'general', label: 'General', icon: Shield },
    { id: 'profile', label: 'Profile', icon: User },
    ...(isAdmin ? [{ id: 'users', label: 'Accounts', icon: Users }] : []),
  ];

  const settingsBackTarget =
    (location.state as { from?: string } | null)?.from || '/';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <AppRibbonBar>
        <AppRibbonRow>
          <AppRibbonBrand title="Settings" leading="back" onLeadingClick={() => navigate(settingsBackTarget)} />
        </AppRibbonRow>
      </AppRibbonBar>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-x-hidden md:flex-row">
        <div className="app-page container mx-auto flex max-w-6xl flex-col gap-6 px-3 py-4 sm:px-4 sm:py-6 md:flex-row">
          {/* Sidebar Navigation - Hidden on mobile, shown as tabs */}
          <div className="md:w-64 md:flex-shrink-0">
            <nav className="window-tab-scroll flex gap-2 pb-2 md:flex-col md:gap-1 md:overflow-x-visible md:pb-0">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors sm:gap-3 sm:px-4 sm:py-3 sm:text-base md:w-full ${
                      activeTab === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="font-medium leading-snug responsive-text-wrap">{item.label}</span>
                  </button>
                );
              })}

              {/* Sign Out Button */}
              <div className="pt-2 sm:pt-4">
                <button
                  onClick={() => setSignOutDialogOpen(true)}
                  className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-left transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm sm:text-base"
                >
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Privacy</CardTitle>
                    <CardDescription>
                      How ConnectHub keeps work and personal notes apart
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Public events are visible to everyone signed in. Private events appear only after you are invited.</p>
                    <p>Speakers and directory details are shared with people on the event. Your notes, recordings, and notebook stay on your account.</p>
                    <p>An administrator can reset your password or remove the account, and can view or export your private notes for support and compliance.</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Users Tab (Admin Only) */}
            {activeTab === 'users' && isAdmin && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Accounts</CardTitle>
                    <CardDescription>
                      Usernames, temporary passwords, and account removal live in Admin - not in event access.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => navigate('/admin', { state: { from: '/settings?tab=users' } })}>
                      <Users className="h-4 w-4 mr-2" />
                      Open Admin
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Profile Tab with Sub-tabs */}
            {activeTab === 'profile' && (
              <Tabs value={profileSubTab} onValueChange={setProfileSubTab} className="w-full">
                <TabsList className="mb-6 grid h-auto w-full grid-cols-3 gap-1 p-1">
                  <TabsTrigger value="personal" className="responsive-tabs-trigger px-2 py-2.5 text-sm sm:px-4 sm:text-base">Personal</TabsTrigger>
                  <TabsTrigger value="security" className="responsive-tabs-trigger px-2 py-2.5 text-sm sm:px-4 sm:text-base">Security</TabsTrigger>
                  <TabsTrigger value="library" className="responsive-tabs-trigger px-2 py-2.5 text-sm sm:px-4 sm:text-base">QR</TabsTrigger>
                </TabsList>

                {/* Personal Sub-tab */}
                <TabsContent value="personal" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Personal Information</CardTitle>
                      <CardDescription>
                        Update your profile information
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Avatar Section */}
                      <div className="flex flex-col items-center space-y-3 pb-6 border-b border-border">
                        <PhotoPicker previewUrl={avatarPreview || null} onFile={handleAvatarFile}>
                          <div className="relative">
                            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-border bg-muted">
                              {avatarPreview ? (
                                <img
                                  key={avatarPreview}
                                  src={avatarPreview}
                                  alt="Profile preview"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-4xl text-muted-foreground">
                                  {formData.firstName?.[0]?.toUpperCase() || '?'}
                                </span>
                              )}
                            </div>
                            <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm">
                              <Camera className="h-4 w-4" />
                            </span>
                          </div>
                        </PhotoPicker>
                        <p className="text-xs text-muted-foreground">Tap the picture to {avatarPreview ? 'view or change it' : 'add a photo'}</p>
                      </div>

                      {/* Form Fields */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">
                              First Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="firstName"
                              value={formData.firstName}
                              onChange={(e) => handleInputChange('firstName', e.target.value)}
                              className="mt-1.5"
                            />
                          </div>

                          <div>
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              value={formData.lastName}
                              onChange={(e) => handleInputChange('lastName', e.target.value)}
                              className="mt-1.5"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="mobileNo">Mobile Number</Label>
                          <Input
                            id="mobileNo"
                            type="tel"
                            value={formData.mobileNo}
                            onChange={(e) => handleInputChange('mobileNo', e.target.value)}
                            className="mt-1.5"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="company">
                              Company <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="company"
                              value={formData.company}
                              onChange={(e) => handleInputChange('company', e.target.value)}
                              className="mt-1.5"
                            />
                          </div>

                          <div>
                            <Label htmlFor="designation">Designation</Label>
                            <Input
                              id="designation"
                              value={formData.designation}
                              onChange={(e) => handleInputChange('designation', e.target.value)}
                              className="mt-1.5"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="linkedinUrl">LinkedIn Profile URL</Label>
                          <Input
                            id="linkedinUrl"
                            type="url"
                            value={formData.linkedinUrl}
                            onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      {/* Save Button */}
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSaving || !formData.firstName.trim() || !formData.company.trim()}
                        className="w-full"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Security Sub-tab */}
                <TabsContent value="security" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Change Password</CardTitle>
                      <CardDescription>
                        Only you can change this. An administrator can still reset it if you forget.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="old-password">Current Password</Label>
                        <Input
                          id="old-password"
                          type="password"
                          value={passwordData.oldPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <Button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="w-full sm:w-auto"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        {isChangingPassword ? 'Changing...' : 'Change Password'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-destructive">Delete Account</CardTitle>
                      <CardDescription>
                        Permanently delete your account
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                      <Button
                        variant="destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Library Sub-tab */}
                <TabsContent value="library" className="space-y-4">
                  {/* QR Code Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <QrCode className="w-5 h-5" />
                        My QR Code
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!qrGenerated ? (
                        <div className="text-center py-8">
                          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <QrCode className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2">Generate Your QR Code</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Create a QR code with your contact information that others can scan
                          </p>
                          <Button
                            onClick={handleGenerateQR}
                            disabled={isGeneratingQR}
                            size="lg"
                            className="w-full sm:w-auto"
                          >
                            {isGeneratingQR ? (
                              <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Generating QR Code...
                              </>
                            ) : (
                              <>
                                <QrCode className="w-5 h-5 mr-2" />
                                Generate My QR Code
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <IdentityQRCard
                            vCardData={qrCodeData}
                            qrImageUrl={qrCodeUrl || undefined}
                            identity={{
                              firstName: formData.firstName,
                              lastName: formData.lastName,
                              email: formData.email,
                              mobileNo: formData.mobileNo,
                              company: formData.company,
                              designation: formData.designation,
                              city: formData.city,
                              linkedinUrl: formData.linkedinUrl,
                              avatarUrl: avatarPreview || formData.avatarUrl,
                            }}
                            qrSize={220}
                          />

                          {qrCreatedAt && (
                            <p className="text-sm text-center text-muted-foreground">
                              Created on {new Date(qrCreatedAt).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                          
                          <div className="grid grid-cols-2 gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setQrModalOpen(true)}
                              className="h-11 col-span-2"
                            >
                              <QrCode className="w-4 h-4 mr-2" />
                              View contact card
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleDownloadQR}
                              className="h-11"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleGenerateQR}
                              disabled={isGeneratingQR}
                              className="h-11"
                            >
                              {isGeneratingQR ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                              )}
                              Recreate
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-password">Enter your password to confirm</Label>
            <Input
              id="delete-password"
              type="password"
              placeholder="Password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && deletePassword.trim()) {
                  handleDeleteAccount();
                }
              }}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePassword('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting || !deletePassword.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Crop Dialog */}
      <ImageCropDialog
        open={cropDialogOpen}
        onClose={() => setCropDialogOpen(false)}
        imageSrc={selectedImageSrc}
        onCropComplete={handleCropComplete}
      />

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You'll need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="bg-red-400 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-600"
            >
              {isSigningOut ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing out...
                </span>
              ) : (
                'Sign Out'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signing Out Animation Overlay */}
      {isSigningOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20 animate-pulse" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
            <div className="text-center space-y-2 animate-in slide-in-from-bottom-4 duration-700">
              <p className="text-lg font-semibold">Signing out...</p>
              <p className="text-sm text-muted-foreground">See you soon!</p>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        vCardData={qrCodeData || generateVCard({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          mobileNo: formData.mobileNo,
          company: formData.company,
          designation: formData.designation,
          city: formData.city,
          linkedinUrl: formData.linkedinUrl,
        })}
        qrImageUrl={qrCodeUrl || ''}
        userName={`${formData.firstName} ${formData.lastName}`}
        identity={{
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          mobileNo: formData.mobileNo,
          company: formData.company,
          designation: formData.designation,
          city: formData.city,
          linkedinUrl: formData.linkedinUrl,
          avatarUrl: avatarPreview || formData.avatarUrl,
        }}
      />

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. They'll complete their profile on first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">Username *</Label>
              <Input
                id="new-username"
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password *</Label>
              <Input
                id="new-password"
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserDialogOpen(false)} disabled={isAddingUser}>
              Cancel
            </Button>
            <Button onClick={handleAddNewUser} disabled={isAddingUser}>
              {isAddingUser ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Selection Dialog for Export */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md bg-popover">
          <DialogHeader>
            <DialogTitle>Export Attendee Notes</DialogTitle>
            <DialogDescription>
              Select which event(s) to export notes from. Each event will be downloaded as a separate CSV file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            {events.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 border-b">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                  >
                    {selectedEventIds.length === events.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    Select All
                  </button>
                </div>
                {events.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => toggleEventSelection(event.id)}
                  >
                    {selectedEventIds.includes(event.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    <span className="text-sm">{event.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No events found
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmExport}
              disabled={isExporting || selectedEventIds.length === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export {selectedEventIds.length === 1 ? '1 Event' : `${selectedEventIds.length} Events`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

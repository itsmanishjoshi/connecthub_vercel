/**
 * Settings Panel Component
 * 
 * Comprehensive settings interface with tabbed sections for profile, display, notifications, privacy, and account management
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/SimpleAuthContext';
import { useNavigate } from 'react-router-dom';
import { loadSettings, saveSettings } from '@/services/settingsService';
import type { UserPreferences } from '@/types/settings';
import { DEFAULT_PREFERENCES } from '@/types/settings';
import { VALIDATION, ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
import { toast } from 'sonner';
import { User, Palette, Bell, Shield, Settings as SettingsIcon, LogOut, Download, Trash2, Upload } from 'lucide-react';
import { logger } from '@/utils/logger';

export function SettingsPanel() {
  const { profile, signOut, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Delete account dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Sign out dialog state
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Load settings on mount
  useEffect(() => {
    async function loadUserSettings() {
      try {
        const settings = await loadSettings(profile?.id || null);
        setPreferences(settings);
      } catch (error) {
        logger.error('Failed to load settings', error, 'SettingsPanel');
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    loadUserSettings();
  }, [profile?.id]);

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(profile?.id || null, preferences);
      toast.success(SUCCESS_MESSAGES.SAVED);
      logger.info('Settings saved successfully', undefined, 'SettingsPanel');
    } catch (error) {
      logger.error('Failed to save settings', error, 'SettingsPanel');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Handle avatar file selection
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > VALIDATION.MAX_FILE_SIZE) {
      toast.error(ERROR_MESSAGES.FILE_TOO_LARGE);
      return;
    }

    // Validate file type
    if (!VALIDATION.ALLOWED_IMAGE_TYPES.includes(file.type as typeof VALIDATION.ALLOWED_IMAGE_TYPES[number])) {
      toast.error(ERROR_MESSAGES.INVALID_FILE_TYPE);
      return;
    }

    setAvatarFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    toast.success('Avatar selected. Click "Save Changes" to upload.');
  };

  // Handle avatar upload
  const handleAvatarUpload = async () => {
    if (!avatarFile || !profile) {
      toast.error('Please select an avatar first');
      return;
    }

    try {
      // TODO: Implement avatar upload to Supabase storage
      toast.info('Avatar upload coming soon!');
      logger.info('Avatar upload requested', { fileName: avatarFile.name }, 'SettingsPanel');
    } catch (error) {
      logger.error('Failed to upload avatar', error, 'SettingsPanel');
      toast.error('Failed to upload avatar');
    }
  };

  // Export user data
  const handleExportData = () => {
    try {
      const data = {
        profile,
        preferences,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `connecthub-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(SUCCESS_MESSAGES.EXPORTED);
      logger.info('User data exported', undefined, 'SettingsPanel');
    } catch (error) {
      logger.error('Failed to export data', error, 'SettingsPanel');
      toast.error('Failed to export data');
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Wait a bit for animation
      await new Promise(resolve => setTimeout(resolve, 800));
      await signOut();
      toast.success('Signed out successfully');
      logger.info('User signed out', undefined, 'SettingsPanel');
      navigate('/login');
    } catch (error: any) {
      logger.error('Failed to sign out', error, 'SettingsPanel');
      toast.error('Failed to sign out');
      setIsSigningOut(false);
    }
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      toast.error('Please enter your password');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount(deletePassword);
      toast.success('Account deleted successfully');
      logger.info('Account deleted', undefined, 'SettingsPanel');
      setDeleteDialogOpen(false);
      navigate('/login');
    } catch (error: any) {
      logger.error('Failed to delete account', error, 'SettingsPanel');
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
      setDeletePassword('');
    }
  };

  // Update preference
  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  // Update nested preference
  const updateNestedPreference = <
    K extends keyof UserPreferences,
    NK extends keyof UserPreferences[K]
  >(
    key: K,
    nestedKey: NK,
    value: UserPreferences[K][NK]
  ) => {
    setPreferences(prev => {
      const currentValue = prev[key];
      if (typeof currentValue === 'object' && currentValue !== null) {
        return {
          ...prev,
          [key]: {
            ...currentValue,
            [nestedKey]: value,
          },
        };
      }
      return prev;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Display</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Manage your profile details and avatar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage 
                    src={avatarPreview || profile?.avatarUrl || undefined} 
                    alt={profile?.firstName || 'User'} 
                  />
                  <AvatarFallback>
                    {profile ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase() : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="avatar-upload">Profile Picture</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept={VALIDATION.ALLOWED_IMAGE_TYPES.join(',')}
                      className="flex-1"
                      onChange={handleAvatarChange}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAvatarUpload}
                      disabled={!avatarFile}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Max file size: {VALIDATION.MAX_FILE_SIZE / 1024 / 1024}MB. Supported formats: JPG, PNG, GIF, WebP
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profile ? `${profile.firstName} ${profile.lastName}` : ''}
                    disabled
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    placeholder="your.email@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email is managed by your Google account
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>
                Customize how ConnectHub looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Density</Label>
                    <p className="text-sm text-muted-foreground">
                      Adjust spacing and layout density
                    </p>
                  </div>
                  <Select
                    value={preferences.display.density}
                    onValueChange={(value) => updateNestedPreference('display', 'density', value as 'comfortable' | 'compact')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Font Size</Label>
                    <p className="text-sm text-muted-foreground">
                      Adjust text size for better readability
                    </p>
                  </div>
                  <Select
                    value={preferences.display.fontSize}
                    onValueChange={(value) => updateNestedPreference('display', 'fontSize', value as 'small' | 'medium' | 'large')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="animations">Animations</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable smooth transitions and animations
                    </p>
                  </div>
                  <Switch
                    id="animations"
                    checked={preferences.display.animations}
                    onCheckedChange={(checked) => updateNestedPreference('display', 'animations', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="reduced-motion">Reduced Motion</Label>
                    <p className="text-sm text-muted-foreground">
                      Minimize motion for accessibility
                    </p>
                  </div>
                  <Switch
                    id="reduced-motion"
                    checked={preferences.display.reducedMotion}
                    onCheckedChange={(checked) => updateNestedPreference('display', 'reducedMotion', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Control how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications-enabled">Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications about updates and activity
                  </p>
                </div>
                <Switch
                  id="notifications-enabled"
                  checked={preferences.notifications.enabled}
                  onCheckedChange={(checked) => updateNestedPreference('notifications', 'enabled', checked)}
                />
              </div>

              {preferences.notifications.enabled && (
                <>
                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="email-notifications">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive notifications via email
                        </p>
                      </div>
                      <Switch
                        id="email-notifications"
                        checked={preferences.notifications.email}
                        onCheckedChange={(checked) => updateNestedPreference('notifications', 'email', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="push-notifications">Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive browser push notifications
                        </p>
                      </div>
                      <Switch
                        id="push-notifications"
                        checked={preferences.notifications.push}
                        onCheckedChange={(checked) => updateNestedPreference('notifications', 'push', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="sound-notifications">Sound</Label>
                        <p className="text-sm text-muted-foreground">
                          Play sound for notifications
                        </p>
                      </div>
                      <Switch
                        id="sound-notifications"
                        checked={preferences.notifications.sound}
                        onCheckedChange={(checked) => updateNestedPreference('notifications', 'sound', checked)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Notification Types</Label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="mentions" className="font-normal">
                          Mentions
                        </Label>
                        <Switch
                          id="mentions"
                          checked={preferences.notifications.types.mentions}
                          onCheckedChange={(checked) => {
                            setPreferences(prev => ({
                              ...prev,
                              notifications: {
                                ...prev.notifications,
                                types: {
                                  ...prev.notifications.types,
                                  mentions: checked,
                                },
                              },
                            }));
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="updates" className="font-normal">
                          Updates
                        </Label>
                        <Switch
                          id="updates"
                          checked={preferences.notifications.types.updates}
                          onCheckedChange={(checked) => {
                            setPreferences(prev => ({
                              ...prev,
                              notifications: {
                                ...prev.notifications,
                                types: {
                                  ...prev.notifications.types,
                                  updates: checked,
                                },
                              },
                            }));
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="reminders" className="font-normal">
                          Reminders
                        </Label>
                        <Switch
                          id="reminders"
                          checked={preferences.notifications.types.reminders}
                          onCheckedChange={(checked) => {
                            setPreferences(prev => ({
                              ...prev,
                              notifications: {
                                ...prev.notifications,
                                types: {
                                  ...prev.notifications.types,
                                  reminders: checked,
                                },
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Security</CardTitle>
              <CardDescription>
                Control your privacy and data visibility
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Profile Visibility</Label>
                  <p className="text-sm text-muted-foreground">
                    Control who can see your profile
                  </p>
                </div>
                <Select
                  value={preferences.privacy.profileVisibility}
                  onValueChange={(value) => updateNestedPreference('privacy', 'profileVisibility', value as 'public' | 'private')}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-email">Show Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Display your email on your profile
                  </p>
                </div>
                <Switch
                  id="show-email"
                  checked={preferences.privacy.showEmail}
                  onCheckedChange={(checked) => updateNestedPreference('privacy', 'showEmail', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-company">Show Company</Label>
                  <p className="text-sm text-muted-foreground">
                    Display your company on your profile
                  </p>
                </div>
                <Switch
                  id="show-company"
                  checked={preferences.privacy.showCompany}
                  onCheckedChange={(checked) => updateNestedPreference('privacy', 'showCompany', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Manage your account and data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Export Data</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Download a copy of your data including notes, preferences, and activity
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto"
                    onClick={handleExportData}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                  </Button>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2">Sign Out</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sign out of your account on this device
                  </p>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setSignOutDialogOpen(true)}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2 text-destructive">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <Button 
                    variant="destructive" 
                    className="w-full sm:w-auto"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  <span className="animate-spin">⏳</span>
                  Signing out...
                </span>
              ) : (
                'Sign Out'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </div>
  );
}

import { Download, LogOut, Settings, User as UserIcon, ShieldCheck, QrCode, Users, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/SimpleAuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { QRCodeModal } from '@/components/QRCodeModal';
import { generateVCard } from '@/components/QRCodeGenerator';
import { toast } from 'sonner';
import { downloadAllEventExports } from '@/services/eventExportService';
import { resolveAvatarUrl } from '@/lib/avatarUpload';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import * as authService from '@/lib/authService';
import { getFailedSyncCount, getPendingSyncCount } from '@/services/syncQueue';

import { RIBBON_CONTROL } from '@/components/AppRibbon';

interface UserMenuProps {
  onExport?: () => void;
}

export function UserMenu({ onExport }: UserMenuProps) {
  const { mode, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;
  const goToSettings = (tab?: string) => {
    navigate(tab ? `/settings?tab=${tab}` : '/settings', { state: { from: currentPath } });
  };
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [qrVCardData, setQrVCardData] = useState<string>('');
  const [qrImageUrl, setQrImageUrl] = useState<string>('');

  // Determine display information based on auth mode
  const isGuest = mode === 'guest';
  
  // Build full name from profile
  const fullName = profile 
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : '';
  
  // Display name: prioritize full name, fallback to email or 'User'
  const displayName = isGuest 
    ? 'Guest' 
    : isAdmin
      ? 'Admin'
      : fullName || profile?.email || 'User';
  
  // Display email: show email only if we have a name to show above it
  const displayEmail = isGuest 
    ? 'Guest Mode' 
    : isAdmin
      ? profile?.email || 'Administrator'
      : fullName 
        ? profile?.email || '' 
        : '';
  
  const handleExportMyData = async () => {
    if (isGuest) return;
    try {
      await downloadAllEventExports('my-data', 'md');
      toast.success('Exported your notes, conversations, and priorities');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nothing to export yet');
    }
  };

  const handleExport = onExport || handleExportMyData;

  const avatarSrc = useAuthenticatedImage(resolveAvatarUrl(profile?.avatarUrl));
  const showAvatar = Boolean(avatarSrc && !isGuest);

  const initials = isGuest
    ? 'G'
    : profile && fullName
      ? `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase()
      : profile?.email?.[0]?.toUpperCase() || (isAdmin ? 'A' : 'U');

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success('Signed out');
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Could not sign out');
      setIsSigningOut(false);
    }
  };

  const handleViewQR = async () => {
    if (!profile) {
      toast.error('Finish your profile to share a QR code.');
      navigate('/settings', { state: { from: currentPath } });
      return;
    }
    try {
      const savedQR = await authService.getQRCode(profile.id);
      const data = savedQR || await getVCardData();
      if (!data) {
        toast.error('Add your name in Settings to create a QR code.');
        navigate('/settings', { state: { from: currentPath } });
        return;
      }
      setQrVCardData(data);
      const imageUrl = await authService.getQRCodeUrl(profile.id);
      setQrImageUrl(imageUrl || '');
      setQrModalOpen(true);
    } catch (error) {
      console.error('Error loading QR code:', error);
      toast.error('Could not open QR code');
    }
  };

  const getVCardData = async () => {
    if (!profile) return '';
    
    // Try to get saved QR code from Supabase first
    try {
      const savedQR = await authService.getQRCode(profile.id);
      if (savedQR) return savedQR;
    } catch (error) {
      console.error('Error loading QR code:', error);
    }
    
    // Generate from profile if not saved
    return generateVCard({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      mobileNo: profile.mobileNo || '',
      company: profile.company || '',
      designation: profile.designation || '',
      city: profile.city || '',
      linkedinUrl: profile.linkedinUrl || '',
    });
  };



  return (
    <>
      <div className="flex items-center">
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`relative ${RIBBON_CONTROL} overflow-hidden rounded-lg border border-border/60 bg-card/40 p-0 hover:bg-accent`}
            aria-label="User menu"
          >
            {showAvatar ? (
              <img
                src={avatarSrc!}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                className={`flex h-full w-full items-center justify-center text-sm font-semibold text-white ${isAdmin ? 'bg-primary' : 'bg-muted-foreground/70'}`}
              >
                {isAdmin ? (
                  <ShieldCheck className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
                ) : initials ? (
                  initials
                ) : (
                  <UserIcon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
                )}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none text-slate-900 dark:text-white">
                {isAdmin ? 'Admin' : displayName}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {isAdmin ? (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    navigate('/admin', {
                      state: { from: `${window.location.pathname}${window.location.search}` },
                    })
                  }
                  className="cursor-pointer"
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Accounts</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => goToSettings('profile')} className="cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleViewQR} className="cursor-pointer">
                  <QrCode className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>QR code</span>
                </DropdownMenuItem>
              </>
            ) : null}
            {!isGuest && !isAdmin && (
              <>
                <DropdownMenuItem onClick={() => goToSettings('profile')} className="cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleViewQR} className="cursor-pointer">
                  <QrCode className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>QR code</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/notes')} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Notebook</span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => goToSettings()} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            {!isGuest && (
              <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
                <Download className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Export my data</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {!isGuest && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSignOutDialogOpen(true)} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    {/* Sign Out Confirmation Dialog */}
    <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign Out</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to sign out? You'll need to sign in again to access your account.
            {(getPendingSyncCount() + getFailedSyncCount()) > 0
              ? ' Unsynced notes on this device stay with this account and will upload the next time you sign in here.'
              : ''}
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
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing out...
              </span>
            ) : (
              'Sign out'
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
    {!isGuest && (
      <QRCodeModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        vCardData={qrVCardData}
        userName={`${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'User'}
        qrImageUrl={qrImageUrl || undefined}
        identity={
          profile
            ? {
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email || undefined,
                mobileNo: profile.mobileNo || undefined,
                company: profile.company || undefined,
                designation: profile.designation || undefined,
                city: profile.city || undefined,
                linkedinUrl: profile.linkedinUrl || undefined,
                avatarUrl: profile.avatarUrl,
              }
            : undefined
        }
      />
    )}
  </>
  );
}

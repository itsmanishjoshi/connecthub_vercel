import { useState } from 'react';
import { useAuth } from '@/context/SimpleAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ArrowRight, ArrowLeft, Camera, Check, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { resolveAvatarUrl, uploadUserAvatar } from '@/lib/avatarUpload';
import { AccionlabsLogo } from '@/components/AccionlabsLogo';
import { BrandTagline } from '@/components/BrandTagline';
import { ImageCropDialog } from '@/components/ImageCropDialog';
import { PhotoPicker } from '@/components/PhotoPicker';

const TOTAL_STEPS = 4;

const STEP_TITLES = [
  'How people will know you',
  'Where you work',
  'How they find you later',
  'A face for the room',
];

const STEP_HINTS = [
  'This is the name and contact others see at events.',
  'Company and role help people remember the conversation.',
  'City and LinkedIn are optional, and stay with your profile.',
  'A photo helps people find you after you meet. You can skip this.',
];

const fieldClass = 'mt-1.5 h-11 text-base sm:h-10 sm:text-sm';

export function OnboardingFlow() {
  const { profile, userId, updateProfile, refreshProfile, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    mobileNo: profile?.mobileNo || '',
    company: profile?.company || '',
    designation: profile?.designation || '',
    city: profile?.city || '',
    linkedinUrl: profile?.linkedinUrl || '',
    avatarUrl: profile?.avatarUrl || '',
  });

  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(resolveAvatarUrl(profile?.avatarUrl) || '');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    toast.success('Photo cropped! Continue to save your profile.');
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) {
      return formData.avatarUrl;
    }
    if (!userId) {
      toast.error('Sign in to upload a profile photo');
      return formData.avatarUrl;
    }

    try {
      return await uploadUserAvatar(userId, avatarFile);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload profile photo');
      return formData.avatarUrl;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.firstName.trim() && formData.email.trim() && formData.mobileNo.trim();
      case 2:
        return formData.company.trim();
      case 3:
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
      await updateProfile({ onboardingStep: currentStep + 1 });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      let avatarUrl = formData.avatarUrl;
      if (avatarFile) {
        avatarUrl = (await uploadAvatar()) || formData.avatarUrl;
      }

      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobileNo: formData.mobileNo,
        company: formData.company,
        designation: formData.designation,
        city: formData.city,
        linkedinUrl: formData.linkedinUrl,
        avatarUrl,
        profileCompleted: true,
      });

      toast.success('Profile created successfully!');
      await new Promise((resolve) => setTimeout(resolve, 500));
      await refreshProfile();
    } catch (error: unknown) {
      console.error('Error completing onboarding:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create profile. Please try again.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
      setIsSigningOut(false);
    }
  };

  const progress = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-primary/5 via-background to-primary/10 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:justify-center sm:p-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col sm:max-h-[min(720px,calc(100dvh-3rem))] sm:max-w-xl md:max-w-2xl">
        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <AccionlabsLogo variant="onLight" className="h-8 w-auto shrink-0 sm:h-9" />
            <BrandTagline className="hidden truncate text-xs xs:block sm:text-sm" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSignOutDialogOpen(true)}
            className="h-9 shrink-0 touch-manipulation px-2 text-xs text-muted-foreground hover:text-foreground sm:px-3"
          >
            <LogOut className="mr-1 h-3.5 w-3.5" />
            <span className="hidden xs:inline">Back to Login</span>
            <span className="xs:hidden">Exit</span>
          </Button>
        </div>

        <div className="mb-3 sm:mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground sm:text-sm">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <span className="text-xs font-semibold text-primary sm:text-sm">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index + 1 === currentStep
                    ? 'w-6 bg-primary'
                    : index + 1 < currentStep
                      ? 'w-1.5 bg-primary/60'
                      : 'w-1.5 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:rounded-2xl">
          <div className="border-b border-border/50 px-4 py-3 text-center sm:px-6 sm:py-4">
            <h2 className="text-base font-bold leading-snug text-foreground sm:text-xl">
              {STEP_TITLES[currentStep - 1]}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {STEP_HINTS[currentStep - 1]}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-medium">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className={fieldClass}
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-medium">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className={fieldClass}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={fieldClass}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="mobileNo" className="text-sm font-medium">
                    Mobile Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mobileNo"
                    type="tel"
                    inputMode="tel"
                    value={formData.mobileNo}
                    onChange={(e) => handleInputChange('mobileNo', e.target.value)}
                    className={fieldClass}
                    autoComplete="tel"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="mx-auto w-full max-w-lg space-y-4">
                <div>
                  <Label htmlFor="company" className="text-sm font-medium">
                    Company <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className={fieldClass}
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <Label htmlFor="designation" className="text-sm font-medium">
                    Designation
                  </Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => handleInputChange('designation', e.target.value)}
                    className={fieldClass}
                    autoComplete="organization-title"
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="mx-auto w-full max-w-lg space-y-4">
                <div>
                  <Label htmlFor="city" className="text-sm font-medium">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={fieldClass}
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <Label htmlFor="linkedinUrl" className="text-sm font-medium">
                    LinkedIn Profile URL
                  </Label>
                  <Input
                    id="linkedinUrl"
                    type="url"
                    inputMode="url"
                    value={formData.linkedinUrl}
                    onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                    className={fieldClass}
                    placeholder="https://linkedin.com/in/..."
                    autoComplete="url"
                  />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="flex flex-col items-center space-y-4 py-2 sm:py-4">
                <PhotoPicker previewUrl={avatarPreview || null} onFile={handleAvatarFile}>
                  <div className="relative">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-border bg-muted sm:h-32 sm:w-32 md:h-36 md:w-36">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-4xl text-muted-foreground sm:text-5xl">
                          {formData.firstName?.[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm sm:h-10 sm:w-10">
                      <Camera className="h-4 w-4" />
                    </span>
                  </div>
                </PhotoPicker>
                <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
                  Tap the picture to {avatarPreview ? 'view or change it' : 'choose or take a photo'}
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border/50 bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
            <div className="flex gap-2 sm:gap-3">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="h-11 flex-1 touch-manipulation text-sm sm:h-10"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              )}

              {currentStep < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="h-11 flex-1 touch-manipulation text-sm sm:h-10"
                >
                  Next
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleComplete}
                  disabled={loading || !canProceed()}
                  className="h-11 flex-1 touch-manipulation text-sm sm:h-10"
                >
                  {loading ? (
                    'Creating...'
                  ) : (
                    <>
                      Complete
                      <Check className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>

            {currentStep === 4 && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={loading}
                  className="h-10 touch-manipulation text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Skip and complete profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <AlertDialogContent className="mx-4 w-[calc(100vw-2rem)] max-w-md sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress is saved. You can sign in again and continue where you left off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel disabled={isSigningOut} className="mt-0 h-11 w-full sm:h-10 sm:w-auto">
              Stay
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isSigningOut}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isSigningOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20 animate-pulse" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
            <div className="space-y-2 text-center animate-in slide-in-from-bottom-4 duration-700">
              <p className="text-lg font-semibold">Signing out...</p>
              <p className="text-sm text-muted-foreground">See you soon!</p>
            </div>
          </div>
        </div>
      )}

      <ImageCropDialog
        open={cropDialogOpen}
        onClose={() => setCropDialogOpen(false)}
        imageSrc={selectedImageSrc}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AccionlabsLogo } from '@/components/AccionlabsLogo';
import { BrandTagline } from '@/components/BrandTagline';
import { useAuth } from '@/context/SimpleAuthContext';
import { passwordError } from '@/lib/passwordRules';
import { APP_NAME } from '@/constants';

const fieldClass = 'h-11 text-base text-foreground dark:text-slate-50 sm:h-10 sm:text-sm';

export function SetPasswordScreen() {
  const { changePassword, signOut, profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = passwordError(newPassword, confirmPassword, currentPassword);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <div className="w-full max-w-md space-y-5 sm:space-y-6">
        <div className="space-y-3 text-center sm:space-y-4">
          <AccionlabsLogo className="mx-auto h-16 w-auto sm:h-20 md:h-24" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{APP_NAME}</h1>
            <BrandTagline className="text-sm" />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">Choose your password</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {profile?.firstName ? `Welcome, ${profile.firstName}. ` : 'Welcome. '}
              Your administrator created this account. Set a password only you know, then we will finish your profile.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={fieldClass}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className={fieldClass}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={fieldClass}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full touch-manipulation text-base sm:h-10 sm:text-sm">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="h-10 w-full touch-manipulation text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}

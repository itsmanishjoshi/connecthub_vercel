import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AccionlabsLogo } from '@/components/AccionlabsLogo';
import { BrandTagline } from '@/components/BrandTagline';
import { APP_NAME } from '@/constants';

interface LoginScreenProps {
  onSignIn: (username: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const LoginScreen = ({ onSignIn, loading, error }: LoginScreenProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSignIn(username, password);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <div className="w-full max-w-md space-y-5 sm:space-y-6">
        <div className="space-y-3 text-center sm:space-y-4">
          <AccionlabsLogo variant="onLight" className="mx-auto h-16 w-auto sm:h-20 md:h-24" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{APP_NAME}</h1>
            <BrandTagline className="text-sm" />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
                className="h-11 text-base text-foreground placeholder:font-normal placeholder:text-muted-foreground/60 dark:text-slate-50 sm:h-10 sm:text-sm"
                autoComplete="username"
              />
              <p className="text-xs text-muted-foreground">Use the username your administrator created.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 text-base text-foreground placeholder:font-normal placeholder:text-muted-foreground/60 dark:text-slate-50 sm:h-10 sm:text-sm"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full touch-manipulation text-base sm:h-10 sm:text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

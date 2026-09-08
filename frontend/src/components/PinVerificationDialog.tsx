import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, AlertCircle } from 'lucide-react';

interface PinVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerify: (pin: string) => Promise<boolean>;
  eventName: string;
}

export const PinVerificationDialog = ({
  open,
  onOpenChange,
  onVerify,
  eventName,
}: PinVerificationDialogProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (pin.length !== 4) {
      setError('Enter the 4-digit door code');
      return;
    }

    setVerifying(true);
    const isValid = await onVerify(pin);
    setVerifying(false);
    if (!isValid) {
      setError('That door code is not correct.');
      setPin('');
    } else {
      setPin('');
      setError('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Invite only</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {eventName}. Enter the door code if you were given one, or ask the organizer to invite your username.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="pin">Door code</Label>
            <Input
              id="pin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPin(value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleVerify();
                }
              }}
              autoFocus
              className="text-center text-2xl tracking-widest"
            />
            <p className="text-xs text-muted-foreground text-center">
              This event is invite-only. Ask the organizer to invite your username if you were not given a code.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleVerify()}
              className="flex-1"
              disabled={pin.length !== 4 || verifying}
            >
              {verifying ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

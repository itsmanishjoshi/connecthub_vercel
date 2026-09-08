import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { IdentityQRCard } from '@/components/IdentityQRCard';
import { displayNameFromIdentity, type QRIdentityProfile } from '@/components/QRCodeGenerator';
import { downloadIdentityCard } from '@/lib/downloadIdentityCard';
import { toast } from 'sonner';

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  vCardData: string;
  userName: string;
  qrImageUrl?: string;
  identity?: QRIdentityProfile;
}

export function QRCodeModal({
  open,
  onClose,
  vCardData,
  userName,
  qrImageUrl,
  identity,
}: QRCodeModalProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const displayName = displayNameFromIdentity(
    { ...identity, firstName: identity?.firstName, lastName: identity?.lastName },
    userName,
  );

  const handleSave = async () => {
    const card = cardRef.current;
    if (!card) {
      toast.error('Could not capture your contact card');
      return;
    }

    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const safeName = displayName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'contact';
      await downloadIdentityCard(card, `${safeName}-connecthub-id.png`);
      toast.success('Contact card saved to your device');
    } catch (error) {
      console.error('Failed to save contact card:', error);
      toast.error('Failed to save contact card. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        hideClose
        className="max-h-[min(96dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] gap-0 overflow-y-auto border-0 bg-transparent p-2 shadow-none sm:max-w-[min(96vw,56rem)] sm:p-4"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{displayName}&apos;s contact card</DialogTitle>
          <DialogDescription>
            QR code and contact details others will receive when they scan.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl bg-[#0f172a] p-3 shadow-2xl sm:p-5">
          <IdentityQRCard
            ref={cardRef}
            vCardData={vCardData}
            qrImageUrl={qrImageUrl}
            identity={identity}
            qrSize={148}
          />

          <div className="mt-4 flex gap-3">
            <Button
              onClick={handleSave}
              variant="outline"
              className="h-11 flex-1 gap-2 rounded-xl border border-slate-500 bg-transparent text-sm font-medium text-slate-100 hover:bg-slate-800/60 hover:text-white"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  Save
                </>
              )}
            </Button>
            <Button
              onClick={onClose}
              disabled={isSaving}
              className="h-11 flex-1 gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-sm font-semibold text-white shadow-md shadow-blue-900/35 hover:from-blue-400 hover:to-blue-500"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

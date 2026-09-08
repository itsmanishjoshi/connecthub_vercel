import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Camera, Eye, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PhotoPickerProps {
  disabled?: boolean;
  onFile?: (file: File) => void;
  previewUrl?: string | null;
  allowChange?: boolean;
  children?: ReactNode;
}

export function PhotoPicker({
  disabled,
  onFile,
  previewUrl,
  allowChange = true,
  children,
}: PhotoPickerProps) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const hasPicture = Boolean(previewUrl);
  const canChange = allowChange && !disabled && typeof onFile === 'function';

  const takeFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFile?.(file);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!cameraOpen) {
      stopCamera();
      return;
    }
    let cancelled = false;
    setCameraError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setCameraError('Camera is not available on this device. Use Choose photo to pick a file.');
      });
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraOpen]);

  const openCamera = () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      setCameraOpen(true);
      return;
    }
    cameraFallbackRef.current?.click();
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onFile?.(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
      setCameraOpen(false);
    }, 'image/jpeg', 0.92);
  };

  const fileInputs = (
    <>
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={takeFile}
      />
      <input
        ref={cameraFallbackRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={takeFile}
      />
    </>
  );

  const cameraDialog = (
    <Dialog modal={false} open={cameraOpen} onOpenChange={setCameraOpen}>
      <DialogContent className="z-[80] sm:max-w-md bg-popover">
        <DialogHeader>
          <DialogTitle>Take photo</DialogTitle>
        </DialogHeader>
        {cameraError ? (
          <p className="text-sm text-muted-foreground">{cameraError}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black aspect-square object-cover" />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setCameraOpen(false)}>Cancel</Button>
          <Button type="button" onClick={captureFrame} disabled={Boolean(cameraError)}>Capture</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const viewDialog = hasPicture ? (
    <Dialog modal={false} open={viewOpen} onOpenChange={setViewOpen}>
      <DialogContent className="z-[80] max-w-lg bg-popover p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Profile picture</DialogTitle>
        </DialogHeader>
        <img src={previewUrl!} alt="Profile picture" className="max-h-[70vh] w-full rounded-lg object-contain bg-muted" />
      </DialogContent>
    </Dialog>
  ) : null;

  if (children) {
    if (!hasPicture && !canChange) {
      return <>{children}</>;
    }

    if (!hasPicture && canChange) {
      return (
        <div className="inline-flex">
          {fileInputs}
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Add profile picture"
          >
            {children}
          </button>
          {cameraDialog}
        </div>
      );
    }

    return (
      <div className="inline-flex">
        {fileInputs}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled && canChange}
              className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              aria-label={hasPicture ? (canChange ? 'Change profile picture' : 'View profile picture') : 'Add profile picture'}
            >
              {children}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[80] w-52">
            {hasPicture ? (
              <DropdownMenuItem onSelect={() => setViewOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                View picture
              </DropdownMenuItem>
            ) : null}
            {canChange ? (
              <>
                <DropdownMenuItem onSelect={() => libraryRef.current?.click()}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Choose photo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openCamera()}>
                  <Camera className="mr-2 h-4 w-4" />
                  Take photo
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {cameraDialog}
        {viewDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {fileInputs}
      <Button type="button" variant="outline" size="sm" className="h-9" disabled={disabled} onClick={() => libraryRef.current?.click()}>
        <ImageIcon className="mr-1.5 h-4 w-4" />
        Choose photo
      </Button>
      <Button type="button" variant="outline" size="sm" className="h-9" disabled={disabled} onClick={openCamera}>
        <Camera className="mr-1.5 h-4 w-4" />
        Take photo
      </Button>
      {cameraDialog}
    </div>
  );
}

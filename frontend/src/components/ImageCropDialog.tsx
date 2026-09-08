import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { FixedAspectCrop } from '@/components/FixedAspectCrop';

interface ImageCropDialogProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  imageSrc?: string;
  imageUrl?: string;
  title?: string;
  aspect?: number;
  aspectRatio?: number;
  circularCrop?: boolean;
  onCropComplete: (croppedImageBlob: Blob) => void;
}

function createCenteredCrop(width: number, height: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 100 }, aspect, width, height),
    width,
    height
  );
}

function percentToPixelCrop(crop: Crop, width: number, height: number): PixelCrop {
  return {
    unit: 'px',
    x: (crop.x / 100) * width,
    y: (crop.y / 100) * height,
    width: (crop.width / 100) * width,
    height: (crop.height / 100) * height,
  };
}

export function ImageCropDialog({
  open,
  onClose,
  onOpenChange,
  imageSrc,
  imageUrl,
  title,
  aspect,
  aspectRatio,
  circularCrop,
  onCropComplete,
}: ImageCropDialogProps) {
  const source = imageSrc || imageUrl || '';
  const cropAspect = aspect || aspectRatio || 1;
  const useCircle = Boolean(circularCrop);
  const heading = title || (cropAspect === 1 ? 'Crop profile photo' : 'Crop event photo');

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const exportCropRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const useFixedFrame = !useCircle;

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setCrop(undefined);
    setCompletedCrop(null);
    setLoadError(false);
    setLoading(false);
  }, [open, source]);

  const close = useCallback(() => {
    onOpenChange?.(false);
    onClose?.();
  }, [onClose, onOpenChange]);

  const onImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const width = image.clientWidth || image.width;
    const height = image.clientHeight || image.height;
    const next = createCenteredCrop(width, height, cropAspect);
    setCrop(next);
    setCompletedCrop(percentToPixelCrop(next, width, height));
    setLoadError(false);
  }, [cropAspect]);

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current;
    if (!image || !completedCrop?.width || !completedCrop?.height) return null;

    const displayedWidth = image.clientWidth || image.width;
    const displayedHeight = image.clientHeight || image.height;
    if (!displayedWidth || !displayedHeight) return null;

    const scaleX = image.naturalWidth / displayedWidth;
    const scaleY = image.naturalHeight / displayedHeight;
    const portrait = cropAspect < 1;
    const outputWidth = cropAspect === 1 ? 400 : portrait ? 720 : 1280;
    const outputHeight = cropAspect === 1 ? 400 : Math.round(outputWidth / cropAspect);

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  }, [completedCrop, cropAspect]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const blob = useFixedFrame ? await exportCropRef.current?.() : await getCroppedImg();
      if (!blob) return;
      onCropComplete(blob);
      close();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent
        className="max-w-[min(92vw,40rem)] gap-4 overflow-hidden p-4 sm:p-5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-1 pr-8">
          <DialogTitle className="text-base sm:text-lg">{heading}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {cropAspect === 1
              ? 'Square crop - this is the profile photo on the person card.'
              : 'Drag the photo inside the 16:9 frame. That frame is what every event card will show.'}
          </p>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.1).toFixed(1))))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Slider value={[zoom]} min={1} max={3} step={0.1} onValueChange={(value) => setZoom(value[0])} className="flex-1" />
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.1).toFixed(1))))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="w-12 text-right text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        </div>

        {useFixedFrame ? (
          source && !loadError ? (
            <FixedAspectCrop
              src={source}
              aspect={cropAspect}
              zoom={zoom}
              onReady={(exportCrop) => {
                exportCropRef.current = exportCrop;
              }}
            />
          ) : (
            <div className={cropAspect === 1 ? 'flex aspect-square w-[min(100%,min(55vh,20rem))] mx-auto items-center justify-center rounded-xl bg-slate-950' : 'flex aspect-video items-center justify-center rounded-xl bg-slate-950'}>
              <p className="px-6 text-center text-sm text-slate-400">
                {loadError ? 'That image could not be opened. Try another file.' : 'Choose a photo to crop.'}
              </p>
            </div>
          )
        ) : (
          <div className="flex h-[min(55vh,22rem)] items-center justify-center overflow-auto rounded-xl bg-slate-950">
            {source && !loadError ? (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
                aspect={cropAspect}
                circularCrop={useCircle}
                className="max-h-full max-w-full"
              >
                <img
                  ref={imgRef}
                  src={source}
                  alt=""
                  onLoad={onImageLoad}
                  onError={() => setLoadError(true)}
                  style={{
                    width: `${zoom * 100}%`,
                    maxWidth: zoom === 1 ? '100%' : 'none',
                    height: 'auto',
                    display: 'block',
                  }}
                  className="select-none"
                  draggable={false}
                />
              </ReactCrop>
            ) : (
              <p className="px-6 text-center text-sm text-slate-400">
                {loadError ? 'That image could not be opened. Try another file.' : 'Choose a photo to crop.'}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={loading} className="h-11 w-full touch-manipulation sm:h-10 sm:w-auto">
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading || loadError || !source || (!useFixedFrame && !completedCrop)} className="h-11 w-full touch-manipulation sm:h-10 sm:w-auto">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

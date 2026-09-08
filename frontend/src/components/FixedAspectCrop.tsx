import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface FixedAspectCropProps {
  src: string;
  aspect: number;
  zoom: number;
  onReady: (exportCrop: () => Promise<Blob | null>) => void;
}

export function FixedAspectCrop({ src, aspect, zoom, onReady }: FixedAspectCropProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  const metrics = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !natural.width || !natural.height) return null;
    const viewW = stage.clientWidth;
    const viewH = stage.clientHeight;
    if (!viewW || !viewH) return null;
    const scale = Math.max(viewW / natural.width, viewH / natural.height) * zoom;
    const displayW = natural.width * scale;
    const displayH = natural.height * scale;
    return {
      viewW,
      viewH,
      scale,
      displayW,
      displayH,
      minX: Math.min(0, viewW - displayW),
      minY: Math.min(0, viewH - displayH),
    };
  }, [natural, zoom]);

  const clamp = useCallback((point: { x: number; y: number }) => {
    const size = metrics();
    if (!size) return point;
    return {
      x: Math.min(0, Math.max(size.minX, point.x)),
      y: Math.min(0, Math.max(size.minY, point.y)),
    };
  }, [metrics]);

  useEffect(() => {
    setNatural({ width: 0, height: 0 });
    setOffset({ x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    const size = metrics();
    if (!size) return;
    setOffset((current) => {
      if (current.x === 0 && current.y === 0 && zoom === 1) {
        return clamp({
          x: (size.viewW - size.displayW) / 2,
          y: (size.viewH - size.displayH) / 2,
        });
      }
      return clamp(current);
    });
  }, [clamp, metrics, zoom]);

  const exportCrop = useCallback(async () => {
    const image = imageRef.current;
    const size = metrics();
    const current = clamp(offset);
    if (!image || !size || !image.naturalWidth) return null;
    const outputWidth = aspect === 1 ? 400 : 1280;
    const outputHeight = Math.round(outputWidth / aspect);
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      image,
      -current.x / size.scale,
      -current.y / size.scale,
      size.viewW / size.scale,
      size.viewH / size.scale,
      0,
      0,
      outputWidth,
      outputHeight
    );
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    });
  }, [aspect, clamp, metrics, offset]);

  useEffect(() => {
    onReady(exportCrop);
  }, [exportCrop, onReady]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setOffset(clamp({
      x: dragRef.current.originX + (event.clientX - dragRef.current.x),
      y: dragRef.current.originY + (event.clientY - dragRef.current.y),
    }));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const size = metrics();
  const position = clamp(offset);
  const isSquare = Math.abs(aspect - 1) < 0.001;

  return (
    <div
      ref={stageRef}
      className={
        isSquare
          ? 'relative mx-auto aspect-square w-[min(100%,min(55vh,20rem))] cursor-grab overflow-hidden rounded-xl bg-slate-950 active:cursor-grabbing'
          : 'relative aspect-video w-full max-h-[min(55vh,22rem)] cursor-grab overflow-hidden rounded-xl bg-slate-950 active:cursor-grabbing'
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img
        ref={imageRef}
        src={src}
        alt=""
        draggable={false}
        onLoad={(event) => {
          setNatural({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          });
        }}
        className="pointer-events-none absolute max-w-none select-none"
        style={size ? {
          width: size.displayW,
          height: size.displayH,
          left: position.x,
          top: position.y,
        } : { opacity: 0 }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-white/80" />
    </div>
  );
}

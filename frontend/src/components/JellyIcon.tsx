import { jellyLogoUrl } from '@/lib/branding';

export function JellyIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <img
      src={jellyLogoUrl()}
      alt="Jelly"
      draggable={false}
      className={`object-contain select-none ${className}`}
    />
  );
}

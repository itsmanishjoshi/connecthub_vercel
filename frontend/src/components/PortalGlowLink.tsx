import { cn } from '@/lib/utils';

/** Single portal card — mobile text layout and desktop hero image share the same shell. */
export const portalCardClass = cn(
  'group relative block w-full touch-manipulation overflow-hidden rounded-2xl',
  'border border-blue-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
  'transition-[box-shadow,transform,border-color] duration-300 active:scale-[0.995]',
  'hover:border-blue-400/45 hover:shadow-[0_12px_40px_rgba(59,130,246,0.22)]',
  'sm:hover:-translate-y-0.5',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
);

export function BlueGlowLayers() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:hidden"
      aria-hidden
      style={{
        background:
          'radial-gradient(circle at 20% 15%, rgba(59,130,246,0.12), transparent 42%), radial-gradient(circle at 80% 70%, rgba(99,102,241,0.1), transparent 38%)',
      }}
    />
  );
}

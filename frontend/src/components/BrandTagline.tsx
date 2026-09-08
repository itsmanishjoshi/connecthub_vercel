import { APP_TAGLINE } from '@/constants';
import { cn } from '@/lib/utils';

export function BrandTagline({ className }: { className?: string }) {
  return (
    <p className={cn('text-muted-foreground tracking-[0.04em]', className)}>
      {APP_TAGLINE}
    </p>
  );
}

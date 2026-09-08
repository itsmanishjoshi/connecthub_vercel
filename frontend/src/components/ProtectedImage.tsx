import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { cn } from '@/lib/utils';

interface ProtectedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallback?: React.ReactNode;
}

export function ProtectedImage({
  src,
  className,
  alt = '',
  fallback = null,
  ...props
}: ProtectedImageProps) {
  const resolved = useAuthenticatedImage(src);

  if (!resolved) {
    return fallback ? <>{fallback}</> : null;
  }

  return <img src={resolved} alt={alt} className={cn(className)} {...props} />;
}

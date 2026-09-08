import { connectHubLogoUrl } from '@/lib/branding';

interface AccionlabsLogoProps {
  className?: string;
}

export const AccionlabsLogo = ({ className = "h-8 w-auto" }: AccionlabsLogoProps) => {
  return (
    <img
      src={connectHubLogoUrl()}
      alt="ConnectHub"
      className={`object-contain ${className}`}
    />
  );
};

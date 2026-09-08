import { AccionlabsLogo } from '@/components/AccionlabsLogo';
import { BrandTagline } from '@/components/BrandTagline';
import { APP_NAME } from '@/constants';

export const LoadingScreen = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center px-6 text-center">
        <AccionlabsLogo variant="onLight" className="h-12 w-auto sm:h-14" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {APP_NAME}
        </h1>
        <BrandTagline className="mt-1.5 animate-in fade-in duration-700 text-sm" />
      </div>
    </div>
  );
};

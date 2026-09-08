import { ExternalLink } from 'lucide-react';
import { MY_ACCION_URL } from '@/components/OfficeWindows';
import { cn } from '@/lib/utils';
import { BlueGlowLayers, portalCardClass } from '@/components/PortalGlowLink';

const ACCION_HERO_IMAGE = '/accion-labs-hero.jpg';

function MyAccionMobileCard() {
  return (
    <div className="relative bg-[#0b1120] px-4 py-8 text-center sm:px-8 sm:py-10">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300 sm:text-xs">
          Accion Labs · GCC Practice
        </span>
      </div>

      <h2 className="mx-auto max-w-2xl text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
        Empowering GCCs To{' '}
        <span className="text-blue-400">Accelerate</span> Global Impact
      </h2>

      <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
        AI-first, Platform-led Innovation Engineering Enterprise
      </p>

      <p className="mx-auto mt-3 max-w-lg text-pretty text-sm italic leading-relaxed text-slate-500">
        Enhancing Lives by Transforming Businesses Through Innovation
      </p>

      <div className="mt-7 inline-flex items-center gap-2 rounded-lg bg-blue-500/15 px-4 py-2.5 text-sm font-medium text-blue-200">
        <span>Open My Accion</span>
        <ExternalLink className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      </div>
    </div>
  );
}

export function MyAccionWindow() {
  return (
    <a
      href={MY_ACCION_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Accion Labs"
      className={portalCardClass}
    >
      <BlueGlowLayers />
      <img
        src={ACCION_HERO_IMAGE}
        alt="Accion Labs"
        className={cn('hidden w-full md:block', 'h-auto')}
      />
      <div className="md:hidden">
        <MyAccionMobileCard />
      </div>
    </a>
  );
}

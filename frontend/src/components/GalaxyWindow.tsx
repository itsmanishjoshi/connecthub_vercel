import { ExternalLink } from 'lucide-react';
import { GALAXY_URL } from '@/components/OfficeWindows';
import { cn } from '@/lib/utils';
import { BlueGlowLayers, portalCardClass } from '@/components/PortalGlowLink';

const GALAXY_HERO_IMAGE = '/galaxy-genai-hero.png';

const STATS = [
  { value: '109', label: 'Applied scenarios' },
  { value: '16', label: 'Industries' },
  { value: '14', label: 'Solution patterns' },
] as const;

function GalaxyMobileCard() {
  return (
    <div className="relative bg-[#0b1120] px-4 py-8 text-center sm:px-8 sm:py-10">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300 sm:text-xs">
          Accion Labs · GenAI Practice
        </span>
      </div>

      <h2 className="mx-auto max-w-2xl text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
        Where Accion&apos;s GenAI{' '}
        <span className="text-blue-400">experience becomes</span> your opportunity.
      </h2>

      <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
        Field-applied GenAI scenarios across industries, business functions, and enterprise solution
        patterns — organised to shape the right conversation.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-2 border-t border-white/10 pt-6">
        {STATS.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center px-1',
              index > 0 && 'border-l border-white/10',
            )}
          >
            <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{stat.value}</span>
            <span className="mt-1 max-w-[6.5rem] text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-500 xs:text-[10px] sm:max-w-none sm:text-xs sm:tracking-[0.12em]">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-7 inline-flex items-center gap-2 rounded-lg bg-blue-500/15 px-4 py-2.5 text-sm font-medium text-blue-200">
        <span>Open GenAI Experience Console</span>
        <ExternalLink className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      </div>
    </div>
  );
}

export function GalaxyWindow() {
  return (
    <a
      href={GALAXY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open Accion GenAI Experience Console"
      className={portalCardClass}
    >
      <BlueGlowLayers />
      <img
        src={GALAXY_HERO_IMAGE}
        alt="Accion GenAI Experience Console"
        className={cn('hidden w-full md:block', 'h-auto')}
      />
      <div className="md:hidden">
        <GalaxyMobileCard />
      </div>
    </a>
  );
}

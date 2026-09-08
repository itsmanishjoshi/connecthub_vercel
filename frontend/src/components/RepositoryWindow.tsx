import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, HeartPulse, Landmark, Wrench } from 'lucide-react';
import { AssetExplorer, type AssetTrailCrumb } from '@/components/AssetExplorer';
import {
  REPOSITORY_INDUSTRIES,
  REPOSITORY_INDUSTRY_IDS,
  type RepositoryIndustry,
  type RepositoryIndustryId,
} from '@/lib/repositoryIndustries';

const ICONS = {
  healthcare: HeartPulse,
  engineering: Wrench,
  bfsi: Landmark,
};

const ACCENT: Record<RepositoryIndustry['accent'], { card: string; badge: string; bar: string; soft: string }> = {
  teal: {
    card: 'from-teal-700 via-emerald-700 to-cyan-800',
    badge: 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200',
    bar: 'bg-teal-600',
    soft: 'bg-teal-50/80 dark:bg-teal-950/30',
  },
  amber: {
    card: 'from-amber-700 via-orange-700 to-stone-800',
    badge: 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
    bar: 'bg-amber-600',
    soft: 'bg-amber-50/80 dark:bg-amber-950/30',
  },
  indigo: {
    card: 'from-indigo-800 via-blue-800 to-slate-900',
    badge: 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100',
    bar: 'bg-indigo-600',
    soft: 'bg-indigo-50/80 dark:bg-indigo-950/30',
  },
};

export function RepositoryWindow({ onTrail }: { onTrail?: (crumbs: AssetTrailCrumb[]) => void }) {
  const [params, setParams] = useSearchParams();
  const industryParam = params.get('industry');
  const roomId = REPOSITORY_INDUSTRY_IDS.includes(industryParam as RepositoryIndustryId)
    ? (industryParam as RepositoryIndustryId)
    : null;
  const [section, setSection] = useState<'overview' | 'work' | 'studies' | 'files'>('overview');

  const openIndustry = (id: RepositoryIndustryId) => {
    const next = new URLSearchParams(params);
    next.set('industry', id);
    next.delete('folder');
    setParams(next);
    setSection('overview');
  };

  if (!roomId) {
    return (
      <div className="min-w-0 space-y-8">
        <div className="rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/50 p-4 dark:border-indigo-700/50 dark:bg-indigo-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">After deployment</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Success story rooms will load client decks, case studies, PDFs, videos, and images from ConnectHub storage. Current sample content is placeholder only.
          </p>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Open a client room for Healthcare, Engineering, or BFSI — pitch, services, case studies, and decks.
          The numbered GCC folders live in the Repository window.
        </p>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Healthcare · Engineering · BFSI</p>
          <div className="grid gap-4 md:grid-cols-3">
            {REPOSITORY_INDUSTRY_IDS.map((id) => {
              const item = REPOSITORY_INDUSTRIES[id];
              const Icon = ICONS[id];
              const accent = ACCENT[item.accent];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => openIndustry(id)}
                  className="group overflow-hidden rounded-2xl text-left shadow-lg ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl dark:ring-white/10"
                >
                  <div className={`relative min-h-[10rem] bg-gradient-to-br p-5 text-white ${accent.card}`}>
                    <Icon className="h-8 w-8 opacity-90" />
                    <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{item.eyebrow}</p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-tight">{item.name}</h3>
                  </div>
                  <div className="bg-white p-4 dark:bg-slate-900">
                    <p className="line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.pitch}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const industry = REPOSITORY_INDUSTRIES[roomId];
  const accent = ACCENT[industry.accent];
  const Icon = ICONS[industry.id];

  return (
    <div className="min-w-0 space-y-6">
      <div className={`overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-xl ${accent.card}`}>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-white/80">
              <Icon className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">{industry.eyebrow}</span>
            </div>
            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">{industry.headline}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">{industry.pitch}</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 xs:grid-cols-3 sm:min-w-[18rem] sm:gap-3">
            {industry.stats.map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
                <p className="text-sm font-semibold sm:text-base">{stat.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/70 max-lg:[overflow-wrap:anywhere]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="window-tab-scroll -mx-1 flex gap-2 px-1 pb-1">
        {(
          [
            ['overview', 'Expertise'],
            ['work', 'Services'],
            ['studies', 'Case studies'],
            ['files', 'Decks & files'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
              section === id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {section === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {industry.expertise.map((item) => (
            <div key={item.title} className={`rounded-xl border border-slate-200 p-4 dark:border-slate-700 ${accent.soft}`}>
              <h4 className="font-semibold text-slate-900 dark:text-white">{item.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.detail}</p>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-slate-300 p-4 sm:col-span-2 dark:border-slate-600">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">If they are in the room</p>
            <ul className="mt-2 space-y-2">
              {industry.talkingPoints.map((point) => (
                <li key={point} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {section === 'work' && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {industry.services.map((service) => (
            <li
              key={service}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              {service}
            </li>
          ))}
        </ul>
      )}
      {section === 'studies' && (
        <div className="space-y-4">
          {industry.caseStudies.map((study) => (
            <article key={study.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className={`h-1.5 ${accent.bar}`} />
              <div className="p-5 sm:p-6">
                <p className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${accent.badge}`}>
                  {study.client}
                </p>
                <h4 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{study.title}</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">The problem</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{study.challenge}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What we did</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{study.whatWeDid}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What changed</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{study.outcome}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {section === 'files' && <AssetExplorer slug={industry.id} onTrail={onTrail} />}
    </div>
  );
}

import { AssetExplorer, type AssetTrailCrumb } from '@/components/AssetExplorer';

export function AssetsWindow({ onTrail }: { onTrail?: (crumbs: AssetTrailCrumb[]) => void }) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-dashed border-slate-300/70 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">After deployment</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          The GCC repository will host large folders of PPT, PDF, video, images, and other file types. Upload and browse from here once production content is connected.
        </p>
      </div>
      <AssetExplorer slug="gcc-assets" onTrail={onTrail} />
    </div>
  );
}

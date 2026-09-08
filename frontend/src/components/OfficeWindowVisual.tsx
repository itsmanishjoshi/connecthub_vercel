import { cn } from '@/lib/utils';

export type OfficeWindowVisualId =
  | 'accion'
  | 'events'
  | 'galaxy'
  | 'repository'
  | 'assets'
  | 'teams'
  | 'clients'
  | 'rooms'
  | 'analytics';

type Palette = {
  primary: string;
  secondary: string;
  tertiary: string;
  light: string;
  surface: string;
};

export type WindowTheme = {
  icon: string;
  panel: string;
  borderHover: string;
  blobA: string;
  blobB: string;
  palette: Palette;
};

/** Richer in-panel color — still flat and corporate, no outer glow */
export const WINDOW_THEME: Record<OfficeWindowVisualId, WindowTheme> = {
  accion: {
    icon: 'bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300',
    panel: 'bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 dark:from-sky-950/50 dark:via-slate-900/60 dark:to-indigo-950/45',
    borderHover: 'hover:border-sky-400/40 dark:hover:border-sky-600/40',
    blobA: 'bg-sky-300/30 dark:bg-sky-500/15',
    blobB: 'bg-indigo-300/25 dark:bg-indigo-500/10',
    palette: { primary: '#0284c7', secondary: '#6366f1', tertiary: '#38bdf8', light: '#e0f2fe', surface: '#ffffff' },
  },
  events: {
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300',
    panel: 'bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 dark:from-violet-950/45 dark:via-slate-900/55 dark:to-fuchsia-950/35',
    borderHover: 'hover:border-violet-400/40 dark:hover:border-violet-600/40',
    blobA: 'bg-violet-300/30 dark:bg-violet-500/15',
    blobB: 'bg-fuchsia-300/20 dark:bg-fuchsia-500/10',
    palette: { primary: '#7c3aed', secondary: '#a855f7', tertiary: '#c4b5fd', light: '#ede9fe', surface: '#ffffff' },
  },
  galaxy: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300',
    panel: 'bg-gradient-to-br from-slate-900 via-[#0b1120] to-blue-950 dark:from-slate-950 dark:via-[#0b1120] dark:to-blue-950/80',
    borderHover: 'hover:border-blue-400/40 dark:hover:border-blue-500/40',
    blobA: 'bg-blue-400/20 dark:bg-blue-500/15',
    blobB: 'bg-indigo-400/15 dark:bg-indigo-500/10',
    palette: { primary: '#3b82f6', secondary: '#60a5fa', tertiary: '#93c5fd', light: '#1e293b', surface: '#0f172a' },
  },
  repository: {
    icon: 'bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300',
    panel: 'bg-gradient-to-br from-teal-100 via-emerald-50 to-cyan-100 dark:from-teal-950/45 dark:via-slate-900/55 dark:to-cyan-950/35',
    borderHover: 'hover:border-teal-400/40 dark:hover:border-teal-600/40',
    blobA: 'bg-teal-300/30 dark:bg-teal-500/15',
    blobB: 'bg-emerald-300/25 dark:bg-emerald-500/10',
    palette: { primary: '#0d9488', secondary: '#14b8a6', tertiary: '#5eead4', light: '#ccfbf1', surface: '#ffffff' },
  },
  assets: {
    icon: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
    panel: 'bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 dark:from-amber-950/40 dark:via-slate-900/55 dark:to-orange-950/35',
    borderHover: 'hover:border-amber-400/40 dark:hover:border-amber-600/40',
    blobA: 'bg-amber-300/35 dark:bg-amber-500/15',
    blobB: 'bg-orange-300/25 dark:bg-orange-500/10',
    palette: { primary: '#d97706', secondary: '#ea580c', tertiary: '#fbbf24', light: '#ffedd5', surface: '#ffffff' },
  },
  teams: {
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300',
    panel: 'bg-gradient-to-br from-rose-50 via-slate-50 to-pink-100 dark:from-rose-950/30 dark:via-slate-900/50 dark:to-pink-950/25',
    borderHover: '',
    blobA: 'bg-rose-200/30 dark:bg-rose-500/10',
    blobB: 'bg-pink-200/20 dark:bg-pink-500/8',
    palette: { primary: '#e11d48', secondary: '#f43f5e', tertiary: '#fda4af', light: '#ffe4e6', surface: '#ffffff' },
  },
  clients: {
    icon: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300',
    panel: 'bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-100 dark:from-indigo-950/30 dark:via-slate-900/50 dark:to-blue-950/25',
    borderHover: '',
    blobA: 'bg-indigo-200/30 dark:bg-indigo-500/10',
    blobB: 'bg-blue-200/20 dark:bg-blue-500/8',
    palette: { primary: '#4f46e5', secondary: '#6366f1', tertiary: '#a5b4fc', light: '#e0e7ff', surface: '#ffffff' },
  },
  rooms: {
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/80 dark:text-cyan-300',
    panel: 'bg-gradient-to-br from-cyan-50 via-slate-50 to-sky-100 dark:from-cyan-950/30 dark:via-slate-900/50 dark:to-sky-950/25',
    borderHover: '',
    blobA: 'bg-cyan-200/30 dark:bg-cyan-500/10',
    blobB: 'bg-sky-200/20 dark:bg-sky-500/8',
    palette: { primary: '#0891b2', secondary: '#06b6d4', tertiary: '#67e8f9', light: '#cffafe', surface: '#ffffff' },
  },
  analytics: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300',
    panel: 'bg-gradient-to-br from-blue-100 via-slate-50 to-indigo-100 dark:from-blue-950/45 dark:via-slate-900/55 dark:to-indigo-950/40',
    borderHover: 'hover:border-blue-400/40 dark:hover:border-blue-600/40',
    blobA: 'bg-blue-300/30 dark:bg-blue-500/15',
    blobB: 'bg-indigo-300/25 dark:bg-indigo-500/10',
    palette: { primary: '#2563eb', secondary: '#3b82f6', tertiary: '#93c5fd', light: '#dbeafe', surface: '#ffffff' },
  },
};

function ColoredVisual({ id, palette }: { id: OfficeWindowVisualId; palette: Palette }) {
  const { primary, secondary, tertiary, light, surface } = palette;
  const svgProps = { viewBox: '0 0 200 112', className: 'h-full w-full', 'aria-hidden': true as const };

  switch (id) {
    case 'accion':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.92" />
          <circle cx="100" cy="52" r="20" fill={light} stroke={primary} strokeWidth="1.5" />
          <circle cx="100" cy="52" r="10" fill={primary} fillOpacity="0.85" />
          <path d="M100 42 L106 50 H94 Z" fill={surface} />
          {[
            [48, 32, secondary],
            [152, 32, tertiary],
            [48, 78, tertiary],
            [152, 78, secondary],
          ].map(([x, y, color]) => (
            <g key={`${x}-${y}`}>
              <line x1="100" y1="52" x2={x} y2={y} stroke={color} strokeWidth="1.25" opacity="0.45" />
              <rect x={Number(x) - 16} y={Number(y) - 11} width="32" height="22" rx="5" fill={String(color)} fillOpacity="0.2" stroke={String(color)} strokeWidth="1" />
            </g>
          ))}
        </svg>
      );
    case 'events':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.92" />
          <rect x="28" y="24" width="52" height="64" rx="6" fill={light} stroke={primary} strokeWidth="1.25" />
          <rect x="28" y="24" width="52" height="14" rx="6" fill={primary} fillOpacity="0.85" />
          {[
            [38, 46, primary],
            [58, 46, tertiary],
            [38, 62, tertiary],
            [58, 62, secondary],
            [38, 78, secondary],
            [58, 78, primary],
          ].map(([x, y, color], i) => (
            <rect key={i} x={Number(x)} y={Number(y)} width="12" height="10" rx="2" fill={String(color)} fillOpacity={i === 0 ? 0.9 : 0.35} />
          ))}
          <rect x="92" y="28" width="80" height="56" rx="6" fill={light} stroke={secondary} strokeWidth="1" strokeOpacity="0.5" />
          <rect x="102" y="40" width="32" height="5" rx="2.5" fill={primary} fillOpacity="0.7" />
          <rect x="102" y="50" width="24" height="4" rx="2" fill={tertiary} fillOpacity="0.6" />
          <rect x="102" y="58" width="28" height="4" rx="2" fill={tertiary} fillOpacity="0.4" />
          <circle cx="158" cy="44" r="8" fill={secondary} fillOpacity="0.25" />
        </svg>
      );
    case 'galaxy':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.95" />
          {[
            [34, 28, 0.7],
            [58, 44, 0.5],
            [142, 32, 0.6],
            [162, 58, 0.45],
            [48, 72, 0.55],
            [128, 78, 0.4],
          ].map(([cx, cy, opacity]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill={tertiary} fillOpacity={Number(opacity)} />
          ))}
          <rect x="58" y="30" width="84" height="10" rx="5" fill={light} stroke={primary} strokeWidth="0.75" strokeOpacity="0.35" />
          <circle cx="66" cy="35" r="2" fill={primary} fillOpacity="0.9" />
          <rect x="72" y="33" width="58" height="4" rx="2" fill={secondary} fillOpacity="0.55" />
          <rect x="44" y="46" width="112" height="6" rx="3" fill={primary} fillOpacity="0.85" />
          <rect x="52" y="56" width="96" height="5" rx="2.5" fill={secondary} fillOpacity="0.75" />
          <rect x="60" y="65" width="80" height="5" rx="2.5" fill={tertiary} fillOpacity="0.45" />
          <line x1="78" y1="78" x2="78" y2="92" stroke={tertiary} strokeWidth="0.75" opacity="0.35" />
          <line x1="122" y1="78" x2="122" y2="92" stroke={tertiary} strokeWidth="0.75" opacity="0.35" />
          {[
            [58, 84, '28'],
            [100, 84, '12'],
            [142, 84, '10'],
          ].map(([x, y, label]) => (
            <g key={String(label)}>
              <text x={x} y={y} textAnchor="middle" fill={secondary} fontSize="8" fontWeight="700">
                {label}
              </text>
            </g>
          ))}
        </svg>
      );
    case 'repository':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.92" />
          <rect x="36" y="48" width="34" height="40" rx="4" fill={tertiary} fillOpacity="0.35" />
          <rect x="78" y="32" width="44" height="56" rx="5" fill={light} stroke={primary} strokeWidth="1.5" />
          <rect x="88" y="44" width="24" height="4" rx="2" fill={primary} fillOpacity="0.75" />
          <rect x="88" y="52" width="18" height="3" rx="1.5" fill={secondary} fillOpacity="0.5" />
          <rect x="130" y="52" width="34" height="36" rx="4" fill={tertiary} fillOpacity="0.35" />
          <path d="M88 36 L94 28 H108 L114 36" fill="none" stroke={primary} strokeWidth="1.5" />
          <circle cx="101" cy="24" r="6" fill={secondary} fillOpacity="0.7" />
          <rect x="88" y="62" width="24" height="16" rx="3" fill={primary} fillOpacity="0.15" />
        </svg>
      );
    case 'assets':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.92" />
          <path d="M40 68 L40 48 L68 38 L96 48 L96 68 Z" fill={tertiary} fillOpacity="0.4" stroke={secondary} strokeWidth="1" />
          <path d="M56 62 L56 44 L76 36 L96 44 L96 62 L76 70 Z" fill={light} stroke={primary} strokeWidth="1.5" />
          <rect x="108" y="40" width="48" height="52" rx="5" fill={light} stroke={primary} strokeWidth="1.25" />
          <rect x="118" y="52" width="28" height="4" rx="2" fill={primary} fillOpacity="0.8" />
          <rect x="118" y="60" width="20" height="3" rx="1.5" fill={secondary} fillOpacity="0.5" />
          <rect x="118" y="68" width="24" height="3" rx="1.5" fill={tertiary} fillOpacity="0.55" />
          <rect x="118" y="76" width="16" height="8" rx="2" fill={primary} fillOpacity="0.2" />
        </svg>
      );
    case 'teams':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.92" />
          {[
            [62, 58, primary],
            [100, 46, secondary],
            [138, 58, tertiary],
          ].map(([cx, cy, color]) => (
            <g key={cx}>
              <circle cx={cx} cy={cy} r="18" fill={String(color)} fillOpacity="0.15" stroke={String(color)} strokeWidth="1.25" />
              <circle cx={cx} cy={Number(cy) - 5} r="7" fill={String(color)} fillOpacity="0.55" />
              <ellipse cx={cx} cy={Number(cy) + 10} rx="11" ry="6" fill={String(color)} fillOpacity="0.2" />
            </g>
          ))}
          <path d="M62 58 L100 46 L138 58" fill="none" stroke={secondary} strokeWidth="1.25" opacity="0.4" />
        </svg>
      );
    case 'clients':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.92" />
          <rect x="36" y="32" width="52" height="56" rx="6" fill={light} stroke={primary} strokeWidth="1.25" />
          <rect x="46" y="44" width="32" height="5" rx="2.5" fill={primary} fillOpacity="0.65" />
          <rect x="46" y="54" width="24" height="4" rx="2" fill={tertiary} fillOpacity="0.5" />
          <rect x="112" y="32" width="52" height="56" rx="6" fill={light} stroke={secondary} strokeWidth="1.25" />
          <rect x="122" y="44" width="32" height="5" rx="2.5" fill={secondary} fillOpacity="0.65" />
          <rect x="122" y="54" width="24" height="4" rx="2" fill={tertiary} fillOpacity="0.5" />
          <path d="M88 58 H112" stroke={primary} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <circle cx="88" cy="58" r="5" fill={primary} fillOpacity="0.6" />
          <circle cx="112" cy="58" r="5" fill={secondary} fillOpacity="0.6" />
        </svg>
      );
    case 'rooms':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.92" />
          <rect x="32" y="26" width="136" height="60" rx="8" fill={light} stroke={primary} strokeWidth="1.25" />
          <line x1="100" y1="26" x2="100" y2="86" stroke={tertiary} strokeWidth="1" opacity="0.5" />
          <line x1="32" y1="56" x2="168" y2="56" stroke={tertiary} strokeWidth="1" opacity="0.5" />
          {[
            [66, 41, primary],
            [134, 41, secondary],
            [66, 71, secondary],
            [134, 71, primary],
          ].map(([cx, cy, color]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r="12" fill={String(color)} fillOpacity="0.2" stroke={String(color)} strokeWidth="1" />
              <circle cx={cx} cy={Number(cy) - 2} r="4" fill={String(color)} fillOpacity="0.55" />
            </g>
          ))}
          <circle cx="100" cy="92" r="3" fill="#ef4444" fillOpacity="0.8" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...svgProps}>
          <rect x="16" y="12" width="168" height="88" rx="10" fill={surface} fillOpacity="0.92" />
          {[40, 68, 96, 124].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={72 - i * 8}
              width="18"
              height={20 + i * 10}
              rx="3"
              fill={[tertiary, secondary, primary, secondary][i]}
              fillOpacity={[0.45, 0.55, 0.75, 0.5][i]}
            />
          ))}
          <path
            d="M44 64 L72 52 L100 48 L128 54 L156 42"
            fill="none"
            stroke={primary}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {[
            [44, 64],
            [72, 52],
            [100, 48],
            [128, 54],
            [156, 42],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" fill={surface} stroke={primary} strokeWidth="1.5" />
          ))}
          <rect x="36" y="22" width="28" height="14" rx="4" fill={light} stroke={tertiary} strokeWidth="1" />
          <rect x="40" y="27" width="12" height="3" rx="1.5" fill={primary} fillOpacity="0.6" />
        </svg>
      );
    default:
      return null;
  }
}

export function OfficeWindowVisual({ id, dimmed, compact }: { id: OfficeWindowVisualId; dimmed?: boolean; compact?: boolean }) {
  const theme = WINDOW_THEME[id];
  return (
    <div
      className={cn(
        'relative mx-auto w-full',
        compact ? 'max-w-[6.75rem] sm:max-w-[13.5rem]' : 'max-w-[12.5rem] sm:max-w-[13.5rem]',
        dimmed && 'opacity-55 saturate-[0.65]',
      )}
    >
      {/* Soft color blobs — inside panel only */}
      <span className={cn('pointer-events-none absolute -left-2 top-1 h-14 w-14 rounded-full blur-xl max-sm:h-8 max-sm:w-8', theme.blobA)} aria-hidden />
      <span className={cn('pointer-events-none absolute -right-1 bottom-0 h-12 w-12 rounded-full blur-lg max-sm:h-7 max-sm:w-7', theme.blobB)} aria-hidden />

      <div className="relative overflow-hidden rounded-md border border-white/60 bg-white/75 p-1 shadow-sm backdrop-blur-[2px] dark:border-white/10 dark:bg-slate-900/40 sm:rounded-lg sm:p-2.5">
        <div className="aspect-[200/112] w-full">
          <ColoredVisual id={id} palette={theme.palette} />
        </div>
      </div>
    </div>
  );
}

export function windowAccentStrip(id: OfficeWindowVisualId): string {
  const strips: Record<OfficeWindowVisualId, string> = {
    accion: 'bg-sky-500',
    events: 'bg-violet-500',
    galaxy: 'bg-blue-500',
    repository: 'bg-teal-500',
    assets: 'bg-amber-500',
    teams: 'bg-rose-400',
    clients: 'bg-indigo-500',
    rooms: 'bg-cyan-500',
    analytics: 'bg-blue-500',
  };
  return strips[id];
}

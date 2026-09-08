/** ConnectHub uses a single dark theme. */

export type Theme = 'dark';

export const APP_THEME: Theme = 'dark';

export const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
};

export function cycleTheme(): Theme {
  return APP_THEME;
}

export function themeFromSettings(_preference?: string, _prefersDark?: boolean): Theme {
  return APP_THEME;
}

export function shellBackgroundClass(_theme: Theme = APP_THEME): string {
  return 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900';
}

export function shellOverlayTopClass(_theme: Theme = APP_THEME): string {
  return 'bg-gradient-to-b from-slate-900/80 to-transparent';
}

export function shellOverlayBottomClass(_theme: Theme = APP_THEME): string {
  return 'bg-gradient-to-t from-slate-900/80 to-transparent';
}

export function panelSurfaceClass(_theme: Theme = APP_THEME): string {
  return 'bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 shadow-xl';
}

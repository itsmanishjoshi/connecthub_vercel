export const CONNECTHUB_LOGO_PATH = '/connecthub-logo.png';
export const JELLY_LOGO_PATH = '/jelly-logo.png';

export function connectHubLogoUrl(version?: string) {
  const stamp = version || import.meta.env.VITE_LOGO_VERSION || '1';
  return `${CONNECTHUB_LOGO_PATH}?v=${stamp}`;
}

export function jellyLogoUrl(version?: string) {
  const stamp = version || import.meta.env.VITE_JELLY_LOGO_VERSION || '1';
  return `${JELLY_LOGO_PATH}?v=${stamp}`;
}

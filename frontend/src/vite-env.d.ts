/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_LOGO_VERSION?: string;
  readonly VITE_JELLY_LOGO_VERSION?: string;
}

declare module '*.mjs' {
  const value: any;
  export = value;
}

declare module '@/lib/syncLogic.mjs' {
  export const MAX_ATTEMPTS: number;
  export function backoffMs(attempts: number): number;
  export function compactQueue<T>(queue: T[], incoming: T): T[];
  export function markFailedAttempt<T extends { attempts?: number; nextAttemptAt?: number }>(
    operation: T,
    now?: number,
  ): T & { attempts: number; nextAttemptAt: number; exhausted: boolean };
  export function currentAccountId(): string | null;
  export function hasValidSession(): boolean;
}

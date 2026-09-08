import { unlockUi } from '@/lib/unlockUi';

export const JELLY_OPEN_EVENT = 'connecthub:open-jelly';

export interface JellyOpenDetail {
  mode?: 'chat' | 'voice' | 'app' | 'capture';
  conversationId?: string;
  eventId?: string;
  eventName?: string;
  attendeeId?: string;
  attendeeName?: string;
  companyName?: string;
  suggestedTitle?: string;
  autoStart?: boolean;
  prompt?: string;
}

export function openJelly(detail: JellyOpenDetail = {}) {
  unlockUi();
  window.dispatchEvent(new CustomEvent<JellyOpenDetail>(JELLY_OPEN_EVENT, { detail }));
}

/** Close another dialog first, then open Jelly so Radix is not left pointer-locked. */
export function openJellySoon(detail: JellyOpenDetail = {}, delayMs = 250) {
  window.setTimeout(() => openJelly(detail), delayMs);
}

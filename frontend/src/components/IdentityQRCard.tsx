import {
  QRCodeGenerator,
  displayNameFromIdentity,
  resolveQRIdentity,
  type QRIdentityProfile,
} from '@/components/QRCodeGenerator';
import { AccionlabsLogo } from '@/components/AccionlabsLogo';
import { resolveAvatarUrl } from '@/lib/avatarUpload';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { Link2, Mail, Phone, QrCode } from 'lucide-react';
import { forwardRef, useEffect, useRef, useState } from 'react';

interface IdentityQRCardProps {
  vCardData?: string;
  qrImageUrl?: string;
  identity?: QRIdentityProfile;
  qrSize?: number;
}

const SKY_BLUE = '#c5e8f7';
const RIGHT_TINT = '#b3daf0';
const NAVY = '#1e293b';
const MUTED = '#64748b';
const CARD_PAD = 10;

function linkedInDisplay(raw?: string | null): { display: string; full: string } {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return { display: '', full: '' };

  let full = trimmed;
  if (!/^https?:\/\//i.test(full)) {
    full = full.startsWith('www.') ? `https://${full}` : `https://${full}`;
  }

  try {
    const u = new URL(full);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '');
    return { display: `${host}${path}`, full };
  } catch {
    const display = trimmed.replace(/^https?:\/\/(www\.)?/i, '');
    return { display, full: trimmed };
  }
}

function DetailLine({
  icon: Icon,
  value,
  title,
}: {
  icon: typeof Mail;
  value?: string | null;
  title?: string;
}) {
  if (!value?.trim()) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-[1.2rem] w-[1.2rem] shrink-0 text-slate-600" strokeWidth={1.75} aria-hidden />
      <span
        className="min-w-0 flex-1 truncate text-[0.9rem] font-medium leading-snug sm:text-[15px]"
        style={{ color: NAVY }}
        title={title ?? value.trim()}
      >
        {value.trim()}
      </span>
    </div>
  );
}

/**
 * Landscape visiting card — 2.35:1, QR left | details right.
 */
export const IdentityQRCard = forwardRef<HTMLElement, IdentityQRCardProps>(function IdentityQRCard(
  {
    vCardData = '',
    qrImageUrl,
    identity,
    qrSize = 180,
  },
  ref,
) {
  const profile = resolveQRIdentity(vCardData, identity);
  const fullName = displayNameFromIdentity(profile, 'Your name');
  const avatarSrc = useAuthenticatedImage(resolveAvatarUrl(profile.avatarUrl));
  const resolvedQrImage = useAuthenticatedImage(qrImageUrl ? resolveAvatarUrl(qrImageUrl) : null);
  const leftPanelRef = useRef<HTMLElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [renderedQrSize, setRenderedQrSize] = useState(qrSize);
  const [qrBoxSize, setQrBoxSize] = useState(0);

  useEffect(() => {
    const panel = leftPanelRef.current;
    const qrNode = qrContainerRef.current;
    if (!panel || !qrNode) return;

    const measure = () => {
      const innerW = panel.clientWidth - CARD_PAD * 2;
      const innerH = panel.clientHeight - CARD_PAD * 2;
      const side = Math.floor(Math.min(innerW, innerH));
      if (side > 0) {
        setQrBoxSize(side);
        setRenderedQrSize(Math.max(side - 12, 64));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [qrSize]);

  const linkedIn = linkedInDisplay(profile.linkedinUrl);

  return (
    <article
      ref={ref}
      className="mx-auto grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl font-sans antialiased shadow-[0_8px_32px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.05] max-md:aspect-auto md:aspect-[2.35/1] md:grid-cols-[42fr_58fr]"
      style={{ backgroundColor: SKY_BLUE }}
    >
      {/* Left — QR */}
      <section
        ref={leftPanelRef}
        className="flex min-h-0 items-center justify-center border-b border-slate-500/30 md:h-full md:border-b-0 md:border-r"
        style={{ padding: CARD_PAD }}
        aria-label="QR code"
      >
        <div
          className="mx-auto aspect-square w-full max-w-[min(100%,220px)] shrink-0 rounded-xl bg-white p-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.08)] sm:max-w-[min(100%,260px)] md:max-w-none md:mx-0"
          style={qrBoxSize > 0 ? { width: qrBoxSize, height: qrBoxSize, maxWidth: '100%' } : undefined}
        >
          <div ref={qrContainerRef} className="h-full w-full">
            {resolvedQrImage ? (
              <img
                src={resolvedQrImage}
                alt={`QR code for ${fullName}`}
                className="block h-full w-full object-contain"
              />
            ) : vCardData ? (
              <QRCodeGenerator
                data={vCardData}
                size={renderedQrSize}
                className="block h-full w-full max-w-full"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <QrCode className="h-10 w-10" strokeWidth={1.5} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Right — profile + contact lines */}
      <section
        className="relative flex h-full min-h-0 flex-col"
        style={{ backgroundColor: RIGHT_TINT, padding: CARD_PAD }}
        aria-label="Identity details"
      >
        <div className="absolute right-2 top-2 sm:right-2.5 sm:top-2.5">
          <AccionlabsLogo className="h-8 w-auto sm:h-9" />
        </div>

        <div className="grid h-full min-h-0 pl-3 pr-6 sm:pl-4 sm:pr-8 md:pl-[0.5cm] md:pr-9" style={{ gridTemplateRows: 'auto 1fr' }}>
          <div className="flex min-w-0 items-center gap-3 pt-4 sm:gap-3.5 md:pt-[1cm]">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-2 ring-white/90 sm:h-[5.5rem] sm:w-[5.5rem] md:h-[6rem] md:w-[6rem]">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-xl font-semibold sm:text-2xl"
                  style={{ color: MUTED, backgroundColor: '#e2e8f0' }}
                >
                  {(profile.firstName?.[0] || profile.lastName?.[0] || '?').toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              <h2
                className="truncate text-[1.35rem] font-bold leading-tight sm:text-2xl"
                style={{ color: NAVY }}
                title={fullName}
              >
                {fullName}
              </h2>
              {profile.designation ? (
                <p
                  className="mt-1 truncate text-[0.9rem] leading-snug sm:text-[15px]"
                  style={{ color: MUTED }}
                  title={profile.designation}
                >
                  {profile.designation}
                </p>
              ) : null}
              {profile.company || profile.city ? (
                <p
                  className="mt-1 min-w-0 text-[0.9rem] leading-snug [overflow-wrap:anywhere] sm:text-[15px]"
                  title={[profile.company, profile.city].filter(Boolean).join(' · ')}
                >
                  {profile.company ? (
                    <span className="font-medium" style={{ color: '#475569' }}>
                      {profile.company}
                    </span>
                  ) : null}
                  {profile.company && profile.city ? (
                    <span style={{ color: MUTED }}> · </span>
                  ) : null}
                  {profile.city ? (
                    <span style={{ color: MUTED }}>{profile.city}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col justify-center md:-translate-y-[0.5cm]">
            <div className="h-px w-full shrink-0 bg-slate-500/25" role="separator" />
            <div className="flex flex-col gap-3 pt-3 sm:gap-[15px] md:pt-[calc(0.5rem+0.5cm)]">
              <DetailLine icon={Mail} value={profile.email} />
              <DetailLine icon={Phone} value={profile.mobileNo} />
              <DetailLine icon={Link2} value={linkedIn.display} title={linkedIn.full} />
            </div>
          </div>
        </div>
      </section>
    </article>
  );
});

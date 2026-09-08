import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeGeneratorProps {
  data: string;
  size?: number;
  className?: string;
}

export function QRCodeGenerator({ data, size = 300, className = '' }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).catch((err: Error) => {
        console.error('Error generating QR code:', err);
      });
    }
  }, [data, size]);

  return <canvas ref={canvasRef} className={className} />;
}

export function generateVCard(profile: {
  firstName: string;
  lastName: string;
  email?: string;
  mobileNo?: string;
  company?: string;
  designation?: string;
  city?: string;
  linkedinUrl?: string;
}): string {
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${profile.firstName} ${profile.lastName}`,
    `N:${profile.lastName};${profile.firstName};;;`,
    profile.email ? `EMAIL:${profile.email}` : '',
    profile.mobileNo ? `TEL:${profile.mobileNo}` : '',
    profile.company ? `ORG:${profile.company}` : '',
    profile.designation ? `TITLE:${profile.designation}` : '',
    profile.city ? `ADR:;;;;;;${profile.city}` : '',
    profile.linkedinUrl ? `URL:${profile.linkedinUrl}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\n');

  return vcard;
}

export interface QRIdentityProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNo?: string;
  company?: string;
  designation?: string;
  city?: string;
  linkedinUrl?: string;
  avatarUrl?: string | null;
}

function readVCardField(line: string, prefix: string): string {
  if (!line.startsWith(prefix)) return '';
  return line.slice(prefix.length).trim();
}

/** Parse a vCard string into display fields (falls back gracefully). */
export function parseVCard(vcard: string): QRIdentityProfile {
  if (!vcard?.trim()) return {};
  const profile: QRIdentityProfile = {};
  for (const raw of vcard.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('FN:')) {
      const full = readVCardField(line, 'FN:');
      if (full && !profile.firstName) {
        const parts = full.split(/\s+/);
        profile.firstName = parts[0];
        profile.lastName = parts.slice(1).join(' ') || undefined;
      }
    } else if (line.startsWith('N:')) {
      const parts = readVCardField(line, 'N:').split(';');
      profile.lastName = parts[0] || profile.lastName;
      profile.firstName = parts[1] || profile.firstName;
    } else if (line.startsWith('EMAIL:')) {
      profile.email = readVCardField(line, 'EMAIL:') || profile.email;
    } else if (line.startsWith('TEL:')) {
      profile.mobileNo = readVCardField(line, 'TEL:') || profile.mobileNo;
    } else if (line.startsWith('ORG:')) {
      profile.company = readVCardField(line, 'ORG:') || profile.company;
    } else if (line.startsWith('TITLE:')) {
      profile.designation = readVCardField(line, 'TITLE:') || profile.designation;
    } else if (line.startsWith('URL:')) {
      profile.linkedinUrl = readVCardField(line, 'URL:') || profile.linkedinUrl;
    } else if (line.startsWith('ADR:')) {
      const adr = readVCardField(line, 'ADR:');
      const city = adr.split(';').filter(Boolean).pop();
      if (city) profile.city = city;
    }
  }
  return profile;
}

export function resolveQRIdentity(vcard: string, overrides?: QRIdentityProfile): QRIdentityProfile {
  return { ...parseVCard(vcard), ...(overrides || {}) };
}

export function displayNameFromIdentity(identity: QRIdentityProfile, fallback = 'Contact'): string {
  const name = [identity.firstName, identity.lastName].filter(Boolean).join(' ').trim();
  return name || fallback;
}

export function downloadQRCode(canvasElement: HTMLCanvasElement, filename: string = 'my-qr-code.png') {
  canvasElement.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
  });
}

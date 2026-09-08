import { supabase } from './supabaseClient';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Normalize stored avatar URLs so they load on any host/port. */
export function resolveAvatarUrl(url?: string | null): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;

  try {
    const parsed = new URL(trimmed, API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost'));
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Keep the original value when it is not a parseable URL.
  }

  return trimmed;
}

export async function uploadUserAvatar(userId: string, file: Blob): Promise<string> {
  if (!userId) {
    throw new Error('Sign in to upload a profile picture');
  }

  const fileName = `avatar_${userId}_${Date.now()}.jpg`;
  const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'image/jpeg',
  });

  if (error) {
    throw new Error(error.message || 'Upload failed');
  }

  const fromResponse = resolveAvatarUrl((data as { publicUrl?: string } | null)?.publicUrl);
  if (fromResponse) return fromResponse;

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
  const resolved = resolveAvatarUrl(publicUrlData?.publicUrl);
  if (resolved) return resolved;

  return `/uploads/avatars/${fileName.split('/').pop() || fileName}`;
}

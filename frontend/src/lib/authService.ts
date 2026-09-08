import { supabase } from './supabaseClient';
import { resolveAvatarUrl } from './avatarUpload';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  mustChangePassword?: boolean;
}

export interface UserProfile {
  id: string;
  email?: string | null;
  firstName: string;
  lastName: string;
  company?: string | null;
  avatarUrl?: string | null;
  designation?: string | null;
  city?: string | null;
  mobileNo?: string | null;
  linkedinUrl?: string | null;
  profileCompleted?: boolean;
  isAdmin?: boolean;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('connecthub_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export class AuthNetworkError extends Error {
  constructor(message = 'ConnectHub is offline') {
    super(message);
    this.name = 'AuthNetworkError';
  }
}

function rememberSession(user: User, profile: UserProfile | null) {
  localStorage.setItem('connecthub_session_snapshot', JSON.stringify({ user, profile }));
}

function readRememberedSession(): { user: User; profile: UserProfile | null } | null {
  try {
    const token = localStorage.getItem('connecthub_token');
    const raw = localStorage.getItem('connecthub_session_snapshot');
    if (!token || !raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function apiRequest(path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers || {}) },
    });
  } catch {
    throw new AuthNetworkError();
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || `Request failed (${response.status})`);
  return json;
}

function mapApiProfile(profile: any, isAdmin: boolean): UserProfile | null {
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    company: profile.company,
    avatarUrl: resolveAvatarUrl(profile.avatar_url),
    designation: profile.designation,
    city: profile.location,
    mobileNo: profile.mobile_no,
    linkedinUrl: profile.linkedin_url,
    profileCompleted: profile.profile_completed,
    isAdmin,
  };
}

export async function restoreSession(): Promise<{ user: User; profile: UserProfile | null }> {
  try {
    const json = await apiRequest('/api/auth/me');
    const user: User = {
      id: json.user.id,
      username: json.user.username,
      isAdmin: json.user.isAdmin || false,
      mustChangePassword: Boolean(json.user.mustChangePassword),
    };
    const profile = mapApiProfile(json.profile, user.isAdmin);
    rememberSession(user, profile);
    return { user, profile };
  } catch (error) {
    if (error instanceof AuthNetworkError) {
      const remembered = readRememberedSession();
      if (remembered) return remembered;
    }
    throw error;
  }
}

// Check if user exists and is not deleted
export async function checkUserStatus(userId: string): Promise<{ exists: boolean; isDeleted: boolean }> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, deleted_at, status')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return { exists: false, isDeleted: false };
    }

    // User is considered deleted if deleted_at is set or status is 'dead'
    const isDeleted = user.deleted_at !== null || user.status === 'dead';
    
    return { exists: true, isDeleted };
  } catch (error) {
    console.error('Check user status error:', error);
    return { exists: false, isDeleted: false };
  }
}

// Authentication - with local fallback for development
export async function signIn(username: string, password: string): Promise<{ user: User; profile: UserProfile | null }> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status >= 500) {
      try {
        const health = await fetch(`${API_BASE}/api/health`).then((r) => r.json());
        if (health.database !== 'ok' && health.databaseHint) {
          throw new Error(health.databaseHint);
        }
      } catch (hintError) {
        if (hintError instanceof Error && hintError.message !== 'Failed to sign in') throw hintError;
      }
    }
    throw new Error(json.error?.message || 'Failed to sign in');
  }

  localStorage.setItem('connecthub_token', json.token);
  localStorage.setItem('current_user_id', json.user.id);
  localStorage.setItem('current_username', json.user.username);

  const user: User = {
    id: json.user.id,
    username: json.user.username,
    isAdmin: json.user.isAdmin || false,
    mustChangePassword: Boolean(json.user.mustChangePassword),
  };
  const userProfile = mapApiProfile(json.profile, user.isAdmin);
  rememberSession(user, userProfile);

  try {
    await updateUserLoginStatus(user.id, !!userProfile);
  } catch (e) {
    console.warn('Could not update login status:', e);
  }

  return { user, profile: userProfile };
}

// Get current user profile
export async function getCurrentProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) return null;

    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    return {
      id: profile.id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      company: profile.company,
      avatarUrl: resolveAvatarUrl(profile.avatar_url),
      designation: profile.designation,
      city: profile.location,
      mobileNo: profile.mobile_no,
      linkedinUrl: profile.linkedin_url,
      profileCompleted: profile.profile_completed,
      isAdmin: user?.is_admin || false,
    };
  } catch (error) {
    console.error('Get profile error:', error);
    return null;
  }
}

// Update profile
export async function updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
  try {
    console.log('Updating profile for user:', userId);
    console.log('Updates:', updates);
    
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          email: updates.email,
          first_name: updates.firstName,
          last_name: updates.lastName,
          company: updates.company,
          avatar_url: updates.avatarUrl,
          designation: updates.designation,
          location: updates.city,
          mobile_no: updates.mobileNo,
          linkedin_url: updates.linkedinUrl?.trim() || null,
          profile_completed: updates.profileCompleted,
        })
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        throw new Error(`Failed to update profile: ${error.message}`);
      }
      
      console.log('Profile updated successfully:', data);
    } else {
      // Insert new profile
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          email: updates.email,
          first_name: updates.firstName,
          last_name: updates.lastName,
          company: updates.company,
          avatar_url: updates.avatarUrl,
          designation: updates.designation,
          location: updates.city,
          mobile_no: updates.mobileNo,
          linkedin_url: updates.linkedinUrl?.trim() || null,
          profile_completed: updates.profileCompleted,
        })
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(`Failed to create profile: ${error.message}`);
      }
      
      console.log('Profile created successfully:', data);
    }

    if (updates.profileCompleted) {
      await updateUserOnboardingStatus(userId);
    } else {
      await updateUserToActive(userId);
    }

    return getCurrentProfile(userId);
  } catch (error: any) {
    console.error('Update profile error:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
}

// Change password
export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
  void userId;
  await apiRequest('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: oldPassword, newPassword }),
  });
  return true;
}

export interface GalleryItem {
  id: string;
  type: 'note' | 'image';
  title?: string;
  content?: string;
  data?: string;
  size: number;
  createdAt: string;
}

export async function getGalleryItems(profileId: string): Promise<GalleryItem[]> {
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((item: any) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    content: item.content,
    data: item.data,
    size: item.size,
    createdAt: item.created_at,
  }));
}

export async function addGalleryItem(
  profileId: string,
  item: Omit<GalleryItem, 'id' | 'createdAt'>
): Promise<void> {
  const { error } = await supabase.from('gallery_items').insert({
    user_id: profileId,
    type: item.type,
    title: item.title,
    content: item.content,
    data: item.data,
    size: item.size,
  });
  if (error) throw new Error(error.message);
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const { error } = await supabase.from('gallery_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// QR Code operations
export async function saveQRCode(profileId: string, vCardData: string): Promise<void> {
  try {
    console.log('saveQRCode: Upserting QR data for profile:', profileId);
    
    // Use UPSERT to update existing row or create new one
    const { data, error } = await supabase
      .from('qr_codes')
      .upsert(
        {
          user_id: profileId,
          qr_data: vCardData,
          format: 'vcard',
          created_at: new Date().toISOString(), // Update creation date on regeneration
          last_generated_at: new Date().toISOString(),
        },
        { 
          onConflict: 'user_id',
          ignoreDuplicates: false // Ensure we update, not ignore
        }
      )
      .select()
      .single();

    if (error) {
      console.error('saveQRCode error:', error);
      throw error;
    }
    
    console.log('saveQRCode: QR data upserted successfully', data);
    
    // Get the actual user_id from profile to update user status
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('id', profileId)
      .single();
    
    if (profile?.user_id) {
      await updateUserToActive(profile.user_id);
    }
  } catch (error) {
    console.error('Save QR code error:', error);
    throw error;
  }
}

export async function getQRCode(profileId: string): Promise<string | null> {
  try {
    console.log('getQRCode called with profileId:', profileId);
    
    const { data, error } = await supabase
      .from('qr_codes')
      .select('qr_data')
      .eq('user_id', profileId)
      .single();

    console.log('getQRCode query result:', { 
      hasData: !!data, 
      error: error ? error.message : 'none', 
      errorCode: error?.code 
    });

    if (error) {
      console.error('Get QR code error:', error);
      return null;
    }

    return data?.qr_data || null;
  } catch (error) {
    console.error('Get QR code error:', error);
    return null;
  }
}

// Get QR code metadata including creation date
export async function getQRCodeMetadata(profileId: string): Promise<{ qr_data: string; created_at: string } | null> {
  try {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('qr_data, created_at')
      .eq('user_id', profileId)
      .single();

    if (error) {
      console.error('Get QR code metadata error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Get QR code metadata error:', error);
    return null;
  }
}

// Upload QR code image to Supabase storage and save URL to profile
export async function uploadQRCodeImage(profileId: string, canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob from canvas'));
        return;
      }

      try {
        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${profileId}-${timestamp}.png`;
        const filePath = `${filename}`;

        // Get old QR code URL to delete it
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('qr_code_url')
          .eq('id', profileId)
          .single();

        // Delete old QR code if exists
        if (profile?.qr_code_url) {
          const oldFilename = profile.qr_code_url.split('/').pop();
          if (oldFilename) {
            console.log('Deleting old QR code:', oldFilename);
            const { error: deleteError } = await supabase.storage
              .from('qr-codes')
              .remove([oldFilename]);
            
            if (deleteError) {
              console.warn('Failed to delete old QR code:', deleteError);
              // Continue anyway - we'll overwrite the URL
            } else {
              console.log('Old QR code deleted successfully');
            }
          }
        }

        // Upload new QR code
        const { error: uploadError } = await supabase.storage
          .from('qr-codes')
          .upload(filePath, blob, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('qr-codes')
          .getPublicUrl(filePath);

        // Update user profile with QR code URL
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ qr_code_url: publicUrl })
          .eq('id', profileId);

        if (updateError) throw updateError;

        console.log('QR code uploaded and URL saved:', publicUrl);
        resolve(publicUrl);
      } catch (error) {
        console.error('Upload QR code error:', error);
        reject(error);
      }
    }, 'image/png');
  });
}

// Get QR code URL from profile
export async function getQRCodeUrl(profileId: string): Promise<string | null> {
  try {
    console.log('getQRCodeUrl called with profileId:', profileId);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('qr_code_url')
      .eq('id', profileId)
      .single();

    console.log('getQRCodeUrl query result:', { 
      hasData: !!data, 
      qrCodeUrl: data?.qr_code_url || 'null',
      error: error ? error.message : 'none' 
    });

    if (error) throw error;
    return data?.qr_code_url || null;
  } catch (error) {
    console.error('Get QR code URL error:', error);
    return null;
  }
}

// Create or replace QR code - reusable function for both Generate and Recreate
export async function createOrReplaceQRCode(
  profileId: string,
  profileData: {
    firstName: string;
    lastName: string;
    email?: string | null;
    mobileNo?: string | null;
    company?: string | null;
    designation?: string | null;
    city?: string | null;
    linkedinUrl?: string | null;
  },
  generateVCardFn: (data: any) => string,
  canvasElement: HTMLCanvasElement
): Promise<{ success: boolean; qrUrl?: string; error?: string }> {
  try {
    console.log('createOrReplaceQRCode: Starting for profile', profileId);
    
    // Step 1: Generate vCard data from latest profile
    const vCardData = generateVCardFn({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email || undefined,
      mobileNo: profileData.mobileNo || undefined,
      company: profileData.company || undefined,
      designation: profileData.designation || undefined,
      city: profileData.city || undefined,
      linkedinUrl: profileData.linkedinUrl || undefined,
    });
    
    console.log('createOrReplaceQRCode: vCard generated, length:', vCardData.length);
    
    // Step 2: Save vCard data to qr_codes table
    await saveQRCode(profileId, vCardData);
    console.log('createOrReplaceQRCode: vCard saved to database');
    
    // Step 3: Upload QR image to storage (this handles deletion of old QR)
    const qrUrl = await uploadQRCodeImage(profileId, canvasElement);
    console.log('createOrReplaceQRCode: QR image uploaded, URL:', qrUrl);
    
    // Step 4: Update user status to active
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('id', profileId)
      .single();
    
    if (profile?.user_id) {
      await updateUserToActive(profile.user_id);
    }
    
    return { success: true, qrUrl };
  } catch (error: any) {
    console.error('createOrReplaceQRCode error:', error);
    return { success: false, error: error.message || 'Failed to create/replace QR code' };
  }
}

// Delete account
export async function deleteAccount(userId: string, password: string): Promise<boolean> {
  try {
    void userId;
    await apiRequest('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });

    localStorage.removeItem('current_user_id');
    localStorage.removeItem('current_username');
    localStorage.removeItem('connecthub_token');
    localStorage.removeItem('connecthub_session_snapshot');
    
    return true;
  } catch (error: any) {
    console.error('Delete account error:', error);
    throw new Error(error.message || 'Failed to delete account');
  }
}

// Sign out
export async function signOut(): Promise<void> {
  localStorage.removeItem('current_user_id');
  localStorage.removeItem('current_username');
  localStorage.removeItem('connecthub_token');
  localStorage.removeItem('connecthub_session_snapshot');
}

// Notes operations
export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  noteType: 'private' | 'attendee';
  attendeeName?: string;
  eventName?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getUserNotes(userId: string): Promise<Note[]> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(note => ({
      id: note.id,
      userId: note.user_id,
      title: note.title,
      content: note.content,
      noteType: note.note_type,
      attendeeName: note.attendee_name,
      eventName: note.event_name,
      tags: note.tags || [],
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    }));
  } catch (error) {
    console.error('Get notes error:', error);
    return [];
  }
}

export async function createNote(userId: string, noteData: {
  title: string;
  content: string;
  noteType: 'private' | 'attendee';
  attendeeName?: string;
  eventName?: string;
  tags?: string[];
}): Promise<{ success: boolean; noteId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title: noteData.title,
        content: noteData.content,
        note_type: noteData.noteType,
        attendee_name: noteData.attendeeName,
        event_name: noteData.eventName,
        tags: noteData.tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Create note error:', error);
      return { success: false, error: error.message };
    }

    // Update user to active status
    await updateUserToActive(userId);

    return { success: true, noteId: data.id };
  } catch (error: any) {
    console.error('Create note error:', error);
    return { success: false, error: error.message || 'Failed to create note' };
  }
}

export async function updateNote(noteId: string, updates: {
  title?: string;
  content?: string;
  tags?: string[];
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Update note error:', error);
    return false;
  }
}

export async function deleteNote(noteId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Delete note error:', error);
    return false;
  }
}

// Export attendee notes CSV — server builds the file.
export async function exportAttendeeNotesCSV(_userId: string, eventIds?: string[]): Promise<string> {
  const eventId = eventIds?.[0];
  const query = eventId ? `?event_id=${encodeURIComponent(eventId)}` : '';
  const json = await apiRequest(`/api/me/export/notes-csv${query}`);
  return json.csv || 'Name,Company,Designation,Location,Stages,Notes,Note Created At';
}


// Admin: Create new user
export async function createUser(username: string, email: string, password: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const json = await apiRequest('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    return { success: true, userId: json.data.id };
  } catch (error: any) {
    console.error('Create user error:', error);
    return { success: false, error: error.message || 'Failed to create user' };
  }
}

// Admin: Get all users with status and profile info
export async function getAllUsers(): Promise<any[]> {
  try {
    const json = await apiRequest('/api/admin/users');
    return json.data || [];
  } catch (error) {
    console.error('Get all users error:', error);
    return [];
  }
}

// Admin: Soft delete user
export async function deleteUserById(userId: string): Promise<boolean> {
  try {
    await apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('Delete user error:', error);
    return false;
  }
}

// Admin: Get user with profile
export async function getUserWithProfile(userId: string): Promise<any> {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return null;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    return {
      ...user,
      profile: profile || null,
    };
  } catch (error) {
    console.error('Get user with profile error:', error);
    return null;
  }
}

// Admin: Update user username
export async function updateUsername(userId: string, newUsername: string): Promise<boolean> {
  try {
    await apiRequest(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ username: newUsername }),
    });
    return true;
  } catch (error) {
    console.error('Update username error:', error);
    return false;
  }
}

// Admin: Update user email
export async function updateUserEmail(userId: string, newEmail: string): Promise<boolean> {
  try {
    await apiRequest(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ email: newEmail }),
    });
    return true;
  } catch (error) {
    console.error('Update email error:', error);
    return false;
  }
}

// Admin: Change user password
export async function changeUserPasswordByAdmin(userId: string, newPassword: string): Promise<boolean> {
  try {
    await apiRequest(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: newPassword }),
    });
    return true;
  } catch (error) {
    console.error('Change user password error:', error);
    return false;
  }
}

// Update user status on login
export async function updateUserLoginStatus(userId: string, hasProfile: boolean): Promise<void> {
  try {
    const updates: any = {
      last_login_at: new Date().toISOString(),
    };

    // Update status: if no profile yet, set to 'onboarding'
    if (!hasProfile) {
      updates.status = 'onboarding';
    }
    // If has profile, keep current status (could be 'active')

    await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);
  } catch (error) {
    console.error('Update login status error:', error);
  }
}

// Update user status after onboarding (profile completed)
export async function updateUserOnboardingStatus(userId: string): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({ 
        status: 'active', // User completed onboarding, now active
        is_first_login: false
      })
      .eq('id', userId);
  } catch (error) {
    console.error('Update onboarding status error:', error);
  }
}

// Update user to active status (when they make changes)
export async function updateUserToActive(userId: string): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', userId);
  } catch (error) {
    console.error('Update to active status error:', error);
  }
}

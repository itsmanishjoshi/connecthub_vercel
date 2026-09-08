/**
 * User Notes Service - Single Notebook with Pages
 * Each user has ONE notebook with up to 10 pages
 * PRIVATE: Only the user who created notes can see/edit them
 */

import { supabase } from '@/lib/supabaseClient';
import { enqueueSync } from './syncQueue';

export interface NotebookPage {
  id: string;
  user_id: string;
  page_number: number;
  content: string;
  created_at: string;
  updated_at: string;
}

const MAX_PAGES = 10;

/**
 * Get current user ID from localStorage (custom auth)
 * Returns the USER ID (not profile ID) from localStorage
 */
function getCurrentUserId(): string | null {
  return localStorage.getItem('current_user_id');
}

const cacheKey = (userId: string) => `connecthub_notebook_${userId}`;

function readCachedPages(userId: string): NotebookPage[] {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(userId)) || '[]');
  } catch {
    return [];
  }
}

function cachePages(userId: string, pages: NotebookPage[]): void {
  localStorage.setItem(cacheKey(userId), JSON.stringify(pages));
}

function cachePage(userId: string, pageNumber: number, content: string, updatedAt: string): void {
  const pages = readCachedPages(userId);
  const existing = pages.find((page) => page.page_number === pageNumber);
  const page: NotebookPage = {
    id: existing?.id || `${userId}:${pageNumber}`,
    user_id: userId,
    page_number: pageNumber,
    content,
    created_at: existing?.created_at || updatedAt,
    updated_at: updatedAt,
  };
  cachePages(userId, [...pages.filter((item) => item.page_number !== pageNumber), page]);
}

/**
 * Get a specific page from the notebook
 */
export async function getPage(pageNumber: number): Promise<NotebookPage | null> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No user ID found');
      return null;
    }

    const { data, error } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('page_number', pageNumber)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching page:', error);
      return readCachedPages(userId).find((page) => page.page_number === pageNumber) || null;
    }

    if (data) cachePage(userId, pageNumber, data.content, data.updated_at);
    return (data as NotebookPage | null) || readCachedPages(userId).find((page) => page.page_number === pageNumber) || null;
  } catch (error) {
    console.error('Error in getPage:', error);
    const userId = getCurrentUserId();
    return userId ? readCachedPages(userId).find((page) => page.page_number === pageNumber) || null : null;
  }
}

/**
 * Get all pages for the user's notebook
 */
export async function getAllPages(): Promise<NotebookPage[]> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No user ID found');
      return [];
    }

    const { data, error } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', userId)
      .order('page_number', { ascending: true });

    if (error) {
      console.error('Error fetching pages:', error);
      return readCachedPages(userId);
    }

    cachePages(userId, data as NotebookPage[]);
    return data as NotebookPage[];
  } catch (error) {
    console.error('Error in getAllPages:', error);
    const userId = getCurrentUserId();
    return userId ? readCachedPages(userId) : [];
  }
}

/**
 * Save/update a page
 */
export async function savePage(pageNumber: number, content: string): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.error('No user ID found - user must be logged in');
      return false;
    }

    if (pageNumber < 1 || pageNumber > MAX_PAGES) {
      console.error('Invalid page number:', pageNumber);
      return false;
    }

    const existing = readCachedPages(userId).find((page) => page.page_number === pageNumber);
    const updatedAt = new Date().toISOString();
    cachePage(userId, pageNumber, content, updatedAt);
    const { error } = await supabase
      .from('user_notes')
      .upsert({
        user_id: userId,
        page_number: pageNumber,
        content: content,
        updated_at: updatedAt,
        expected_updated_at: existing?.updated_at,
      }, {
        onConflict: 'user_id,page_number'
      });

    if (error?.code === 'CONFLICT') {
      window.dispatchEvent(new CustomEvent('connecthub:sync-conflict', {
        detail: { type: 'notebook', pageNumber },
      }));
      enqueueSync({ type: 'notebook:set', payload: { pageNumber, content, updatedAt } });
      return true;
    }
    if (error) {
      console.error('Error saving page:', error);
      enqueueSync({ type: 'notebook:set', payload: { pageNumber, content, updatedAt } });
      return true;
    }

    return true;
  } catch (error) {
    console.error('Error in savePage:', error);
    const userId = getCurrentUserId();
    if (!userId) return false;
    const updatedAt = new Date().toISOString();
    cachePage(userId, pageNumber, content, updatedAt);
    enqueueSync({ type: 'notebook:set', payload: { pageNumber, content, updatedAt } });
    return true;
  }
}

/**
 * Export selected pages as TXT file
 */
export function exportPages(pages: NotebookPage[], selectedPages: number[]): void {
  if (selectedPages.length === 0) {
    alert('Please select at least one page to export');
    return;
  }

  const pagesToExport = pages
    .filter(p => selectedPages.includes(p.page_number))
    .sort((a, b) => a.page_number - b.page_number);

  if (pagesToExport.length === 0) {
    alert('No content to export');
    return;
  }

  // Build TXT content
  let txtContent = '='.repeat(70) + '\n';
  txtContent += 'MY NOTEBOOK - ConnectHub\n';
  txtContent += '='.repeat(70) + '\n\n';
  txtContent += `Exported: ${new Date().toLocaleString()}\n`;
  txtContent += `Pages: ${selectedPages.join(', ')}\n\n`;
  txtContent += '='.repeat(70) + '\n\n';

  pagesToExport.forEach((page) => {
    txtContent += `PAGE ${page.page_number}\n`;
    txtContent += '-'.repeat(70) + '\n\n';
    txtContent += page.content || '(Empty page)';
    txtContent += '\n\n';
    txtContent += '='.repeat(70) + '\n\n';
  });

  // Create and download file
  const blob = new Blob([txtContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const pageRange = selectedPages.length === MAX_PAGES 
    ? 'All' 
    : `Pages_${selectedPages.join('_')}`;
  link.download = `Notebook_${pageRange}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { MAX_PAGES };

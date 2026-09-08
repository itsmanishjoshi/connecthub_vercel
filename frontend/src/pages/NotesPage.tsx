import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Save } from 'lucide-react';
import { AppRibbonBar, AppRibbonBrand, AppRibbonRow } from '@/components/AppRibbon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import * as userNotesService from '@/services/userNotesService';
import { toast } from 'sonner';

const MAX_PAGES = 10;

export default function NotesPage() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pages, setPages] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedPages, setSavedPages] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    loadAllPages();
  }, []);

  const loadAllPages = async () => {
    setLoading(true);
    const allPages = await userNotesService.getAllPages();
    const pageMap = new Map<number, string>();
    allPages.forEach(page => {
      pageMap.set(page.page_number, page.content);
    });
    setPages(pageMap);
    setSavedPages(new Map(pageMap)); // Track saved state
    setHasUnsavedChanges(false);
    setLoading(false);
  };

  const handleContentChange = (content: string) => {
    const newPages = new Map(pages);
    newPages.set(currentPage, content);
    setPages(newPages);
    
    // Check if content differs from saved version
    const savedContent = savedPages.get(currentPage) || '';
    setHasUnsavedChanges(content !== savedContent);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await userNotesService.savePage(currentPage, pages.get(currentPage) || '');
    setSaving(false);
    if (success) {
      toast.success('Notes saved successfully');
      // Update saved state
      const newSavedPages = new Map(savedPages);
      newSavedPages.set(currentPage, pages.get(currentPage) || '');
      setSavedPages(newSavedPages);
      setHasUnsavedChanges(false);
    } else {
      toast.error('Failed to save notes');
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= MAX_PAGES) {
      setCurrentPage(newPage);
      // Check if new page has unsaved changes
      const currentContent = pages.get(newPage) || '';
      const savedContent = savedPages.get(newPage) || '';
      setHasUnsavedChanges(currentContent !== savedContent);
    }
  };

  const handleExport = async () => {
    const allPages = await userNotesService.getAllPages();
    if (allPages.length === 0) {
      toast.error('No pages to export');
      return;
    }
    // Export only pages with content
    const pagesWithContent = allPages.filter(p => p.content && p.content.trim().length > 0);
    if (pagesWithContent.length === 0) {
      toast.error('No content to export');
      return;
    }
    const pageNumbers = pagesWithContent.map(p => p.page_number);
    userNotesService.exportPages(allPages, pageNumbers);
    toast.success('Notebook exported successfully');
  };

  const currentContent = pages.get(currentPage) || '';
  const existingPages = Array.from(pages.keys()).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-slate-600 dark:text-slate-400">Loading notebook...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="app-page container mx-auto max-w-7xl px-3 py-4 sm:px-4">
        {/* Compact Header */}
        <AppRibbonBar className="-mx-3 mb-4 sm:-mx-4">
          <AppRibbonRow>
            <AppRibbonBrand title="Notebook" leading="back" onLeadingClick={() => navigate('/')} />
          </AppRibbonRow>
        </AppRibbonBar>

        {/* Notebook */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-slate-200 dark:border-gray-700 overflow-hidden">
          {/* Page Navigation - Compact */}
          <div className="bg-slate-50 dark:bg-gray-900/50 px-3 py-3 sm:px-4 border-b border-slate-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pageNum) => {
                const isCurrentPage = currentPage === pageNum;
                const pageContent = pages.get(pageNum);
                const hasContent = pageContent !== undefined && pageContent.trim().length > 0;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-9 h-9 rounded-md text-sm transition-all ${
                      isCurrentPage
                        ? 'bg-transparent text-slate-900 dark:text-white font-semibold underline underline-offset-4 decoration-2'
                        : hasContent
                        ? 'bg-transparent text-white dark:text-white font-bold hover:bg-slate-200/50 dark:hover:bg-gray-700/50'
                        : 'bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-200/50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notebook Page - Full Height */}
          <div className="p-6 bg-gray-100 dark:bg-gray-800">
            <Textarea
              value={currentContent}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder=""
              className="min-h-[calc(100vh-300px)] text-base leading-relaxed border-0 focus-visible:ring-0 resize-none bg-gray-100 dark:bg-gray-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Action Buttons at Bottom */}
          <div className="border-t border-slate-200 dark:border-gray-700 p-4 bg-slate-50 dark:bg-gray-900/50 flex flex-wrap justify-end gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="outline"
              className={`transition-colors ${
                hasUnsavedChanges
                  ? 'bg-green-600 hover:bg-green-700 text-white border-green-600 dark:bg-green-600 dark:hover:bg-green-700 dark:border-green-600'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 dark:border-white'
              }`}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={handleExport}
              disabled={existingPages.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

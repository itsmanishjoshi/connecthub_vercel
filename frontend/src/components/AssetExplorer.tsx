import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Presentation,
  Share2,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  assetContentUrl,
  createAssetFolder,
  deleteAssetFolder,
  deleteAssetItem,
  grantAssetAccess,
  listAssetAccess,
  listAssetContents,
  renameAssetFolder,
  renameAssetItem,
  revokeAssetAccess,
  searchAssetPeople,
  setLibraryRestricted,
  uploadAssetItem,
} from '@/lib/assetApi';

const FOLDER_STYLES: Record<string, { lightTile: string; lightIcon: string; darkTile: string }> = {
  teal: { lightTile: 'bg-teal-100', lightIcon: 'text-teal-700', darkTile: 'dark:bg-teal-500' },
  purple: { lightTile: 'bg-violet-100', lightIcon: 'text-violet-700', darkTile: 'dark:bg-violet-500' },
  magenta: { lightTile: 'bg-fuchsia-100', lightIcon: 'text-fuchsia-700', darkTile: 'dark:bg-fuchsia-500' },
  blue: { lightTile: 'bg-blue-100', lightIcon: 'text-blue-700', darkTile: 'dark:bg-blue-500' },
  green: { lightTile: 'bg-lime-100', lightIcon: 'text-lime-800', darkTile: 'dark:bg-lime-500' },
  yellow: { lightTile: 'bg-amber-100', lightIcon: 'text-amber-800', darkTile: 'dark:bg-amber-400' },
  emerald: { lightTile: 'bg-emerald-100', lightIcon: 'text-emerald-700', darkTile: 'dark:bg-emerald-500' },
  grey: { lightTile: 'bg-slate-200', lightIcon: 'text-slate-700', darkTile: 'dark:bg-slate-500' },
  rose: { lightTile: 'bg-rose-100', lightIcon: 'text-rose-700', darkTile: 'dark:bg-rose-400' },
  red: { lightTile: 'bg-red-100', lightIcon: 'text-red-700', darkTile: 'dark:bg-red-500' },
  orange: { lightTile: 'bg-orange-100', lightIcon: 'text-orange-700', darkTile: 'dark:bg-orange-500' },
  sky: { lightTile: 'bg-sky-100', lightIcon: 'text-sky-700', darkTile: 'dark:bg-sky-400' },
};

function folderStyle(color?: string) {
  return FOLDER_STYLES[color || 'blue'] || FOLDER_STYLES.blue;
}

function formatBytes(value: number) {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function FileGlyph({ kind }: { kind: string }) {
  if (kind === 'pdf' || kind === 'word') return <FileText className="h-5 w-5 text-rose-500" />;
  if (kind === 'excel') return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
  if (kind === 'ppt') return <Presentation className="h-5 w-5 text-orange-500" />;
  if (kind === 'image') return <ImageIcon className="h-5 w-5 text-sky-500" />;
  if (kind === 'video' || kind === 'audio') return <Film className="h-5 w-5 text-indigo-500" />;
  return <FileText className="h-5 w-5 text-slate-400" />;
}

export type AssetTrailCrumb = { id: string | null; name: string };

export function AssetExplorer({
  slug,
  onTrail,
}: {
  slug: string;
  onTrail?: (crumbs: AssetTrailCrumb[]) => void;
}) {
  const [params, setParams] = useSearchParams();
  const folderId = params.get('folder');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [rename, setRename] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareQuery, setShareQuery] = useState('');
  const [people, setPeople] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [restricted, setRestricted] = useState(false);
  const [menu, setMenu] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const trailRef = useRef(onTrail);
  trailRef.current = onTrail;
  const role = data?.library?.role || 'view';
  const canEdit = role === 'edit' || role === 'manage';
  const canManage = role === 'manage';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listAssetContents(slug, folderId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open this folder');
    } finally {
      setLoading(false);
    }
  }, [slug, folderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    trailRef.current?.(data?.breadcrumbs || []);
  }, [data]);

  useEffect(() => () => trailRef.current?.([]), []);

  const goFolder = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('folder', id);
    else next.delete('folder');
    setParams(next);
  };

  const onUpload = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) await uploadAssetItem(slug, file, folderId);
      toast.success(files.length === 1 ? 'Uploaded' : `${files.length} files uploaded`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openShare = async () => {
    setShareOpen(true);
    try {
      const json = await listAssetAccess(slug);
      setGrants(json.grants || []);
      setRestricted(Boolean(json.restricted));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load sharing');
    }
  };

  useEffect(() => {
    if (!shareOpen) return;
    const timer = setTimeout(async () => {
      try {
        setPeople(await searchAssetPeople(shareQuery));
      } catch {
        setPeople([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [shareQuery, shareOpen]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {(data?.breadcrumbs || [{ id: null, name: 'Repository' }]).map((crumb: any, index: number) => (
          <span key={crumb.id || 'root'} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            <button
              type="button"
              className={`hover:text-foreground ${index === (data?.breadcrumbs?.length || 1) - 1 ? 'font-semibold text-foreground' : ''}`}
              onClick={() => goFolder(crumb.id)}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => { setFolderName(''); setNewFolder(true); }}>
              <FolderPlus className="mr-1.5 h-4 w-4" /> New folder
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Upload
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,.mp3,.wav"
              onChange={(event) => {
                if (event.target.files) void onUpload(event.target.files);
                event.target.value = '';
              }}
            />
          </>
        )}
        {canManage && (
          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => void openShare()}>
            <Share2 className="mr-1.5 h-4 w-4" /> Manage access
          </Button>
        )}
      </div>

      <div
        className="min-h-[18rem] overflow-hidden rounded-xl border border-border bg-card"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (canEdit) void onUpload(event.dataTransfer.files);
        }}
      >
        <div className="responsive-table-scroll">
          <div className="min-w-[20rem]">
            <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[1fr_7rem_8rem_2.5rem]">
              <span>Name</span>
              <span className="hidden sm:block">Type</span>
              <span className="hidden sm:block">Size</span>
              <span />
            </div>
            {loading ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Opening folder…</p>
            ) : (
              <ul>
                {(data?.folders || []).map((folder: any) => {
                  const style = folderStyle(folder.color);
                  return (
                  <li key={folder.id} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-border/60 px-3 py-2 hover:bg-muted/50 dark:hover:bg-muted/20 sm:grid-cols-[1fr_7rem_8rem_2.5rem]">
                    <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => goFolder(folder.id)}>
                      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${style.lightTile} ${style.darkTile}`}>
                        <Folder className={`h-4 w-4 ${style.lightIcon} dark:text-white`} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{folder.name}</span>
                        <span className="text-xs text-muted-foreground sm:hidden">Folder</span>
                      </span>
                    </button>
                    <span className="hidden text-xs text-muted-foreground sm:block">Folder</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">—</span>
                    {canEdit ? (
                      <button type="button" className="justify-self-end rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setMenu({ type: 'folder', id: folder.id, name: folder.name })}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    ) : <span />}
                  </li>
                );})}
                {(data?.items || []).map((item: any) => (
                  <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-border/60 px-3 py-2 hover:bg-muted/50 dark:hover:bg-muted/20 sm:grid-cols-[1fr_7rem_8rem_2.5rem]">
                    <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => setPreview(item)}>
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileGlyph kind={item.kind} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                        <span className="text-xs capitalize text-muted-foreground sm:hidden">
                          {item.kind} · {formatBytes(item.size_bytes)}
                        </span>
                      </span>
                    </button>
                    <span className="hidden text-xs capitalize text-muted-foreground sm:block">{item.kind}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">{formatBytes(item.size_bytes)}</span>
                    {canEdit ? (
                      <button type="button" className="justify-self-end rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setMenu({ type: 'file', id: item.id, name: item.name })}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    ) : <span />}
                  </li>
                ))}
                {!data?.folders?.length && !data?.items?.length && (
                  <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                    This folder is empty. {canEdit ? 'Drop PDF, Word, Excel, PowerPoint, photos, or video here.' : ''}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-[min(100vw-2rem,48rem)]">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview?.kind === 'image' && (
            <img src={assetContentUrl(preview.id)} alt={preview.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
          )}
          {preview?.kind === 'video' && (
            <video src={assetContentUrl(preview.id)} controls className="max-h-[70vh] w-full rounded-lg bg-black" />
          )}
          {preview?.kind === 'audio' && <audio src={assetContentUrl(preview.id)} controls className="w-full" />}
          {preview?.kind === 'pdf' && (
            <iframe title={preview.name} src={assetContentUrl(preview.id)} className="h-[70vh] w-full rounded-lg bg-white" />
          )}
          {preview && !['image', 'video', 'audio', 'pdf'].includes(preview.kind) && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {preview.kind === 'ppt' ? 'PowerPoint' : preview.kind === 'word' ? 'Word' : preview.kind === 'excel' ? 'Excel' : 'This file'}
              {' '}opens best in its desktop app. Download it to view or edit.
            </p>
          )}
          <DialogFooter>
            {preview && (
              <Button asChild>
                <a href={assetContentUrl(preview.id, true)}>
                  <Download className="mr-1.5 h-4 w-4" /> Download
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFolder} onOpenChange={setNewFolder}>
        <DialogContent>
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Folder name" />
          <DialogFooter>
            <Button
              onClick={async () => {
                try {
                  await createAssetFolder(slug, folderName, folderId);
                  setNewFolder(false);
                  await load();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not create folder');
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rename)} onOpenChange={(open) => { if (!open) setRename(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <Input value={rename?.name || ''} onChange={(event) => setRename((current) => current ? { ...current, name: event.target.value } : current)} />
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!rename) return;
                try {
                  if (rename.type === 'folder') await renameAssetFolder(rename.id, rename.name);
                  else await renameAssetItem(rename.id, rename.name);
                  setRename(null);
                  await load();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not rename');
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(menu)} onOpenChange={(open) => { if (!open) setMenu(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{menu?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => { if (menu) setRename(menu); setMenu(null); }}>
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </Button>
            {menu?.type === 'file' && (
              <Button variant="outline" asChild>
                <a href={menu ? assetContentUrl(menu.id, true) : '#'}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </a>
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={async () => {
                if (!menu) return;
                try {
                  if (menu.type === 'folder') await deleteAssetFolder(menu.id);
                  else await deleteAssetItem(menu.id);
                  setMenu(null);
                  await load();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not delete');
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage access</DialogTitle></DialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={restricted}
              onChange={async (event) => {
                const next = event.target.checked;
                setRestricted(next);
                try {
                  await setLibraryRestricted(slug, next);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not update');
                }
              }}
            />
            Only people listed below can open this library
          </label>
          <Input value={shareQuery} onChange={(event) => setShareQuery(event.target.value)} placeholder="Search people to invite" />
          <ul className="max-h-32 overflow-auto text-sm">
            {people.map((person) => (
              <li key={person.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 truncate">{person.first_name ? `${person.first_name} ${person.last_name || ''}` : person.username}</span>
                <span className="flex flex-wrap gap-1">
                  {(['view', 'edit', 'manage'] as const).map((grantRole) => (
                    <Button
                      key={grantRole}
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await grantAssetAccess(slug, { userId: person.id, role: grantRole, folderId });
                        toast.success(`Gave ${grantRole} access`);
                        const json = await listAssetAccess(slug);
                        setGrants(json.grants || []);
                      }}
                    >
                      {grantRole}
                    </Button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">People with access</p>
          <ul className="space-y-1 text-sm">
            {grants.map((grant) => (
              <li key={grant.id} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {grant.first_name || grant.username} · {grant.role}
                </span>
                <button type="button" className="text-xs text-rose-600" onClick={async () => { await revokeAssetAccess(grant.id); setGrants((current) => current.filter((row) => row.id !== grant.id)); }}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

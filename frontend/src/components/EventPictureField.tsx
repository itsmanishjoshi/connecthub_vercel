import type { ChangeEvent } from 'react';
import { ImageIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface EventPictureFieldProps {
  inputId: string;
  preview: string | null;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}

export function EventPictureField({ inputId, preview, onPick, onRemove }: EventPictureFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Event picture</Label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onPick}
        className="sr-only"
      />
      {preview ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
            <img src={preview} alt="Event preview" className="h-full w-full object-contain" />
          </div>
          <div className="flex items-center gap-2 p-2">
            <Label
              htmlFor={inputId}
              className="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 px-3 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Replace
            </Label>
            <button
              type="button"
              onClick={onRemove}
              className="h-9 rounded-md px-3 text-sm text-slate-500 hover:text-rose-600"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <Label
          htmlFor={inputId}
          className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-900/60"
        >
          <ImageIcon className="mb-2 h-6 w-6 text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Add event photo</span>
          <span className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP · cropped to 16:9</span>
        </Label>
      )}
    </div>
  );
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title = "Delete Note",
  description = "Are you sure you want to delete this note? This action cannot be undone.",
}: DeleteConfirmDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-popover">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-semibold text-red-900">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            Delete Note
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cloud, Database, Loader2, CheckCircle2, XCircle, Info } from 'lucide-react';

interface MigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMigrate: () => Promise<{ success: boolean; error?: string }>;
  onSkip: () => void;
  stats: {
    notesCount: number;
    statusesCount: number;
    stagesCount: number;
  };
}

export const MigrationDialog = ({
  open,
  onOpenChange,
  onMigrate,
  onSkip,
  stats,
}: MigrationDialogProps) => {
  const [migrating, setMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationError(null);
    
    try {
      const result = await onMigrate();
      
      if (result.success) {
        setMigrationComplete(true);
        // Auto-close after 2 seconds
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } else {
        setMigrationError(result.error || 'Migration failed. Please try again.');
      }
    } catch (error) {
      setMigrationError('An unexpected error occurred during migration.');
      console.error('Migration error:', error);
    } finally {
      setMigrating(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const totalItems = stats.notesCount + stats.statusesCount + stats.stagesCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Sync Your Data to the Cloud
          </DialogTitle>
          <DialogDescription>
            We've detected data stored locally on this device. Migrate it to the cloud to access it from anywhere!
          </DialogDescription>
        </DialogHeader>

        {migrationComplete ? (
          <div className="py-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Migration Complete!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your data is now synced across all your devices
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Benefits */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Benefits of Cloud Sync
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Access your data from any device</li>
                  <li>Never lose your notes and connections</li>
                  <li>Real-time sync across all your devices</li>
                  <li>Secure backup in the cloud</li>
                </ul>
              </div>

              {/* Data Summary */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Data to Migrate:</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.notesCount}</div>
                    <div className="text-xs text-muted-foreground">Notes</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.statusesCount}</div>
                    <div className="text-xs text-muted-foreground">Statuses</div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.stagesCount}</div>
                    <div className="text-xs text-muted-foreground">Stages</div>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {migrationError && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{migrationError}</AlertDescription>
                </Alert>
              )}

              {/* Migration Progress */}
              {migrating && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Migrating {totalItems} items...
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={migrating}
                className="w-full sm:w-auto"
              >
                Skip for Now
              </Button>
              <Button
                onClick={handleMigrate}
                disabled={migrating}
                className="w-full sm:w-auto"
              >
                {migrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Migrate Now
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

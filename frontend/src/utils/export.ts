import { toast } from 'sonner';
import { exportAttendeeNotesCSV } from '@/lib/authService';

function downloadCsv(csvContent: string, filePrefix: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().split('T')[0];

  link.setAttribute('href', url);
  link.setAttribute('download', `${filePrefix}_${date}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download notes CSV built by the Python backend. */
export async function exportMarkedConnections(
  _attendees: unknown[],
  filePrefix = 'Event',
  eventId?: string,
): Promise<void> {
  const userId = localStorage.getItem('current_user_id') || '';
  const csvContent = await exportAttendeeNotesCSV(userId, eventId ? [eventId] : undefined);
  const hasRows = csvContent.split('\n').length > 1;
  if (!hasRows) {
    toast.error('Nothing to export yet.');
    return;
  }
  downloadCsv(csvContent, filePrefix);
}

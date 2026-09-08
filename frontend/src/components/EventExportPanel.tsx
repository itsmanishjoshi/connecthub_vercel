import { useEffect, useState } from 'react';
import { BarChart3, Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchAnalyticsOverview,
  fetchMyEventExportResolved,
  listMyExportEventsResolved,
  downloadTextFile,
  downloadJsonExport,
  previewLines,
  type ExportEventSummary,
  type UserEventExportPayload,
} from '@/services/eventExportService';
import { toast } from 'sonner';

export function EventExportPanel({ compact = false }: { compact?: boolean }) {
  const [events, setEvents] = useState<ExportEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<UserEventExportPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setEvents(await listMyExportEventsResolved());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load your events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openPreview = async (eventId: string) => {
    setPreviewLoading(true);
    try {
      setPreview(await fetchMyEventExportResolved(eventId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not preview export');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your event activity…
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No personal notes, flags, or conversations found yet. This export is separate from the shared attendee list — only your private activity on event cards counts here.
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${compact ? '' : 'rounded-2xl border border-border bg-card p-4 sm:p-6'}`}>
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Export my event data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only your notes, flags, and recorded conversations are included. Shared attendee lists stay unchanged.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {events.map((event) => (
          <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{event.name}</p>
              <p className="text-xs text-muted-foreground">
                {event.notes_count} notes · {event.flags_count} flags · {event.conversations_count} conversations
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void openPreview(event.id)} disabled={previewLoading}>
              Preview
            </Button>
          </div>
        ))}
      </div>

      {preview && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">{preview.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {preview.people.length} people · {preview.conversations.length} conversations
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => downloadTextFile(preview.fileName, preview.markdown)}>
                <Download className="mr-1.5 h-4 w-4" />
                Download .md
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadJsonExport(preview.fileName, preview)}>
                <FileText className="mr-1.5 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {previewLines(preview).map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      )}
    </div>
  );
}

export function AnalyticsWindow() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAnalyticsOverview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAnalyticsOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-medium text-foreground">Analytics unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { label: 'Signed-in users', value: data.totals.users },
    { label: 'Events', value: data.totals.events },
    { label: 'Active users (30d)', value: data.totals.activeUsers30d },
    { label: 'Personal notes', value: data.totals.notes },
    { label: 'Recorded conversations', value: data.totals.conversations },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Usage analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Leadership view of ConnectHub adoption. Personal notes and conversations stay private; this shows aggregate usage only.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold text-foreground">Event engagement</h3>
        <div className="mt-3 responsive-table-scroll">
          <table className="text-sm lg:min-w-full lg:w-full">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 pr-4">Event</th>
                <th className="pb-2 pr-4">Notes</th>
                <th className="pb-2 pr-4">Users noting</th>
                <th className="pb-2 pr-4">Conversations</th>
                <th className="pb-2">Users recording</th>
              </tr>
            </thead>
            <tbody>
              {data.eventEngagement.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-2 pr-4 font-medium text-foreground">{row.name}</td>
                  <td className="py-2 pr-4">{row.notes_count}</td>
                  <td className="py-2 pr-4">{row.users_with_notes}</td>
                  <td className="py-2 pr-4">{row.conversations_count}</td>
                  <td className="py-2">{row.users_with_conversations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold text-foreground">Last 14 days</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.recentActivity.map((row) => (
            <div key={row.day} className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">{new Date(row.day).toLocaleDateString()}</p>
              <p className="text-sm text-foreground">{row.notes} notes · {row.conversations} conversations</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

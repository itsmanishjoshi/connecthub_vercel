import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/SimpleAuthContext';
import { AppRibbonBar, AppRibbonBrand, AppRibbonRow } from '@/components/AppRibbon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Download, Loader2, MessageSquare, Flag, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadAdminUserData,
  fetchAdminUserData,
  type AdminUserDataResponse,
} from '@/services/adminUserDataService';

const STATUS_LABELS: Record<string, string> = {
  high_priority: 'High priority',
  meeting_required: 'Meeting required',
  follow_up_needed: 'Follow-up needed',
  strong_connect: 'Strong connect',
  deal_potential: 'Deal potential',
  watchlist: 'Watchlist',
  grey: 'Neutral',
};

export default function AdminUserDataPage() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<AdminUserDataResponse | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const payload = await fetchAdminUserData(userId);
        if (!cancelled) setData(payload);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Could not load user data');
          const adminFrom = (location.state as { adminFrom?: string } | null)?.adminFrom;
          navigate('/admin', { state: { from: adminFrom || '/settings?tab=users' } });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, userId, navigate, location.state]);

  const handleBack = () => {
    const adminFrom = (location.state as { adminFrom?: string } | null)?.adminFrom;
    navigate('/admin', { state: { from: adminFrom || '/settings?tab=users' } });
  };

  const handleExport = async () => {
    if (!userId) return;
    setExporting(true);
    try {
      await downloadAdminUserData(userId, 'md');
      toast.success('Downloaded user data export');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="app-page min-h-screen bg-background">
      <AppRibbonBar>
        <AppRibbonRow>
          <AppRibbonBrand
            title={data ? data.user.name : 'User data'}
            leading="back"
            onLeadingClick={handleBack}
          />
          <Button
            variant="outline"
            className="h-9 text-sm"
            disabled={exporting || loading || !data?.exports.length}
            onClick={handleExport}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
            ) : (
              <Download className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Export</span>
          </Button>
        </AppRibbonRow>
      </AppRibbonBar>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading user data…
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-muted-foreground text-sm">User not found</div>
        ) : (
          <>
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl">{data.user.name}</CardTitle>
                <CardDescription className="text-sm">
                  @{data.user.username}
                  {data.user.email ? ` · ${data.user.email}` : ''}
                  {data.user.company ? ` · ${data.user.company}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{data.totals.events} events</Badge>
                  <Badge variant="secondary">
                    <FileText className="mr-1 h-3 w-3" />
                    {data.totals.notes} notes
                  </Badge>
                  <Badge variant="secondary">
                    <Flag className="mr-1 h-3 w-3" />
                    {data.totals.flags} flags
                  </Badge>
                  <Badge variant="secondary">
                    <MessageSquare className="mr-1 h-3 w-3" />
                    {data.totals.conversations} conversations
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {!data.exports.length ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No notes, conversations, or priority flags for this user yet.
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-3">
                {data.exports.map((eventExport) => (
                  <AccordionItem
                    key={eventExport.event.id}
                    value={eventExport.event.id}
                    className="rounded-xl border bg-card px-4"
                  >
                    <AccordionTrigger className="py-4 hover:no-underline">
                      <div className="text-left">
                        <p className="font-medium">{eventExport.event.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[eventExport.event.date, eventExport.event.place].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-4">
                      {eventExport.people.length ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            People & notes
                          </p>
                          {eventExport.people.map((person) => (
                            <div
                              key={person.id}
                              className="rounded-lg border bg-muted/30 p-3 space-y-2"
                            >
                              <p className="font-medium text-sm">
                                {person.name}
                                {person.company ? (
                                  <span className="text-muted-foreground"> · {person.company}</span>
                                ) : null}
                              </p>
                              {person.statuses?.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {person.statuses.map((status) => (
                                    <Badge key={status.color} variant="outline" className="text-xs">
                                      {status.label || STATUS_LABELS[status.color] || status.color}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              {person.notes?.length ? (
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  {person.notes.map((note) => (
                                    <li key={note.id} className="border-l-2 border-brand-blue/40 pl-2">
                                      {note.text}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {eventExport.conversations?.length ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Conversations
                          </p>
                          {eventExport.conversations.map((conversation) => (
                            <div
                              key={conversation.id}
                              className="rounded-lg border bg-muted/30 p-3 space-y-2"
                            >
                              <p className="font-medium text-sm">
                                {conversation.title || 'Conversation'}
                                {conversation.companyName ? (
                                  <span className="text-muted-foreground"> · {conversation.companyName}</span>
                                ) : null}
                              </p>
                              {conversation.insights?.find((i) => i.kind === 'summary')?.body ? (
                                <p className="text-sm text-muted-foreground">
                                  {conversation.insights.find((i) => i.kind === 'summary')?.body}
                                </p>
                              ) : null}
                              {conversation.segments?.slice(0, 6).map((segment, index) => (
                                <p key={index} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {segment.speaker_label || 'Speaker'}:
                                  </span>{' '}
                                  {segment.text}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </>
        )}
      </main>
    </div>
  );
}

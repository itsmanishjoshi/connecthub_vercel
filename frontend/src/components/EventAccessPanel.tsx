import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchEventAccess,
  fetchEventAccessCandidates,
  inviteUserToEvent,
  updateEventAccess,
  removeEventAccess,
  memberDisplayName,
  type EventAccessCandidate,
  type EventAccessMember,
  type EventAccessRole,
} from '@/lib/eventAccess';

interface EventAccessPanelProps {
  eventId: string;
  isPrivate?: boolean;
}

export function EventAccessPanel({ eventId, isPrivate }: EventAccessPanelProps) {
  const [members, setMembers] = useState<EventAccessMember[]>([]);
  const [candidates, setCandidates] = useState<EventAccessCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<EventAccessRole>('view');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [memberRows, candidateRows] = await Promise.all([
        fetchEventAccess(eventId),
        fetchEventAccessCandidates(eventId),
      ]);
      setMembers(memberRows);
      setCandidates(candidateRows);
      if (!candidateRows.some((row) => row.id === selectedUserId)) {
        setSelectedUserId('');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not load access');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [eventId]);

  const selectedCandidate = useMemo(
    () => candidates.find((row) => row.id === selectedUserId) || null,
    [candidates, selectedUserId],
  );

  const handleInvite = async () => {
    if (!selectedUserId) {
      toast.error('Select an active user from the list');
      return;
    }
    setSaving(true);
    try {
      await inviteUserToEvent(eventId, selectedUserId, role);
      setSelectedUserId('');
      toast.success(
        role === 'edit'
          ? `${memberDisplayName(selectedCandidate || { username: 'User' })} can now edit people cards`
          : 'Invited as a viewer',
      );
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not invite that person');
    } finally {
      setSaving(false);
    }
  };

  const handleRole = async (member: EventAccessMember, next: EventAccessRole) => {
    try {
      await updateEventAccess(eventId, member.user_id, next);
      toast.success(
        next === 'edit'
          ? `${memberDisplayName(member)} can now edit names, photos, and card details`
          : `${memberDisplayName(member)} is view-only`,
      );
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not update access');
    }
  };

  const handleRemove = async (member: EventAccessMember) => {
    try {
      await removeEventAccess(eventId, member.user_id);
      toast.success(`Removed ${member.username}`);
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not remove access');
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Who can change people cards</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {isPrivate
            ? 'Everyone on this private event sees the same speaker cards. Grant Edit so someone can change names, photos, and details — those updates are visible to everyone. Notes and conversations stay personal.'
            : 'Speaker cards are shared with everyone on the event. Grant Edit only to people who should change names, photos, or details. Notes and conversations stay personal.'}
        </p>
      </div>

      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void handleInvite();
        }}
      >
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="invite-user" className="text-xs text-slate-500 dark:text-slate-400">
            Active user
          </Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger id="invite-user" className="h-10">
              <SelectValue placeholder={loading ? 'Loading users…' : 'Select a user'} />
            </SelectTrigger>
            <SelectContent>
              {candidates.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No active users left to invite
                </SelectItem>
              ) : (
                candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {memberDisplayName(candidate)}
                    {candidate.company ? ` · ${candidate.company}` : ''} ({candidate.username})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role" className="text-xs text-slate-500 dark:text-slate-400">
            Permission
          </Label>
          <Select value={role} onValueChange={(value) => setRole(value as EventAccessRole)}>
            <SelectTrigger id="invite-role" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view">View only</SelectItem>
              <SelectItem value="edit">Can edit cards</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="h-10 w-full sm:w-auto" disabled={saving || !selectedUserId}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          <span className="ml-1.5">Grant access</span>
        </Button>
      </form>

      {loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading people…</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No one has been invited yet.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{memberDisplayName(member)}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{member.username}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {member.is_owner ? (
                  <Badge variant="secondary">Organizer</Badge>
                ) : (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(value) => void handleRole(member, value as EventAccessRole)}
                    >
                      <SelectTrigger className="h-8 w-[6.5rem] text-xs" aria-label={`Access for ${member.username}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">View only</SelectItem>
                        <SelectItem value="edit">Can edit</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void handleRemove(member)}
                      aria-label={`Remove ${member.username}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

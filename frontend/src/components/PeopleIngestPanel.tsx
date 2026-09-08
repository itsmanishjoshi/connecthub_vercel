import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, FileSpreadsheet, FileText, Loader2, Upload, UserPlus } from 'lucide-react';
import {
  PEOPLE_TEMPLATE_CSV,
  commitIngestedPeople,
  extractPeopleFromSources,
  importPhotosFromSpreadsheet,
  type IngestedPerson,
} from '@/lib/peopleIngest';
import { getAvatarUrl } from '@/utils/avatarHelper';

type IngestStage = 'roster' | 'notes' | 'manual';

interface PeopleIngestPanelProps {
  eventId: string;
  onSaved?: () => void;
}

const STAGE_COPY: Record<IngestStage, { title: string; description: string }> = {
  roster: {
    title: 'Stage 1 — Excel roster',
    description: 'Import speaker cards from Excel (.xlsx). Names, titles, companies, LinkedIn URLs, and embedded photos are copied exactly — no AI rewriting.',
  },
  notes: {
    title: 'Stage 2 — Word notes',
    description: 'Upload a Word (.docx) notes document. The app reads talking points and ice breakers, matches each person by name, and attaches notes to their existing card.',
  },
  manual: {
    title: 'Stage 3 — Edit or add member',
    description: 'Open any card to add notes, record a conversation, or mark priority. Use Edit on a card to change details, or paste a single person below.',
  },
};

export function PeopleIngestPanel({ eventId, onSaved }: PeopleIngestPanelProps) {
  const [stage, setStage] = useState<IngestStage>('roster');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [people, setPeople] = useState<IngestedPerson[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<'extract' | 'save' | 'photos' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);

  const stageInfo = STAGE_COPY[stage];
  const fileAccept =
    stage === 'roster'
      ? '.xlsx,.xls,.ods,.csv'
      : stage === 'notes'
        ? '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : '.txt,.csv,.docx,.doc,.pdf';

  const downloadTemplate = () => {
    const blob = new Blob([PEOPLE_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'connecthub-people-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const extract = async () => {
    setBusy('extract');
    setError(null);
    setResult(null);
    try {
      const extracted = await extractPeopleFromSources(eventId, { text, files });
      setPeople(extracted.people);
      setSelected(Object.fromEntries(extracted.people.map((_, index) => [index, true])));
      setWarnings(extracted.warnings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that source');
    } finally {
      setBusy(null);
    }
  };

  const importPhotos = async () => {
    const spreadsheet = files.find((file) => /\.(xlsx|xls|ods)$/i.test(file.name));
    setBusy('photos');
    setError(null);
    setResult(null);
    try {
      const summary = await importPhotosFromSpreadsheet(eventId, spreadsheet);
      const parts = [`imported ${summary.saved} photo${summary.saved === 1 ? '' : 's'}`];
      if (summary.skipped) parts.push(`skipped ${summary.skipped} already stored`);
      if (summary.unmatched?.length) {
        parts.push(`${summary.unmatched.length} could not be matched`);
      }
      setResult(parts.join(' · '));
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import photos');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const chosen = people.filter((_, index) => selected[index]);
    if (!chosen.length) {
      setError('Select at least one person to save.');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      const saved = await commitIngestedPeople(eventId, chosen);
      const parts = [];
      if (saved.added) parts.push(`added ${saved.added} new ${saved.added === 1 ? 'person' : 'people'}`);
      if (saved.updated) parts.push(`updated ${saved.updated} existing ${saved.updated === 1 ? 'person' : 'people'}`);
      if (saved.skipped) parts.push(`skipped ${saved.skipped} already in the event`);
      if (saved.photos?.saved) {
        parts.push(`imported ${saved.photos.saved} photo${saved.photos.saved === 1 ? '' : 's'}`);
      }
      setResult(parts.length ? parts.join(' · ') : 'No changes were made.');
      setPeople([]);
      setFiles([]);
      setText('');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save people');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex flex-wrap gap-2">
        {(['roster', 'notes', 'manual'] as IngestStage[]).map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={stage === key ? 'default' : 'outline'}
            onClick={() => {
              setStage(key);
              setError(null);
              setResult(null);
              setPeople([]);
              setFiles([]);
              setText('');
            }}
          >
            {key === 'roster' ? '1. Excel roster' : key === 'notes' ? '2. Word notes' : '3. Edit / add'}
          </Button>
        ))}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{stageInfo.title}</p>
        <p className="text-xs text-slate-500">{stageInfo.description}</p>
      </div>

      {stage !== 'manual' ? (
        <>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm dark:border-slate-600">
            <Upload className="h-4 w-4 text-slate-400" />
            <span>{files.length ? files.map((file) => file.name).join(', ') : 'Drop or choose a file'}</span>
            <input
              type="file"
              multiple={stage === 'roster'}
              className="sr-only"
              accept={fileAccept}
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
          </label>
          {stage === 'notes' ? (
            <p className="text-xs text-slate-500">
              Names in the Word file must match the Excel roster exactly. Notes are merged onto existing cards — no duplicate people are created.
            </p>
          ) : null}
        </>
      ) : (
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste one person per line (Name, Company, Title) or open a card on the grid to edit details, add notes, or record a conversation."
          className="min-h-[120px] text-sm"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {stage !== 'manual' ? (
          <Button type="button" onClick={extract} disabled={busy !== null || (!text.trim() && !files.length)}>
            {busy === 'extract' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy === 'extract'
              ? 'Reading…'
              : stage === 'roster'
                ? 'Read roster from Excel'
                : 'Read notes from Word'}
          </Button>
        ) : (
          <Button type="button" onClick={extract} disabled={busy !== null || !text.trim()}>
            {busy === 'extract' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {busy === 'extract' ? 'Reading…' : 'Parse pasted people'}
          </Button>
        )}
        {stage === 'roster' ? (
          <>
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              Download CSV template
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={importPhotos}
              disabled={busy !== null}
            >
              {busy === 'photos' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              {busy === 'photos' ? 'Importing photos…' : 'Import photos from Excel'}
            </Button>
          </>
        ) : null}
        {stage === 'notes' ? (
          <span className="flex items-center text-xs text-slate-500">
            <FileText className="mr-1 h-3.5 w-3.5" />
            Word notes attach to matching cards only
          </span>
        ) : null}
      </div>

      {warnings.map((warning) => (
        <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>
      ))}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{result}</AlertDescription>
        </Alert>
      )}
      {people.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {people.length} {people.length === 1 ? 'row' : 'rows'} ready. Uncheck anyone who should not be saved.
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {people.map((person, index) => (
              <label key={`${person.name}-${person.company || ''}-${index}`} className="flex items-start gap-2 rounded-lg bg-white px-2 py-1.5 text-sm dark:bg-slate-800">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(selected[index])}
                  onChange={(event) => setSelected((current) => ({ ...current, [index]: event.target.checked }))}
                />
                {person.profile_pic_url ? (
                  <img src={getAvatarUrl(person.name, person.profile_pic_url) || ''} alt="" className="mt-0.5 h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="mt-0.5 h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                )}
                <span>
                  <span className="font-medium">{person.name}</span>
                  {person.company ? ` · ${person.company}` : ''}
                  {person.designation ? ` · ${person.designation}` : ''}
                  {person.speaker ? ' · Speaker' : ''}
                  {person.already_in_event ? (
                    <span className="mt-0.5 block text-xs text-emerald-700 dark:text-emerald-300">
                      Matches an existing card — saving will attach notes or update roster fields.
                    </span>
                  ) : null}
                  {person.key_insights ? <span className="block text-xs text-slate-500">{person.key_insights}</span> : null}
                  {person.ice_breakers ? <span className="block text-xs text-slate-500">{person.ice_breakers}</span> : null}
                </span>
              </label>
            ))}
          </div>
          <Button type="button" onClick={save} disabled={busy !== null}>
            {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {stage === 'notes' ? 'Attach notes to matching cards' : 'Save selected people'}
          </Button>
        </div>
      )}
    </div>
  );
}

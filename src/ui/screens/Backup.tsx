import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { catalogue } from '../../catalogue/client';
import { openInstalledCatalogue } from '../../catalogue/install';
import { nav } from '../../router/router';
import {
  exportManualBackup,
  inspectAutomaticBackups,
  type BackupHistoryItem,
} from '../../data-safety/backup';
import {
  applyCatalogueMatch,
  commitImport,
  csvDrafts,
  parseCsv,
  parseTitleList,
  suggestCsvMapping,
  type CsvField,
  type CsvMapping,
  type CsvTable,
  type ImportDraft,
} from '../../data-safety/import';
import {
  readBackupFile,
  restoreBackup,
  type PreparedBackup,
  type RestoreMode,
} from '../../data-safety/restore';
import type { Format, ReadingStatus } from '../../db/schema';
import { Illustration } from '../illustration';
import { ChevronLeft, ChevronRight } from '../icons';
import { withInteractionFeedback } from '../interaction-feedback';
import { APP_VERSION, useSettings } from '../store';
import { caption, displayM, displayS, label, resetButton, tabular } from '../styles';

type View = 'home' | 'paste' | 'csv-map' | 'import-preview' | 'restore-preview';

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function Backup() {
  const { settings } = useSettings();
  const [view, setView] = useState<View>('home');
  const [history, setHistory] = useState<BackupHistoryItem[] | null>(null);
  const [paste, setPaste] = useState('');
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [csv, setCsv] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [backup, setBackup] = useState<PreparedBackup | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const restoreInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);

  const refreshHistory = () => {
    void inspectAutomaticBackups()
      .then((result) => {
        setHistory(result.items);
        if (!result.available) {
          setMessage(
            'Automatic snapshots are not available in this browser. Export a copy instead.',
          );
        } else if (result.unreadable) {
          setMessage(
            `${result.unreadable} local ${result.unreadable === 1 ? 'snapshot could' : 'snapshots could'} not be read. Export a fresh copy.`,
          );
        }
      })
      .catch(() => {
        setHistory([]);
        setMessage('Local backup history could not be read. Export a fresh copy.');
      });
  };
  useEffect(refreshHistory, []);
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [view]);

  const fail = (error: unknown, fallback: string) => {
    setMessage(error instanceof Error ? error.message : fallback);
    setBusy(false);
  };

  async function exportNow() {
    setBusy(true);
    setMessage('');
    try {
      const archive = await withInteractionFeedback('Preparing the backup…', () =>
        exportManualBackup(APP_VERSION),
      );
      if (archive) setMessage('The complete backup was exported.');
      setBusy(false);
    } catch (error) {
      fail(error, 'The backup could not be exported. Nothing was changed.');
    }
  }

  async function chooseBackup(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const prepared = await withInteractionFeedback('Reading the backup…', () =>
        readBackupFile(file),
      );
      setBackup(prepared);
      setRestoreMode('merge');
      setView('restore-preview');
      setBusy(false);
    } catch (error) {
      fail(error, 'That backup could not be read. Nothing was changed.');
    }
  }

  async function restore() {
    if (!backup) return;
    setBusy(true);
    setMessage('');
    try {
      await withInteractionFeedback('Restoring the library…', () =>
        restoreBackup(backup, restoreMode, APP_VERSION),
      );
      setMessage('The library was restored in full.');
      setView('home');
      setBackup(null);
      refreshHistory();
      setBusy(false);
    } catch (error) {
      fail(error, 'The restore stopped. Nothing was changed.');
    }
  }

  async function reviewDrafts(next: ImportDraft[]) {
    setBusy(true);
    setMessage('');
    try {
      let reviewed = next;
      if (settings?.corpusVersion) {
        await withInteractionFeedback('Matching titles in the catalogue…', async () => {
          await openInstalledCatalogue(settings.corpusVersion!);
          reviewed = [];
          for (const draft of next) {
            if (draft.title.trim().length < 3) {
              reviewed.push(draft);
              continue;
            }
            const result = await catalogue.search(draft.title, 3);
            const exact = result.matches.find((match) => fold(match.title) === fold(draft.title));
            // Never turn a fuzzy first result into a consequential import
            // choice. Only an exact normalized title becomes a match; every
            // other row remains an explicit manual entry for confirmation.
            reviewed.push(applyCatalogueMatch(draft, exact));
          }
        });
      }
      setDrafts(reviewed);
      setView('import-preview');
      setBusy(false);
    } catch {
      // Catalogue failure is not import failure. Every row remains available as
      // a visible manual entry in the confirmation screen.
      setDrafts(next);
      setView('import-preview');
      setMessage('The catalogue could not be checked. Review the manual entries before importing.');
      setBusy(false);
    }
  }

  async function importSelected() {
    setBusy(true);
    setMessage('');
    try {
      const count = await withInteractionFeedback('Adding the selected titles…', () =>
        commitImport(drafts),
      );
      setMessage(`${count} ${count === 1 ? 'work was' : 'works were'} imported together.`);
      setDrafts([]);
      setPaste('');
      setView('home');
      setBusy(false);
    } catch (error) {
      fail(error, 'The import stopped. Nothing was added.');
    }
  }

  async function chooseCsv(file: File | undefined) {
    if (!file) return;
    try {
      const table = parseCsv(await file.text());
      setCsv(table);
      setMapping(suggestCsvMapping(table.headers));
      setView('csv-map');
      setMessage('');
    } catch (error) {
      fail(error, 'That CSV could not be read. Nothing was changed.');
    }
  }

  return (
    <div
      ref={scroll}
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) 104px',
      }}
    >
      <Header
        title={
          view === 'home'
            ? 'Backup'
            : view === 'paste'
              ? 'Paste a list'
              : view === 'csv-map'
                ? 'Map the columns'
                : view === 'restore-preview'
                  ? 'Restore preview'
                  : 'Import preview'
        }
        onBack={() => (view === 'home' ? nav.reset({ screen: 'home' }) : setView('home'))}
      />

      {message ? (
        <div
          role="status"
          style={{
            ...caption,
            color:
              message.includes('could') || message.includes('stopped')
                ? 'var(--danger-text)'
                : 'var(--text-secondary)',
            padding: '12px 0',
          }}
        >
          {message}
        </div>
      ) : null}

      {view === 'home' ? (
        <HomeView
          history={history}
          lastAutoBackupAt={settings?.lastAutoBackupAt}
          busy={busy}
          onExport={() => void exportNow()}
          onRestore={() => restoreInput.current?.click()}
          onPaste={() => setView('paste')}
          onCsv={() => csvInput.current?.click()}
        />
      ) : null}

      {view === 'paste' ? (
        <PasteView
          value={paste}
          busy={busy}
          onChange={setPaste}
          onReview={() => void reviewDrafts(parseTitleList(paste))}
        />
      ) : null}

      {view === 'csv-map' && csv ? (
        <CsvMapView
          table={csv}
          mapping={mapping}
          onChange={setMapping}
          onReview={() => void reviewDrafts(csvDrafts(csv, mapping))}
        />
      ) : null}

      {view === 'import-preview' ? (
        <ImportPreview
          drafts={drafts}
          busy={busy}
          onChange={setDrafts}
          onImport={() => void importSelected()}
        />
      ) : null}

      {view === 'restore-preview' && backup ? (
        <RestorePreview
          backup={backup}
          mode={restoreMode}
          busy={busy}
          onMode={setRestoreMode}
          onRestore={() => void restore()}
        />
      ) : null}

      <input
        ref={restoreInput}
        hidden
        type="file"
        accept=".zip,.json,application/zip,application/json"
        aria-label="Choose an Ex Libris backup"
        onChange={(event) => {
          void chooseBackup(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={csvInput}
        hidden
        type="file"
        accept=".csv,text/csv"
        aria-label="Choose a CSV file"
        onChange={(event) => {
          void chooseCsv(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 'var(--space-5)' }}>
      <button
        aria-label="Back"
        onClick={onBack}
        style={{
          ...resetButton,
          width: 44,
          height: 44,
          marginLeft: -14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft />
      </button>
      <h1 style={{ ...displayM, flex: 1, margin: 0 }}>{title}</h1>
    </div>
  );
}

function HomeView({
  history,
  lastAutoBackupAt,
  busy,
  onExport,
  onRestore,
  onPaste,
  onCsv,
}: {
  history: BackupHistoryItem[] | null;
  lastAutoBackupAt?: string;
  busy: boolean;
  onExport: () => void;
  onRestore: () => void;
  onPaste: () => void;
  onCsv: () => void;
}) {
  return (
    <>
      {history?.length ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={displayS}>Backed up on this device</div>
          <p style={{ ...caption, color: 'var(--text-secondary)' }}>
            {lastAutoBackupAt
              ? `${dateTime.format(new Date(lastAutoBackupAt))}, automatically. Nothing leaves this device unless you export it.`
              : 'Automatic snapshots stay on this device.'}
          </p>
          <MetaCounts item={history[0]!} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <Illustration name="bibliophile-pana" style={{ width: 170, maxWidth: '55%' }} />
          <div style={displayS}>No backup history yet</div>
          <p style={{ ...caption, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
            Automatic snapshots begin here and stay on this device. An exported copy survives losing
            the phone.
          </p>
        </div>
      )}
      <button disabled={busy} onClick={onExport} style={primaryButton}>
        {busy ? 'Preparing…' : 'Export a copy now'}
      </button>

      <section style={{ marginTop: 'var(--space-6)' }}>
        <div style={{ ...displayS, marginBottom: 'var(--space-1)' }}>History</div>
        {history === null ? (
          <p style={label}>Reading local snapshots…</p>
        ) : history.length ? (
          history.map((item) => <HistoryRow key={item.path} item={item} />)
        ) : (
          <p style={label}>The ten newest automatic snapshots will appear here.</p>
        )}
      </section>

      <section style={{ marginTop: 'var(--space-6)' }}>
        <div style={{ ...displayS, marginBottom: 'var(--space-1)' }}>Bring things in</div>
        <ActionRow
          title="Restore from a backup file"
          note="Preview it, then merge it with this library or replace this library."
          onClick={onRestore}
        />
        <ActionRow
          title="Paste a list of titles"
          note="One per line. Catalogue matches and manual entries are confirmed before saving."
          onClick={onPaste}
        />
        <ActionRow
          title="A CSV, with columns to map"
          note="You say which columns contain the title, author, status, progress and tags."
          onClick={onCsv}
          last
        />
      </section>
    </>
  );
}

function HistoryRow({ item }: { item: BackupHistoryItem }) {
  return (
    <div style={rowStyle}>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span>{dateTime.format(new Date(item.createdAt))}</span>
        <span style={label}>Automatic snapshot</span>
      </span>
      <span style={{ flex: 1 }} />
      <MetaParts
        parts={[countLabel(item.counts.works, 'work'), countLabel(item.counts.notes, 'note')]}
      />
    </div>
  );
}

function MetaCounts({ item }: { item: BackupHistoryItem }) {
  return (
    <MetaParts
      parts={[
        countLabel(item.counts.works, 'work'),
        countLabel(item.counts.notes, 'note'),
        countLabel(item.counts.series, 'series'),
      ]}
    />
  );
}

function MetaParts({ parts }: { parts: string[] }) {
  return (
    <span
      style={{
        ...caption,
        ...tabular,
        color: 'var(--text-secondary)',
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      {parts.map((part, index) => (
        <span
          key={part}
          style={
            index ? { borderLeft: '0.5px solid var(--border-subtle)', paddingLeft: 8 } : undefined
          }
        >
          {part}
        </span>
      ))}
    </span>
  );
}

function ActionRow({
  title,
  note,
  onClick,
  last = false,
}: {
  title: string;
  note: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      data-hover="raised"
      style={{
        ...resetButton,
        ...rowStyle,
        width: '100%',
        textAlign: 'left',
        borderBottom: last ? 'var(--hairline-width) solid var(--hairline)' : undefined,
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 285 }}>
        <span>{title}</span>
        <span style={{ ...caption, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
          {note}
        </span>
      </span>
      <span style={{ flex: 1 }} />
      <ChevronRight />
    </button>
  );
}

function PasteView({
  value,
  busy,
  onChange,
  onReview,
}: {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onReview: () => void;
}) {
  const count = parseTitleList(value).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <p style={{ margin: 0, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
        Put one title on each line. Nothing is added until you review every match.
      </p>
      <textarea
        aria-label="Titles to import"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={'The Left Hand of Darkness\nOmniscient Reader\nPiranesi'}
        style={textareaStyle}
      />
      <div style={{ ...caption, color: 'var(--text-secondary)' }}>
        {count} distinct {count === 1 ? 'title' : 'titles'}
      </div>
      <button
        disabled={!count || busy}
        onClick={onReview}
        style={{ ...primaryButton, opacity: !count || busy ? 0.45 : 1 }}
      >
        {busy ? 'Checking…' : `Review ${count || ''} ${count === 1 ? 'title' : 'titles'}`}
      </button>
    </div>
  );
}

const CSV_FIELDS: { value: CsvField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'status', label: 'Status' },
  { value: 'format', label: 'Format' },
  { value: 'progress', label: 'Progress' },
  { value: 'rating', label: 'Rating' },
  { value: 'tags', label: 'Tags' },
];

function CsvMapView({
  table,
  mapping,
  onChange,
  onReview,
}: {
  table: CsvTable;
  mapping: CsvMapping;
  onChange: (mapping: CsvMapping) => void;
  onReview: () => void;
}) {
  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', textWrap: 'pretty' }}>
        {table.rows.length} rows found. Title is required; every other field may be left unused.
      </p>
      {CSV_FIELDS.map((field) => (
        <label key={field.value} style={rowStyle}>
          <span style={{ flex: 1 }}>{field.label}</span>
          <select
            aria-label={`${field.label} column`}
            value={mapping[field.value] ?? ''}
            onChange={(event) =>
              onChange({
                ...mapping,
                [field.value]: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
            style={selectStyle}
          >
            <option value="">Not used</option>
            {table.headers.map((header, index) => (
              <option key={`${header}-${index}`} value={index}>
                {header || `Column ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div
        style={{
          overflowX: 'auto',
          marginTop: 'var(--space-4)',
          borderBlock: 'var(--hairline-width) solid var(--hairline)',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: 420,
            borderCollapse: 'collapse',
            textAlign: 'left',
            ...caption,
          }}
        >
          <thead>
            <tr>
              {table.headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 500 }}
                >
                  {header || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, 5).map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }}
              >
                {table.headers.map((_, columnIndex) => (
                  <td key={columnIndex} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    {row[columnIndex] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length > 5 ? (
        <p style={{ ...label, color: 'var(--text-secondary)' }}>
          Showing the first 5 of {table.rows.length} rows.
        </p>
      ) : null}
      <button
        disabled={mapping.title === undefined}
        onClick={onReview}
        style={{
          ...primaryButton,
          marginTop: 'var(--space-5)',
          opacity: mapping.title === undefined ? 0.45 : 1,
        }}
      >
        Review mapped rows
      </button>
    </div>
  );
}

function ImportPreview({
  drafts,
  busy,
  onChange,
  onImport,
}: {
  drafts: ImportDraft[];
  busy: boolean;
  onChange: (drafts: ImportDraft[]) => void;
  onImport: () => void;
}) {
  const selected = drafts.filter((draft) => draft.include && draft.title.trim()).length;
  const update = (index: number, patch: Partial<ImportDraft>) =>
    onChange(drafts.map((draft, at) => (at === index ? { ...draft, ...patch } : draft)));
  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', textWrap: 'pretty' }}>
        Matched rows name the catalogue record. Unmatched rows remain explicit manual entries.
        Correct or skip anything before the one batch write.
      </p>
      {drafts.map((draft, index) => (
        <div
          key={draft.sourceIndex}
          style={{
            padding: '14px 0',
            borderTop: 'var(--hairline-width) solid var(--hairline)',
            opacity: draft.include ? 1 : 0.55,
          }}
        >
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={draft.include}
              onChange={(event) => update(index, { include: event.target.checked })}
              aria-label={`Include ${draft.title || `row ${index + 1}`}`}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <input
                aria-label={`Title for row ${index + 1}`}
                value={draft.title}
                onChange={(event) => update(index, { title: event.target.value, match: undefined })}
                style={lineInputStyle}
              />
              <input
                aria-label={`Author for row ${index + 1}`}
                value={draft.author ?? ''}
                placeholder="Author, if known"
                onChange={(event) => update(index, { author: event.target.value || undefined })}
                style={{ ...lineInputStyle, ...caption, color: 'var(--text-secondary)' }}
              />
            </span>
          </label>
          <div style={{ margin: '8px 0' }}>
            <MetaParts
              parts={
                draft.match
                  ? ['Catalogue match', draft.match.source]
                  : ['Manual entry', 'no catalogue record selected']
              }
            />
          </div>
          {draft.progressCurrent !== undefined ||
          draft.rating !== undefined ||
          draft.tags.length ? (
            <div style={{ margin: '8px 0' }}>
              <MetaParts
                parts={[
                  ...(draft.progressCurrent !== undefined
                    ? [
                        draft.progressTotal !== undefined
                          ? `${draft.progressCurrent} of ${draft.progressTotal}`
                          : `${draft.progressCurrent} read`,
                      ]
                    : []),
                  ...(draft.rating !== undefined ? [`${draft.rating} out of 5`] : []),
                  ...(draft.tags.length ? [`Tags: ${draft.tags.join(', ')}`] : []),
                ]}
              />
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              aria-label={`Format for ${draft.title}`}
              value={draft.format}
              onChange={(event) => update(index, { format: event.target.value as Format })}
              style={{ ...selectStyle, flex: 1 }}
            >
              <option value="book">Book</option>
              <option value="novel">Novel</option>
              <option value="manhwa">Manhwa</option>
            </select>
            <select
              aria-label={`Status for ${draft.title}`}
              value={draft.status}
              onChange={(event) => update(index, { status: event.target.value as ReadingStatus })}
              style={{ ...selectStyle, flex: 1 }}
            >
              <option value="wishlist">Wishlist</option>
              <option value="reading">Reading</option>
              <option value="finished">Finished</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>
        </div>
      ))}
      <button
        disabled={!selected || busy}
        onClick={onImport}
        style={{
          ...primaryButton,
          marginTop: 'var(--space-5)',
          opacity: !selected || busy ? 0.45 : 1,
        }}
      >
        {busy ? 'Importing…' : `Import ${selected} ${selected === 1 ? 'work' : 'works'}`}
      </button>
    </div>
  );
}

function RestorePreview({
  backup,
  mode,
  busy,
  onMode,
  onRestore,
}: {
  backup: PreparedBackup;
  mode: RestoreMode;
  busy: boolean;
  onMode: (mode: RestoreMode) => void;
  onRestore: () => void;
}) {
  const counts = backup.data.counts;
  return (
    <div>
      <div style={displayS}>{backup.filename}</div>
      <p style={{ ...caption, color: 'var(--text-secondary)' }}>
        Written {dateTime.format(new Date(backup.data.createdAt))}.{' '}
        {countLabel(counts.works, 'work')}, {countLabel(counts.notes, 'note')},{' '}
        {countLabel(counts.series, 'series')}, {countLabel(counts.universes, 'universe')} and{' '}
        {countLabel(backup.data.userCovers.length, 'user cover')} were validated before this
        preview.
      </p>
      <div
        role="radiogroup"
        aria-label="Restore mode"
        style={{
          display: 'flex',
          border: 'var(--hairline-width) solid var(--hairline-strong)',
          borderRadius: 'var(--radius-button)',
          overflow: 'hidden',
          margin: 'var(--space-5) 0',
        }}
      >
        {(['merge', 'replace'] as const).map((value) => (
          <button
            key={value}
            role="radio"
            aria-checked={mode === value}
            onClick={() => onMode(value)}
            style={{
              ...resetButton,
              flex: 1,
              minHeight: 44,
              background: mode === value ? 'var(--surface-raised)' : 'transparent',
              color: mode === value ? 'var(--text-primary)' : 'var(--text-secondary)',
              textTransform: 'capitalize',
            }}
          >
            {value}
          </button>
        ))}
      </div>
      <p
        style={{
          ...caption,
          color: mode === 'replace' ? 'var(--danger-text)' : 'var(--text-secondary)',
          textWrap: 'pretty',
        }}
      >
        {mode === 'merge'
          ? 'Merge keeps records already on this device and adds or updates records from the backup.'
          : 'Replace first makes a local safety snapshot, then replaces this library in one database transaction.'}
      </p>
      <button disabled={busy} onClick={onRestore} style={primaryButton}>
        {busy ? 'Restoring…' : mode === 'merge' ? 'Merge this backup' : 'Replace this library'}
      </button>
    </div>
  );
}

const fold = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-US').trim();
const countLabel = (count: number, singular: string) =>
  `${count} ${count === 1 ? singular : singular === 'series' ? 'series' : `${singular}s`}`;
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minHeight: 56,
  padding: 'var(--space-2) 0',
  borderTop: 'var(--hairline-width) solid var(--hairline)',
} as const;
const primaryButton = {
  ...resetButton,
  width: '100%',
  minHeight: 48,
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-button)',
  background: 'var(--accent)',
  color: 'var(--on-accent)',
  fontWeight: 500,
} as const;
const textareaStyle = {
  width: '100%',
  minHeight: 240,
  resize: 'vertical',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-card)',
  border: 'var(--hairline-width) solid var(--hairline-strong)',
  background: 'var(--surface-sunken)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--size-body)',
  lineHeight: 'var(--lh-body)',
} as const;
const selectStyle = {
  minHeight: 40,
  maxWidth: 190,
  padding: '0 var(--space-2)',
  borderRadius: 'var(--radius-button)',
  border: 'var(--hairline-width) solid var(--hairline-strong)',
  background: 'var(--surface-sunken)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
} as const;
const lineInputStyle = {
  width: '100%',
  border: 0,
  borderBottom: 'var(--hairline-width) solid var(--hairline)',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: 'var(--size-body)',
  lineHeight: 'var(--lh-body)',
  padding: '2px 0',
} as const;

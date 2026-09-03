import { useState } from 'react';
import { Field, GenreChips, Segmented, Sheet } from './components';
import { caption, displayS, label, resetButton, tabular } from './styles';
import { GENRE_NAMES, GENRES } from '../data/taxonomy';
import {
  PUBLICATION_LABEL,
  STATUS_LABEL,
  STATUS_COLOR,
  displayWork,
  sessionCeiling,
} from '../db/derive';
import * as repo from '../db/repo';
import { useWork } from './store';
import { tick } from './haptics';
import type {
  Format,
  GenreIndex,
  ProgressUnit,
  PublicationStatus,
  ReadingStatus,
} from '../db/schema';

/* ── A1 · the status picker ─────────────────────────────────────────────── */

/**
 * The single most-used edit in a reading tracker, and the design package has no
 * control for it anywhere — its status pill renders and does nothing. Without
 * this, nothing in the library could ever be marked finished, dropped, or
 * caught up.
 *
 * Built from the pill vocabulary the design already uses. `caught_up` appears
 * only when the work is still being published (SCHEMA §1), and the sheet says
 * why rather than silently offering four options instead of five.
 */
export function StatusPicker({ id, onClose }: { id: string; onClose: () => void }) {
  const row = useWork(id);
  if (!row) return null;
  const { work } = row;
  const offered = repo.statusesFor(work.publicationStatus);

  return (
    <Sheet onClose={onClose} title="Where are you with this">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={displayS}>Where are you with this</div>
        <div style={{ ...caption, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
          {offered.includes('caught_up')
            ? 'It is still being published, so you can be caught up with it.'
            : 'It is finished being published, so there is nothing to be caught up with.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {offered.map((s) => {
          const on = work.status === s;
          return (
            <button
              key={s}
              data-hover="raised"
              aria-pressed={on}
              onClick={() => {
                void repo.setStatus(id, s).then(() => {
                  // MOTION.md: a tick on marking something finished, on the
                  // state change and not on the tap. Nowhere else here — a tick
                  // that fires often stops meaning anything.
                  if (s === 'finished') tick();
                  onClose();
                });
              }}
              style={{
                ...resetButton,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                height: 52,
                padding: '0 var(--space-1)',
                borderTop: 'var(--hairline-width) solid var(--hairline)',
              }}
            >
              <span
                style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_COLOR[s] }}
              />
              <span style={{ flex: 1, fontSize: 'var(--size-body)' }}>{STATUS_LABEL[s]}</span>
              {on ? <span style={{ ...caption, color: 'var(--accent-text)' }}>Now</span> : null}
            </button>
          );
        })}
        <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }} />
      </div>

      {work.status === 'dropped' ? <DropReason id={id} /> : null}
    </Sheet>
  );
}

/** Optional, never prompted twice (SCHEMA §1). It appears once the work is
 *  already dropped rather than as a step in dropping it. */
function DropReason({ id }: { id: string }) {
  const row = useWork(id);
  const [text, setText] = useState(row?.work.dropReason ?? '');
  return (
    <Field
      label="Why you stopped, if you want to record it"
      value={text}
      onChange={(v) => {
        setText(v);
        void repo.setDropReason(id, v);
      }}
      placeholder="Optional"
    />
  );
}

/* ── A2, A3, A4 · the edit sheet ────────────────────────────────────────── */

const SHELVES: { value: Format; label: string }[] = [
  { value: 'book', label: 'Books' },
  { value: 'novel', label: 'Novels' },
  { value: 'manhwa', label: 'Manhwa' },
];

const UNITS: { value: ProgressUnit; label: string }[] = [
  { value: 'chapter', label: 'Chapters' },
  { value: 'page', label: 'Pages' },
];

const PUBLICATIONS: PublicationStatus[] = ['ongoing', 'complete', 'hiatus', 'abandoned', 'unknown'];

/**
 * Everything about a work that the design package set once and never let you
 * change: the title, the author, the shelf, the unit it is counted in, where
 * you are, and how long it is.
 *
 * One sheet rather than six separate controls, because these are all the same
 * question — "what is this thing" — and a reader correcting a hand-typed entry
 * usually has more than one of them wrong.
 */
export function EditWork({ id, onClose }: { id: string; onClose: () => void }) {
  const row = useWork(id);
  const [draft, setDraft] = useState<{
    title: string;
    author: string;
    format: Format;
    unit: ProgressUnit;
    current: string;
    total: string;
    publication: PublicationStatus;
  } | null>(null);

  if (!row) return null;
  const { work } = row;

  const d = draft ?? {
    title: work.title,
    author: row.authorName ?? '',
    format: work.format,
    unit: work.progressUnit === 'percent' ? 'chapter' : work.progressUnit,
    current: String(work.progressCurrent),
    total: work.progressTotal === undefined ? '' : String(work.progressTotal),
    publication: work.publicationStatus,
  };
  const set = (patch: Partial<typeof d>) => setDraft({ ...d, ...patch });

  const digits = (s: string) => s.replace(/[^\d]/g, '');
  const titleOk = d.title.trim().length > 0;

  const save = async () => {
    // Each of these is a separate write because each one has a rule attached —
    // retitling rebuilds the sort key, changing the shelf must NOT touch the
    // unit. Batching them into one update would put those rules at the call
    // site, which is where they get forgotten.
    if (d.title.trim() !== work.title) await repo.setTitle(id, d.title);
    if (d.author.trim() !== (row.authorName ?? '')) await repo.setAuthor(id, d.author);
    if (d.format !== work.format) await repo.setFormat(id, d.format);
    if (d.unit !== work.progressUnit) await repo.setProgressUnit(id, d.unit);
    if (d.publication !== work.publicationStatus)
      await repo.setPublicationStatus(id, d.publication);

    const current = Number(digits(d.current) || '0');
    if (current !== work.progressCurrent) await repo.setProgressCurrent(id, current);

    const totalText = digits(d.total);
    const total = totalText === '' ? undefined : Number(totalText);
    if (total !== work.progressTotal) await repo.setProgressTotal(id, total);

    onClose();
  };

  return (
    <Sheet onClose={onClose} title="Edit this work">
      <div style={displayS}>Edit this work</div>

      <Field label="Title" value={d.title} onChange={(v) => set({ title: v })} display />
      <Field
        label="Author or translator"
        value={d.author}
        onChange={(v) => set({ author: v })}
        placeholder="Leave empty if you do not know"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={label}>Shelf</span>
        <Segmented
          ariaLabel="Shelf"
          options={SHELVES}
          value={d.format}
          onChange={(v) => set({ format: v })}
        />
        {/* Says out loud that the shelf and the unit are separate, because the
            schema is explicit that format is never auto-corrected and a reader
            would reasonably expect moving a book to Novels to switch it to
            chapters. */}
        <span style={label}>
          Decided by how you read it, not by what it technically is. It does not change the unit
          below.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={label}>Counted in</span>
        <Segmented
          ariaLabel="Counted in"
          options={UNITS}
          value={d.unit}
          onChange={(v) => set({ unit: v })}
        />
      </div>

      {/* minWidth: 0 on both. A flex item's default min-width is auto, which is
          its CONTENT width — so an input with a wide placeholder refuses to
          shrink and pushes the second column past the sheet's right edge. */}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field
            label="You are on"
            value={d.current}
            onChange={(v) => set({ current: digits(v) })}
            inputMode="numeric"
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field
            label={d.publication === 'ongoing' ? 'Released so far' : 'Out of'}
            value={d.total}
            onChange={(v) => set({ total: digits(v) })}
            inputMode="numeric"
            placeholder="Unknown"
            // The absence is a real state, not a gap to be filled. For a web
            // novel it is the common case, and inventing a denominator is the
            // one thing SCHEMA is most insistent about.
            note={
              d.total === '' ? 'Leave it empty and there is no bar and no percentage.' : undefined
            }
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={label}>Publication</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PUBLICATIONS.map((p) => {
            const on = d.publication === p;
            return (
              <button
                key={p}
                aria-pressed={on}
                onClick={() => set({ publication: p })}
                style={{
                  ...resetButton,
                  ...caption,
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: `var(--hairline-width) solid ${on ? 'var(--accent)' : 'var(--hairline)'}`,
                  background: on ? 'var(--accent-deep)' : 'transparent',
                  color: on ? 'var(--accent-text)' : 'var(--text-primary)',
                }}
              >
                {PUBLICATION_LABEL[p]}
              </button>
            );
          })}
        </div>
        {/* Changing this changes which statuses are offered, so it is worth
            saying before rather than after. */}
        {d.publication !== 'ongoing' &&
        d.publication !== 'hiatus' &&
        work.status === 'caught_up' ? (
          <span style={{ ...label, color: 'var(--danger-text)' }}>
            This work is currently Caught up. Saving will need a different status, because nothing
            that has finished publishing can be caught up with.
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: 'var(--space-1)' }}>
        <button
          onClick={onClose}
          style={{
            ...resetButton,
            flex: 'none',
            width: 96,
            height: 48,
            lineHeight: '48px',
            textAlign: 'center',
            borderRadius: 'var(--radius-button)',
            border: 'var(--hairline-width) solid var(--hairline-strong)',
            fontSize: 'var(--size-body)',
            color: 'var(--text-secondary)',
          }}
        >
          Cancel
        </button>
        <button
          data-ripple
          data-active="accent"
          disabled={!titleOk}
          onClick={() => void save()}
          style={{
            ...resetButton,
            flex: 1,
            height: 48,
            lineHeight: '48px',
            textAlign: 'center',
            borderRadius: 'var(--radius-button)',
            background: titleOk ? 'var(--accent)' : 'var(--surface-raised)',
            color: titleOk ? 'var(--on-accent)' : 'var(--text-faint)',
            cursor: titleOk ? 'pointer' : 'default',
            fontSize: 'var(--size-body)',
            fontWeight: 500,
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}

/* ── The reading session ────────────────────────────────────────────────── */

/**
 * Asks where you got to, never how much you read — nobody knows the second one
 * (D-086). It floors at the current position, so a session can never record
 * going backwards; correcting a position is the edit sheet's job.
 */
export function SessionSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const row = useWork(id);
  const [to, setTo] = useState<number | null>(null);

  if (!row) return null;
  const { work } = row;
  const from = work.progressCurrent;
  const ceiling = sessionCeiling(work);
  const at = to ?? from;
  const delta = Math.max(0, at - from);
  const unit = work.progressUnit === 'page' ? 'page' : 'chapter';
  const n = (v: number) => v.toLocaleString('en-US');

  const move = (by: number) =>
    setTo((prev) => Math.max(from, Math.min(ceiling, (prev ?? from) + by)));

  const willFinish =
    work.publicationStatus !== 'ongoing' &&
    work.progressTotal !== undefined &&
    at >= work.progressTotal;

  const sub =
    work.progressTotal === undefined
      ? `You were on ${unit} ${n(from)}`
      : work.publicationStatus === 'ongoing'
        ? `You were on ${unit} ${n(from)} — ${n(work.progressTotal)} published`
        : `You were on ${unit} ${n(from)} of ${n(work.progressTotal)}`;

  return (
    <Sheet onClose={onClose} title="Where did you get to?">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={displayS}>Where did you get to?</div>
        <div style={{ ...caption, color: 'var(--text-secondary)' }}>{sub}</div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-5)',
        }}
      >
        <Stepper
          label={`Back one ${unit}`}
          sign="−"
          disabled={at <= from}
          onClick={() => move(-1)}
        />
        <div style={{ textAlign: 'center', minWidth: 96 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--display-vf)' as unknown as number,
              fontSize: 'var(--size-display-l)',
              lineHeight: 'var(--lh-display-l)',
              ...tabular,
            }}
          >
            {n(at)}
          </div>
          <div style={label}>{unit}</div>
        </div>
        <Stepper
          label={`Forward one ${unit}`}
          sign="+"
          disabled={at >= ceiling}
          onClick={() => move(1)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)' }}>
        {[1, 5, 10].map((k) => (
          <button
            key={k}
            onClick={() => move(k)}
            style={{
              ...resetButton,
              ...caption,
              padding: '7px 14px',
              borderRadius: 'var(--radius-pill)',
              border: 'var(--hairline-width) solid var(--hairline-strong)',
              color: 'var(--text-secondary)',
              ...tabular,
            }}
          >
            +{k}
          </button>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            ...caption,
            color: delta ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          {delta === 0
            ? 'Nothing logged yet'
            : `${n(delta)} ${unit}${delta === 1 ? '' : 's'} this session`}
        </div>
      </div>

      <button
        data-ripple
        data-active="accent"
        disabled={delta === 0}
        onClick={() => {
          void repo.logSession(id, at).then(({ finished }) => {
            if (finished) tick();
            onClose();
          });
        }}
        style={{
          ...resetButton,
          width: '100%',
          height: 48,
          lineHeight: '48px',
          textAlign: 'center',
          borderRadius: 'var(--radius-button)',
          background: delta ? 'var(--accent)' : 'var(--surface-raised)',
          color: delta ? 'var(--on-accent)' : 'var(--text-faint)',
          cursor: delta ? 'pointer' : 'default',
          fontSize: 'var(--size-body)',
          fontWeight: 500,
        }}
      >
        {delta === 0 ? 'Log a session' : willFinish ? 'Finish it' : 'Log it'}
      </button>
    </Sheet>
  );
}

function Stepper({
  label: text,
  sign,
  disabled,
  onClick,
}: {
  label: string;
  sign: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={text}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...resetButton,
        width: 52,
        height: 52,
        borderRadius: 'var(--radius-pill)',
        border: 'var(--hairline-width) solid var(--hairline-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--size-body-l)',
        color: disabled ? 'var(--text-faint)' : 'var(--text-primary)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {sign}
    </button>
  );
}

/* ── The genre editor ───────────────────────────────────────────────────── */

/**
 * Ordered, not a flat multi-select: the taxonomy makes primary-versus-second a
 * real distinction and the chips render it. A third tap is REFUSED rather than
 * silently evicting one of the two already chosen (D-106).
 */
export function GenreEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const row = useWork(id);
  const [picked, setPicked] = useState<GenreIndex[] | null>(null);

  if (!row) return null;
  const sel = picked ?? row.work.genres;
  const full = sel.length >= 2;

  const note =
    sel.length === 0
      ? 'Pick one, or two at most. The first is the primary genre.'
      : sel.length === 1
        ? 'Primary set. You can add one more.'
        : 'Two is the limit. Remove one to swap it out.';

  return (
    <Sheet onClose={onClose} title="Genre">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={displayS}>{sel.length > 1 ? 'Genres' : 'Genre'}</div>
        <div style={{ ...caption, color: 'var(--text-secondary)' }}>{note}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {GENRES.map((g) => {
          const at = sel.indexOf(g.colorIndex);
          const on = at >= 0;
          const locked = !on && full;
          return (
            <button
              key={g.colorIndex}
              aria-pressed={on}
              disabled={locked}
              onClick={() => {
                if (locked) return;
                tick();
                setPicked(on ? sel.filter((x) => x !== g.colorIndex) : [...sel, g.colorIndex]);
              }}
              style={{
                ...resetButton,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                ...caption,
                padding: '6px 12px',
                borderRadius: 'var(--radius-chip)',
                fontWeight: at === 0 && sel.length > 1 ? 500 : 400,
                opacity: locked ? 0.35 : 1,
                cursor: locked ? 'default' : 'pointer',
                background: on
                  ? `color-mix(in oklab, var(--genre-${g.colorIndex}) calc(var(--genre-fill-alpha) * ${at === 0 ? '170' : '100'}%), transparent)`
                  : 'transparent',
                border: `var(--hairline-width) solid ${
                  on
                    ? `color-mix(in oklab, var(--genre-${g.colorIndex}) calc(var(--genre-border-alpha) * ${at === 0 ? '130' : '60'}%), transparent)`
                    : 'var(--hairline)'
                }`,
                color: on
                  ? `color-mix(in oklab, var(--genre-${g.colorIndex}), var(--genre-ink) var(--genre-ink-amt))`
                  : 'var(--text-primary)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 11,
                  borderRadius: 1,
                  background: `var(--genre-${g.colorIndex})`,
                }}
              />
              {g.name}
            </button>
          );
        })}
      </div>

      {sel.length === 2 ? (
        <button
          onClick={() => setPicked([sel[1]!, sel[0]!])}
          style={{ ...resetButton, ...caption, color: 'var(--accent-text)', textAlign: 'left' }}
        >
          Make {GENRE_NAMES[sel[1]!]} primary
        </button>
      ) : null}

      <button
        data-active="accent"
        onClick={() => {
          void repo.setGenres(id, sel).then(onClose);
        }}
        style={{
          ...resetButton,
          width: '100%',
          height: 48,
          lineHeight: '48px',
          textAlign: 'center',
          borderRadius: 'var(--radius-button)',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          fontSize: 'var(--size-body)',
          fontWeight: 500,
        }}
      >
        Done
      </button>
    </Sheet>
  );
}

/* ── Add by hand ────────────────────────────────────────────────────────── */

/** "For what the catalogue has never heard of. A title is enough; the rest can
 *  wait." Copy and shape both from design/Ex Libris.dc.html. */
export function ByHandSheet({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [format, setFormat] = useState<Format>('novel');
  const [unit, setUnit] = useState<ProgressUnit>('chapter');
  const [status, setStatus] = useState<ReadingStatus>('reading');
  const ok = title.trim().length > 0;

  return (
    <Sheet onClose={onClose} title="Add by hand">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={displayS}>Add by hand</div>
        <div style={{ ...caption, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
          For what the catalogue has never heard of. A title is enough; the rest can wait.
        </div>
      </div>

      <Field
        label="Title"
        value={title}
        onChange={setTitle}
        placeholder="What is it called"
        display
      />
      <Field
        label="Author or translator"
        value={author}
        onChange={setAuthor}
        placeholder="Leave empty if you do not know"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={label}>Shelf</span>
        <Segmented ariaLabel="Shelf" options={SHELVES} value={format} onChange={setFormat} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={label}>Counted in</span>
        <Segmented ariaLabel="Counted in" options={UNITS} value={unit} onChange={setUnit} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={label}>Where it goes</span>
        <Segmented
          ariaLabel="Where it goes"
          options={[
            { value: 'wishlist' as ReadingStatus, label: 'Wishlist' },
            { value: 'reading' as ReadingStatus, label: 'Reading' },
            { value: 'finished' as ReadingStatus, label: 'Finished' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: 'var(--space-1)' }}>
        <button
          onClick={onClose}
          style={{
            ...resetButton,
            flex: 'none',
            width: 96,
            height: 48,
            lineHeight: '48px',
            textAlign: 'center',
            borderRadius: 'var(--radius-button)',
            border: 'var(--hairline-width) solid var(--hairline-strong)',
            fontSize: 'var(--size-body)',
            color: 'var(--text-secondary)',
          }}
        >
          Cancel
        </button>
        <button
          data-ripple
          data-active="accent"
          disabled={!ok}
          onClick={() => {
            void repo
              .createWork({
                title,
                authorName: author,
                format,
                status,
                progressUnit: unit,
                publicationStatus: 'unknown',
              })
              .then((w) => onAdded(w.id));
          }}
          style={{
            ...resetButton,
            flex: 1,
            height: 48,
            lineHeight: '48px',
            textAlign: 'center',
            borderRadius: 'var(--radius-button)',
            background: ok ? 'var(--accent)' : 'var(--surface-raised)',
            color: ok ? 'var(--on-accent)' : 'var(--text-faint)',
            cursor: ok ? 'pointer' : 'default',
            fontSize: 'var(--size-body)',
            fontWeight: 500,
          }}
        >
          Put it on the shelf
        </button>
      </div>
    </Sheet>
  );
}

export { displayWork, GenreChips };

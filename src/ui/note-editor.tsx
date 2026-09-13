import { useEffect, useMemo, useState } from 'react';
import { ALL_TAGS, TAG_GROUPS, visibleTags } from '../data/taxonomy';
import * as repo from '../db/repo';
import { nav } from '../router/router';
import { Cover, Sheet, TagPill } from './components';
import { tick } from './haptics';
import { ChevronLeft, Search, TrashIcon } from './icons';
import { withInteractionFeedback } from './interaction-feedback';
import { Illustration } from './illustration';
import { SearchField } from './search-field';
import { useAvailableTags, useLibrary, useNote, useSettings, type WorkWithAuthor } from './store';
import { caption, displayM, label, resetButton } from './styles';

const fold = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-US');

export function NoteEditor({
  id,
  tagPickerOpen = false,
}: {
  id?: string;
  tagPickerOpen?: boolean;
}) {
  const existing = useNote(id);
  const library = useLibrary();
  const savedTags = useAvailableTags();
  const { settings } = useSettings();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [workIds, setWorkIds] = useState<string[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachQuery, setAttachQuery] = useState('');
  const [readyId, setReadyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canSave = (title.trim().length > 0 || body.trim().length > 0) && !saving;

  useEffect(() => {
    if (!id || !existing || readyId === id) return;
    setTitle(existing.note.title ?? '');
    setBody(existing.note.body);
    setPinned(existing.note.pinned);
    setWorkIds(existing.works.map((work) => work.id));
    setTagNames(existing.tags.map((tag) => tag.name));
    setReadyId(id);
  }, [existing, id, readyId]);

  if (id && existing === undefined) return null;
  if (id && existing === null) {
    return (
      <Sheet onClose={() => nav.close()} title="Note">
        <div role="alert" style={{ ...caption, color: 'var(--danger-text)' }}>
          That note is no longer available.
        </div>
      </Sheet>
    );
  }

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await withInteractionFeedback('Saving the note…', () =>
        id
          ? repo.updateNote(id, { title, body, pinned, tagNames, workIds })
          : repo.createNote({ title, body, pinned, tagNames, workIds }),
      );
      nav.close();
    } catch {
      setError('The note could not be saved. Your words and choices are still here; try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return nav.close();
    setSaving(true);
    setError('');
    try {
      await withInteractionFeedback('Moving the note to Trash…', () => repo.softDeleteNote(id));
      nav.close();
    } catch {
      setError('The note could not be moved to Trash. Nothing was deleted.');
      setSaving(false);
    }
  };

  return (
    <Sheet
      onClose={() => nav.close()}
      title={tagPickerOpen ? 'Note tags' : id ? 'Edit note' : 'New note'}
      maxHeight="94%"
      transitionName="add-surface"
    >
      {tagPickerOpen ? (
        <TagPicker
          selected={tagNames}
          savedNames={savedTags?.map((tag) => tag.name) ?? []}
          contentWarningsOn={settings?.contentWarningsOn ?? false}
          onChange={setTagNames}
          onDone={() => nav.close()}
        />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              onClick={() => nav.close()}
              style={{ ...resetButton, ...caption, color: 'var(--text-secondary)', padding: 10 }}
            >
              Cancel
            </button>
            <span style={{ flex: 1 }} />
            <button
              aria-label={id ? 'Delete this note' : 'Discard this note'}
              disabled={saving}
              onClick={() => void remove()}
              style={{
                ...resetButton,
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <TrashIcon color="currentColor" />
            </button>
            <button
              disabled={!canSave}
              onClick={() => canSave && void save()}
              style={{
                ...resetButton,
                color: canSave ? 'var(--accent-text)' : 'var(--text-faint)',
                fontSize: 'var(--size-body)',
                lineHeight: 'var(--lh-body)',
                fontWeight: 500,
                padding: 10,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title, if it needs one"
            aria-label="Note title"
            style={{
              width: '100%',
              minHeight: 40,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--display-vf-sm)' as unknown as number,
              fontSize: 'var(--size-display-s)',
              lineHeight: 'var(--lh-display-s)',
              outline: 'none',
            }}
          />
          <div style={{ position: 'relative', minHeight: 150 }}>
            {!body ? (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  opacity: 0.16,
                }}
              >
                <Illustration name="studying-bro" style={{ width: 180 }} />
              </div>
            ) : null}
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write it however you think it."
              aria-label="Note body"
              style={{
                position: 'relative',
                width: '100%',
                minHeight: 150,
                background: 'transparent',
                border: 'none',
                resize: 'vertical',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--size-body)',
                lineHeight: 'var(--lh-body)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }}>
            <button
              aria-expanded={attachOpen}
              onClick={() => setAttachOpen((open) => !open)}
              style={{
                ...resetButton,
                width: '100%',
                height: 52,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <span>Attach to a work</span>
              <span style={{ flex: 1 }} />
              <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                {workIds.length === 0 ? 'none yet' : `${workIds.length} attached`}
              </span>
              <Chevron expanded={attachOpen} />
            </button>
            {attachOpen ? (
              <AttachPicker
                rows={library ?? []}
                query={attachQuery}
                selected={workIds}
                onQuery={setAttachQuery}
                onToggle={(workId) =>
                  setWorkIds((ids) =>
                    ids.includes(workId)
                      ? ids.filter((value) => value !== workId)
                      : [...ids, workId],
                  )
                }
              />
            ) : null}
          </div>

          <button
            onClick={() => nav.open({ kind: 'noteTags' })}
            style={{
              ...resetButton,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '14px 0',
              borderTop: 'var(--hairline-width) solid var(--hairline)',
            }}
          >
            <span style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Tags</span>
              <span style={{ flex: 1 }} />
              <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                {tagNames.length === 0
                  ? 'No tags yet'
                  : `${tagNames.length} tag${tagNames.length === 1 ? '' : 's'}`}
              </span>
              <span aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
                <Chevron expanded />
              </span>
            </span>
            {tagNames.length ? (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {tagNames.map((name) => (
                  <TagPill key={fold(name)} name={name} />
                ))}
              </span>
            ) : null}
          </button>

          <button
            role="switch"
            aria-checked={pinned}
            aria-label="Keep it at the top"
            onClick={() => {
              tick();
              setPinned((value) => !value);
            }}
            style={{
              ...resetButton,
              width: '100%',
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              borderTop: 'var(--hairline-width) solid var(--hairline)',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span>Keep it at the top</span>
              <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                Pinned notes lead the feed.
              </span>
            </span>
            <span style={{ flex: 1 }} />
            <SwitchTrack on={pinned} />
          </button>
          {error ? (
            <div role="alert" style={{ ...caption, color: 'var(--danger-text)' }}>
              {error}
            </div>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

function AttachPicker({
  rows,
  query,
  selected,
  onQuery,
  onToggle,
}: {
  rows: WorkWithAuthor[];
  query: string;
  selected: string[];
  onQuery: (value: string) => void;
  onToggle: (id: string) => void;
}) {
  const needle = fold(query.trim());
  const matches = rows
    .filter(({ work, authorName }) => fold(`${work.title} ${authorName ?? ''}`).includes(needle))
    .slice(0, 3);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 16 }}>
      <SearchField value={query} onChange={onQuery} placeholder="Search your library" />
      {matches.map(({ work, authorName }) => {
        const attached = selected.includes(work.id);
        return (
          <div
            key={work.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: '10px 0',
              borderBottom: 'var(--hairline-width) solid var(--hairline)',
            }}
          >
            <Cover
              width={24}
              height={36}
              color={work.coverDominantColor ?? 'var(--cover-fallback)'}
              path={work.coverPath}
            />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ overflowWrap: 'anywhere' }}>{work.title}</span>
              {authorName ? (
                <span style={{ ...caption, color: 'var(--text-secondary)' }}>{authorName}</span>
              ) : null}
            </span>
            <span style={{ flex: 1 }} />
            <button
              aria-pressed={attached}
              aria-label={`${attached ? 'Detach' : 'Attach'} ${work.title}`}
              onClick={() => onToggle(work.id)}
              style={{
                ...resetButton,
                height: 30,
                padding: '0 12px',
                borderRadius: 'var(--radius-pill)',
                border: `var(--hairline-width) solid ${attached ? 'var(--accent)' : 'var(--hairline-strong)'}`,
                color: attached ? 'var(--accent-text)' : 'var(--text-secondary)',
                ...caption,
                flex: 'none',
              }}
            >
              {attached ? 'Attached' : 'Attach'}
            </button>
          </div>
        );
      })}
      {matches.length === 0 ? (
        <div style={{ ...caption, color: 'var(--text-secondary)', padding: '12px 0' }}>
          Nothing in your library matches. A note does not have to be attached to anything.
        </div>
      ) : null}
    </div>
  );
}

function TagPicker({
  selected,
  savedNames,
  contentWarningsOn,
  onChange,
  onDone,
}: {
  selected: string[];
  savedNames: string[];
  contentWarningsOn: boolean;
  onChange: (names: string[]) => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const all = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const name of [...selected, ...savedNames, ...ALL_TAGS]) byKey.set(fold(name), name);
    return visibleTags([...byKey.values()], contentWarningsOn);
  }, [contentWarningsOn, savedNames, selected]);
  const needle = fold(query.trim());
  const results = needle ? all.filter((name) => fold(name).includes(needle)) : [];
  const exact = all.some((name) => fold(name) === needle);
  const toggle = (name: string) =>
    onChange(
      selected.some((value) => fold(value) === fold(name))
        ? selected.filter((value) => fold(value) !== fold(name))
        : [...selected, name],
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'min(78vh, 620px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          aria-label="Back to note"
          onClick={onDone}
          style={{
            ...resetButton,
            width: 44,
            height: 44,
            marginLeft: -10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft />
        </button>
        <h2 style={{ ...displayM, flex: 1, margin: 0 }}>Tags</h2>
        <button
          disabled={!query.trim() || exact}
          onClick={() => {
            if (!query.trim() || exact) return;
            toggle(query.trim());
            setQuery('');
          }}
          style={{
            ...resetButton,
            minHeight: 34,
            padding: '0 12px',
            borderRadius: 'var(--radius-pill)',
            border: 'var(--hairline-width) dashed var(--hairline-strong)',
            ...caption,
            color: !query.trim() || exact ? 'var(--text-faint)' : 'var(--accent-text)',
          }}
        >
          New tag
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          minHeight: 44,
          padding: '0 14px',
          background: 'var(--surface-sunken)',
          border: 'var(--hairline-width) solid var(--hairline-strong)',
          borderRadius: 'var(--radius-pill)',
        }}
      >
        <Search />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search tags"
          placeholder={`Search ${all.length} tags`}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            fontSize: 'var(--size-body)',
          }}
        />
      </div>
      <div className="exl-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {selected.length ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '16px 0',
              borderBottom: 'var(--hairline-width) solid var(--hairline)',
            }}
          >
            <span style={label}>Selected</span>
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.map((name) => (
                <TagChoice key={fold(name)} name={name} selected onToggle={() => toggle(name)} />
              ))}
            </span>
          </div>
        ) : null}
        {needle ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '16px 0' }}>
            {results.map((name) => (
              <TagChoice
                key={fold(name)}
                name={name}
                selected={selected.some((value) => fold(value) === fold(name))}
                onToggle={() => toggle(name)}
              />
            ))}
            {results.length === 0 ? (
              <div style={{ ...caption, color: 'var(--text-secondary)' }}>
                No tag matches “{query.trim()}”. Use New tag to keep your wording.
              </div>
            ) : null}
          </div>
        ) : (
          TAG_GROUPS.filter((group) => contentWarningsOn || group.group !== 'Content warnings').map(
            (group) => {
              const open = openGroups.includes(group.group);
              return (
                <div
                  key={group.group}
                  style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }}
                >
                  <button
                    aria-expanded={open}
                    onClick={() =>
                      setOpenGroups((groups) =>
                        open
                          ? groups.filter((name) => name !== group.group)
                          : [...groups, group.group],
                      )
                    }
                    style={{
                      ...resetButton,
                      width: '100%',
                      height: 56,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span>{group.group}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                      {group.tags.length}
                    </span>
                    <Chevron expanded={open} />
                  </button>
                  {open ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 20 }}>
                      {group.tags.map((name) => (
                        <TagChoice
                          key={fold(name)}
                          name={name}
                          selected={selected.some((value) => fold(value) === fold(name))}
                          onToggle={() => toggle(name)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            },
          )
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          paddingTop: 'var(--space-3)',
          borderTop: 'var(--hairline-width) solid var(--hairline)',
        }}
      >
        <span style={{ ...caption, color: 'var(--text-secondary)' }}>
          {selected.length === 0
            ? 'No tags yet'
            : `${selected.length} tag${selected.length === 1 ? '' : 's'}`}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={onDone}
          style={{
            ...resetButton,
            height: 48,
            lineHeight: '48px',
            padding: '0 24px',
            borderRadius: 'var(--radius-button)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            fontWeight: 500,
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function TagChoice({
  name,
  selected,
  onToggle,
}: {
  name: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      onClick={onToggle}
      style={{
        ...resetButton,
        padding: '6px 12px',
        borderRadius: 'var(--radius-pill)',
        border: `var(--hairline-width) solid ${selected ? 'var(--accent)' : 'var(--hairline)'}`,
        background: selected ? 'var(--accent-deep)' : 'transparent',
        color: selected ? 'var(--accent-text)' : 'var(--text-primary)',
        ...caption,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </button>
  );
}

function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 44,
        height: 26,
        flex: 'none',
        borderRadius: 999,
        background: on ? 'var(--accent)' : 'var(--surface-raised)',
        border: `var(--hairline-width) solid ${on ? 'var(--accent)' : 'var(--hairline-strong)'}`,
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        transition: 'background var(--dur-fast) var(--ease-snap)',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          background: on ? 'var(--on-accent)' : 'var(--text-secondary)',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform var(--dur-fast) var(--ease-snap)',
        }}
      />
    </span>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="7"
      viewBox="0 0 12 7"
      fill="none"
      stroke="var(--text-secondary)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        flex: 'none',
        transform: expanded ? 'rotate(180deg)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-snap)',
      }}
    >
      <path d="M1 1l5 5 5-5" />
    </svg>
  );
}

import { useState } from 'react';
import { nav } from '../../router/router';
import { useLibrarySearch } from '../store';
import { Cover, TagPill } from '../components';
import { ChevronLeft } from '../icons';
import { SearchField } from '../search-field';
import { bodyL, caption, displayS, label, resetButton } from '../styles';

export const CATALOGUE_EXPLANATION =
  'Search the downloaded index, or search online. Anything you add stays in your library.';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const result = useLibrarySearch(query);
  const empty = result && Object.values(result).every((rows) => rows.length === 0);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 'calc(20px + var(--safe-top)) 16px 12px',
        }}
      >
        <button
          aria-label="Back"
          onClick={() => nav.back()}
          style={{
            ...resetButton,
            width: 40,
            height: 44,
            marginLeft: -10,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft />
        </button>
        <SearchField value={query} onChange={setQuery} />
      </header>
      <div className="exl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 104px' }}>
        {!result && (
          <p role="status" style={caption}>
            Searching your library…
          </p>
        )}
        {(['works', 'wishlist'] as const).map((group) =>
          result?.[group].length ? (
            <section key={group}>
              <h2 style={{ ...label, fontWeight: 400, padding: '12px 0 4px' }}>
                {group === 'works' ? 'Works' : 'On your wishlist'}
              </h2>
              {result[group].map(({ work, authorName }) => (
                <button
                  key={work.id}
                  data-work={work.id}
                  onClick={() => nav.push({ screen: 'detail', id: work.id })}
                  style={{
                    ...resetButton,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderTop: 'var(--hairline-width) solid var(--hairline)',
                  }}
                >
                  <Cover
                    width={36}
                    height={54}
                    color={work.coverDominantColor ?? 'var(--cover-fallback)'}
                    path={work.coverPath}
                  />
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                    <span style={{ display: 'block', fontSize: 'var(--size-body)' }}>
                      {work.title}
                    </span>
                    {authorName && (
                      <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                        {authorName}
                      </span>
                    )}
                  </span>
                  {group === 'wishlist' && (
                    <span
                      style={{
                        ...label,
                        color: 'var(--accent-text)',
                        border: 'var(--hairline-width) solid var(--accent)',
                        borderRadius: 'var(--radius-chip)',
                        padding: '3px 8px',
                      }}
                    >
                      Wishlist
                    </span>
                  )}
                </button>
              ))}
            </section>
          ) : null,
        )}
        {!!result?.notes.length && (
          <section>
            <h2 style={label}>Notes</h2>
            {result.notes.map(({ note, tags, works }) => (
              <button
                key={note.id}
                aria-label={`Edit note: ${note.title || note.body}`}
                onClick={() => nav.open({ kind: 'noteEditor', id: note.id })}
                style={{
                  ...resetButton,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 5,
                  padding: '12px 0',
                  borderTop: 'var(--hairline-width) solid var(--hairline)',
                  textAlign: 'left',
                }}
              >
                {note.title && <div>{note.title}</div>}
                <p
                  style={{
                    ...caption,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {note.body}
                </p>
                {works.length ? (
                  <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                    {works.map((work) => work.title).join(', ')}
                  </span>
                ) : null}
                {tags.length ? (
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {tags.map((tag) => (
                      <TagPill key={tag.id} name={tag.name} />
                    ))}
                  </span>
                ) : null}
              </button>
            ))}
          </section>
        )}
        {!!result?.genres.length && (
          <section>
            <h2 style={{ ...label, paddingTop: 24 }}>Genres</h2>
            {result.genres.map((genre) => (
              <button
                key={genre.index}
                onClick={() => nav.push({ screen: 'everything', genre: genre.index })}
                style={{
                  ...resetButton,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 0',
                  borderTop: 'var(--hairline-width) solid var(--hairline)',
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 20,
                    borderRadius: 2,
                    background: `var(--genre-${genre.index})`,
                  }}
                />
                <span style={{ flex: 1 }}>{genre.name}</span>
                <span style={caption}>{genre.count}</span>
              </button>
            ))}
          </section>
        )}
        {!!result?.tags.length && (
          <section>
            <h2 style={{ ...label, paddingTop: 24 }}>Tags</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {result.tags.map((tag) => (
                <TagPill key={tag.id} name={tag.name} />
              ))}
            </div>
          </section>
        )}
        {empty && (
          <div style={{ padding: '32px 0 8px' }}>
            <h1 style={displayS}>
              {query.trim() ? 'No matches in your library' : 'Search your library'}
            </h1>
            <p style={{ ...bodyL, color: 'var(--text-secondary)', maxWidth: '32ch' }}>
              Search reads titles, authors, your notes and your tags. It does not reach outside the
              library.
            </p>
          </div>
        )}
        <button
          onClick={() => nav.open({ kind: 'catalogue', query })}
          style={{
            ...resetButton,
            width: '100%',
            marginTop: 32,
            padding: 16,
            borderRadius: 'var(--radius-card)',
            border: 'var(--hairline-width) solid var(--hairline)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span style={{ color: 'var(--accent-text)' }}>Look in the catalogue instead</span>
          <span style={{ ...caption, color: 'var(--text-secondary)' }}>
            {CATALOGUE_EXPLANATION}
          </span>
        </button>
      </div>
    </div>
  );
}

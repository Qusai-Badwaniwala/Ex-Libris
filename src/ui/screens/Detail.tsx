import { useState } from 'react';
import { nav } from '../../router/router';
import { caption, displayM, displayS, label, resetButton, tabular } from '../styles';
import { ChevronLeft } from '../icons';
import { Cover, GenreChips, ProgressBar, TagPill } from '../components';
import { displayWork } from '../../db/derive';
import { useTagNames, useWork } from '../store';
import * as repo from '../../db/repo';

/**
 * Book detail. The landing site of the cover flight.
 *
 * Ported from design/Ex Libris.dc.html, with three changes, all from the audit
 * the owner approved:
 *
 *   A1  The status pill is a control. In the design it renders and does
 *       nothing, which means nothing in the app could ever be marked finished,
 *       dropped or caught up.
 *   A2–A4  An "Edit" control in the header opens a sheet covering title,
 *       author, shelf, unit, position and total — none of which had a control.
 *   A6  A work's notes will appear here in Phase 7, when notes exist. Nothing
 *       is stubbed in the meantime.
 *
 * The axis line is deliberately absent until Phase 6. The design shows it, but
 * a row of type that says "tap to change it" and does not is exactly the
 * switch-with-nothing-behind-it the design itself refuses (Q-014).
 */
export function Detail({ id }: { id: string }) {
  const row = useWork(id);
  const tagNames = useTagNames(row?.work.tagIds ?? []);
  const [barMotion, setBarMotion] = useState(false);

  if (row === undefined) return null;
  if (row === null) {
    // Reachable: open a work, delete it from the trash on another screen, come
    // back through history. Better a plain sentence than a blank screen.
    return (
      <div style={{ position: 'absolute', inset: 0, padding: 'var(--space-6) var(--page-gutter)' }}>
        <button
          onClick={() => nav.back()}
          style={{ ...resetButton, ...caption, color: 'var(--accent-text)' }}
        >
          ← Back
        </button>
        <div style={{ ...displayS, marginTop: 'var(--space-5)' }}>That work is gone</div>
      </div>
    );
  }

  const { work } = row;
  const d = displayWork(work, row.authorName);
  const deleted = !!work.deletedAt;

  const tint = work.coverDominantColor
    ? `color-mix(in oklab, ${work.coverDominantColor} var(--cover-tint-amt), var(--surface-base))`
    : // A tinted header with no cover to justify it looks like a bug
      // (COMPONENTS, DetailHeader).
      'var(--surface-base)';

  return (
    <div
      className="exl-scroll"
      style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: 104 }}
    >
      <div
        style={{
          position: 'relative',
          padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) var(--space-5)',
          background: tint,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            aria-label="Back"
            onClick={() => nav.back()}
            style={{
              ...resetButton,
              width: 44,
              height: 44,
              marginLeft: -12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft color="var(--text-primary)" />
          </button>
          <span style={{ flex: 1 }} />
          <button
            // Two controls on this screen say "Edit": this one and the genre
            // row's. The visible words are the design's; the accessible names
            // have to differ or a screen reader reads "Edit, Edit".
            aria-label="Edit this work"
            onClick={() => nav.open({ kind: 'editWork', id })}
            style={{
              ...resetButton,
              ...caption,
              color: 'var(--accent-text)',
              padding: 'var(--space-1) var(--space-2)',
              marginRight: 'calc(var(--space-2) * -1)',
              borderRadius: 'var(--radius-chip)',
            }}
            data-hover="accent-deep"
          >
            Edit
          </button>
        </div>

        {/* Bottom-aligned, so the title sits on the cover's baseline rather than
            floating beside its middle (COMPONENTS, DetailHeader). */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            alignItems: 'flex-end',
            marginTop: 'var(--space-2)',
          }}
        >
          <Cover color={d.coverColor} width={116} height={174} flightName="work-cover" />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minWidth: 0,
              paddingBottom: 'var(--space-1)',
            }}
          >
            <div style={displayM}>{work.title}</div>
            {/* On detail, unlike in a list, a manual entry may legitimately show
                a title and nothing else. */}
            {d.hasAuthor ? (
              <div
                style={{
                  fontSize: 'var(--size-body)',
                  lineHeight: 'var(--lh-body)',
                  color: 'var(--text-secondary)',
                }}
              >
                {d.authorLine}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 'var(--space-5) var(--page-gutter)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
      >
        {deleted ? <InTrashNotice id={id} /> : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* A1. In the design this pill has no handler at all. */}
            <button
              data-hover="accent-border"
              onClick={() => nav.open({ kind: 'statusPicker', id })}
              style={{
                ...resetButton,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                height: 36,
                padding: '0 14px',
                borderRadius: 'var(--radius-pill)',
                border: 'var(--hairline-width) solid var(--hairline-strong)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: d.statusColor,
                }}
              />
              <span style={caption}>{d.statusLabel}</span>
            </button>
            <button
              data-hover="hairline"
              onClick={() => nav.open({ kind: 'editWork', id })}
              style={{
                ...resetButton,
                display: 'flex',
                alignItems: 'center',
                height: 36,
                padding: '0 14px',
                borderRadius: 'var(--radius-pill)',
                border: 'var(--hairline-width) solid var(--hairline)',
              }}
            >
              <span style={{ ...caption, color: 'var(--text-secondary)' }}>
                {d.publicationLabel}
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                ...caption,
                color: 'var(--text-secondary)',
                ...tabular,
              }}
            >
              <span>{d.progressLabel}</span>
              <span style={{ flex: 1 }} />
              {d.canLogSession && !deleted ? (
                <button
                  data-ripple
                  data-hover="accent-deep"
                  onClick={() => {
                    setBarMotion(true);
                    nav.open({ kind: 'session', id });
                  }}
                  style={{
                    ...resetButton,
                    padding: '4px 8px',
                    margin: '-4px 0',
                    borderRadius: 'var(--radius-chip)',
                    ...caption,
                    color: 'var(--accent-text)',
                  }}
                >
                  {d.sessionCta}
                </button>
              ) : null}
              <span>{d.percentLabel}</span>
            </div>
            {d.showBar ? (
              <ProgressBar
                width={d.barWidth}
                track={d.trackBackground}
                fill={d.fillBackground}
                animate={barMotion}
              />
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={label}>{work.genres.length > 1 ? 'Genres' : 'Genre'}</span>
              <span style={{ flex: 1 }} />
              {/* Always present, with an "Add a genre" affordance when empty: an
                  empty state that hides its own entry point is a dead end
                  (D-106). */}
              <button
                aria-label={work.genres.length ? 'Edit genres' : 'Add a genre'}
                onClick={() => nav.open({ kind: 'genreEditor', id })}
                style={{
                  ...resetButton,
                  ...label,
                  color: 'var(--accent-text)',
                  padding: '4px 8px',
                  margin: '-4px -8px -4px 0',
                  borderRadius: 'var(--radius-chip)',
                }}
              >
                {work.genres.length ? 'Edit' : 'Add a genre'}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {work.genres.length ? (
                <GenreChips genres={work.genres} />
              ) : (
                <span style={{ ...caption, color: 'var(--text-muted)' }}>None yet</span>
              )}
            </div>
          </div>

          {tagNames && tagNames.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={label}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {tagNames.map((t) => (
                  <TagPill key={t} name={t} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!deleted ? (
        <div
          style={{
            padding: 'var(--space-6) var(--page-gutter) var(--space-2)',
            borderTop: 'var(--hairline-width) solid var(--hairline)',
            marginTop: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {/* Grade 2 of the three destructive grades: reversible, so it acts on
              one tap and the thirty-day trash is the confirmation (D-081). */}
          <button
            data-hover="danger"
            onClick={() => {
              void repo.softDeleteWork(id);
              nav.back();
            }}
            style={{
              ...resetButton,
              width: '100%',
              height: 44,
              lineHeight: '44px',
              textAlign: 'center',
              borderRadius: 'var(--radius-button)',
              border: 'var(--hairline-width) solid var(--danger)',
              color: 'var(--danger)',
              fontSize: 'var(--size-body)',
            }}
          >
            Remove from the library
          </button>
          <div
            style={{
              ...caption,
              color: 'var(--text-secondary)',
              textAlign: 'center',
              textWrap: 'pretty',
            }}
          >
            It waits in the trash for thirty days. Its notes survive as loose notes.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** A soft-deleted work is still reachable by history and by the trash. Saying
 *  so beats letting it look like an ordinary shelf entry. */
function InTrashNotice({ id }: { id: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-card)',
        border: 'var(--hairline-width) solid var(--hairline)',
        background: 'var(--surface-raised)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <span style={{ ...caption, flex: 1, color: 'var(--text-secondary)' }}>
        This is in the trash.
      </span>
      <button
        onClick={() => void repo.restoreWork(id)}
        style={{
          ...resetButton,
          height: 30,
          padding: '0 12px',
          lineHeight: '30px',
          borderRadius: 'var(--radius-pill)',
          border: 'var(--hairline-width) solid var(--accent)',
          color: 'var(--accent-text)',
          ...caption,
        }}
      >
        Put it back
      </button>
    </div>
  );
}

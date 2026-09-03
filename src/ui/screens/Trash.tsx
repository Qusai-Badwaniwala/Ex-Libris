import { useState } from 'react';
import { nav } from '../../router/router';
import { caption, displayM, resetButton, tabular } from '../styles';
import { ChevronLeft } from '../icons';
import { Cover, EmptyState } from '../components';
import { useTrash } from '../store';
import { daysLeftInTrash } from '../../db/repo';
import * as repo from '../../db/repo';
import { localDay } from '../../db/dates';

/**
 * The trash. Ported from design/Ex Libris.dc.html.
 *
 * One wording change from the prototype, and it is a correction rather than a
 * preference: the intro says when things are actually cleared. There is no
 * server and no background job here, so a thirty-day retention can only run
 * when the app is opened — leave it shut for two months and everything expires
 * at once on the next launch. The design's copy implied a clock that was
 * running. See OPEN-QUESTIONS Q-021.
 */
export function Trash() {
  const rows = useTrash();
  /** Grade 3: irreversible controls arm in place. Never a dialog (D-081). */
  const [armed, setArmed] = useState<string | null>(null);

  const items = rows ?? [];

  return (
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) 104px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          marginBottom: 'var(--space-2)',
        }}
      >
        <button
          aria-label="Back"
          onClick={() => nav.reset({ screen: 'home' })}
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
        <div style={{ ...displayM, flex: 1 }}>Trash</div>
      </div>

      <div
        style={{
          fontSize: 'var(--size-body)',
          lineHeight: 'var(--lh-body)',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-5)',
          textWrap: 'pretty',
        }}
      >
        Things wait here for thirty days, and are cleared the next time you open the app after that.
        Notes attached to a deleted work are not deleted with it.
      </div>

      {rows === undefined ? null : items.length === 0 ? (
        <EmptyState
          art="/illustrations/bibliophile-bro.svg"
          artWidth="58%"
          head="Trash is empty"
          body="Deleted works and notes wait here for thirty days. Notes attached to a deleted work survive as loose notes."
        />
      ) : (
        <>
          {items.map(({ work }) => {
            const left = daysLeftInTrash(work.deletedAt ?? '');
            const isArmed = armed === work.id;
            return (
              <div
                key={work.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '14px 0',
                  borderTop: 'var(--hairline-width) solid var(--hairline)',
                }}
              >
                <Cover
                  color={work.coverDominantColor ?? 'var(--cover-fallback)'}
                  width={24}
                  height={36}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 'var(--size-body)',
                      lineHeight: 'var(--lh-body)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {work.title}
                  </span>
                  {/* Parts separated by a hairline rule, never a middle dot
                      (D-007). */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      ...caption,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>{localDay(work.deletedAt ?? '')}</span>
                    <span
                      style={{ width: 0.5, height: 12, background: 'var(--hairline-strong)' }}
                    />
                    <span style={tabular}>
                      {left === 0
                        ? 'due to be cleared'
                        : `${left} day${left === 1 ? '' : 's'} left`}
                    </span>
                  </div>
                </div>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => {
                    if (isArmed) {
                      void repo.purgeWork(work.id);
                      setArmed(null);
                    } else {
                      setArmed(work.id);
                    }
                  }}
                  style={{
                    ...resetButton,
                    height: 30,
                    padding: '0 12px',
                    lineHeight: '30px',
                    borderRadius: 'var(--radius-pill)',
                    border: `var(--hairline-width) solid ${isArmed ? 'var(--danger)' : 'var(--hairline-strong)'}`,
                    background: isArmed ? 'var(--danger-soft)' : 'transparent',
                    color: isArmed ? 'var(--danger)' : 'var(--text-secondary)',
                    ...caption,
                    marginRight: 6,
                  }}
                >
                  {isArmed ? 'Sure?' : 'Delete now'}
                </button>
                <button
                  data-hover="restore"
                  onClick={() => void repo.restoreWork(work.id)}
                  style={{
                    ...resetButton,
                    height: 30,
                    padding: '0 12px',
                    lineHeight: '30px',
                    borderRadius: 'var(--radius-pill)',
                    border: 'var(--hairline-width) solid var(--hairline-strong)',
                    color: 'var(--text-secondary)',
                    ...caption,
                    flex: 'none',
                  }}
                >
                  Restore
                </button>
              </div>
            );
          })}

          <div
            style={{
              borderTop: 'var(--hairline-width) solid var(--hairline)',
              marginTop: 'var(--space-1)',
              paddingTop: 'var(--space-5)',
            }}
          >
            <button
              data-hover="danger"
              onClick={() => {
                if (armed === 'all') {
                  void repo.emptyTrash();
                  setArmed(null);
                } else {
                  setArmed('all');
                }
              }}
              style={{
                ...resetButton,
                width: '100%',
                height: 44,
                lineHeight: '44px',
                textAlign: 'center',
                borderRadius: 'var(--radius-button)',
                border: 'var(--hairline-width) solid var(--danger)',
                background: armed === 'all' ? 'var(--danger-soft)' : 'transparent',
                color: 'var(--danger)',
                fontSize: 'var(--size-body)',
              }}
            >
              {armed === 'all' ? 'Tap again to empty it for good' : 'Empty it now'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

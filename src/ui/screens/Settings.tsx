import { useEffect, useState } from 'react';
import { nav } from '../../router/router';
import { caption, displayM, displayS, label, resetButton, tabular } from '../styles';
import { ChevronRight, Menu } from '../icons';
import { Field } from '../components';
import { storageUsage, type StorageUsage } from '../../storage/opfs';
import { buildBackup, downloadBackup } from '../../db/backup';
import { APP_VERSION, useSettings, useTrash } from '../store';
import { localDay } from '../../db/dates';
import type { Format, Settings as SettingsRow, ThemeChoice, ViewMode } from '../../db/schema';
import { applyTheme } from '../theme';

/**
 * Settings. Ported from design/Ex Libris.dc.html as a ruled ledger — label
 * left, value or control right, hairline between, display-S group headings, no
 * cards and no icons per row (D-043).
 *
 * Four audit items land here, all of them things the design shows and does not
 * do:
 *
 *   B7  The owner's name was set once on the bookplate and never again. A typo
 *       at first run was permanent.
 *   C1  "Show content warning tags" was filed under the "Help from a model"
 *       heading, which has nothing to do with it. It is under Tags now.
 *   C3  "Export a copy" had no handler. It is the only protection against
 *       losing the device, so it was the wrong row to leave inert.
 *   C4  There was no storage row, in an app that will hold a several-hundred-
 *       megabyte index plus cached covers.
 *
 * The "Ask a model" row is absent entirely rather than shown inert — a switch
 * that changes nothing is worse than an absent feature (Q-014).
 */

const SHELVES: { key: Format; label: string }[] = [
  { key: 'book', label: 'Books' },
  { key: 'novel', label: 'Novels' },
  { key: 'manhwa', label: 'Manhwa' },
];

export function Settings() {
  const { settings, update } = useSettings();
  const trash = useTrash();
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  useEffect(() => {
    void storageUsage().then(setUsage);
  }, [exported]);

  if (!settings) return null;

  return (
    <div
      className="exl-scroll"
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        padding: 'calc(var(--space-5) + var(--safe-top)) var(--page-gutter) 104px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <button
          aria-label="Menu"
          onClick={() => nav.open({ kind: 'drawer' })}
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
          <Menu />
        </button>
        <div style={{ ...displayM, flex: 1 }}>Settings</div>
      </div>

      <Group heading="Appearance">
        <Row label="Theme">
          <Pill<ThemeChoice>
            value={settings.theme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
            onChange={(t) => {
              applyTheme(t);
              void update({ theme: t });
            }}
            ariaLabel="Theme"
          />
        </Row>
      </Group>

      {/* B7. The bookplate asks once and then becomes About; without this a
          typo at first run is permanent. */}
      <Group heading="The bookplate">
        <OwnerName settings={settings} onSave={(ownerName) => void update({ ownerName })} />
      </Group>

      <Group heading="Default views">
        {SHELVES.map((s) => (
          <Row key={s.key} label={s.label}>
            <Pill<ViewMode>
              value={settings.defaultView[s.key]}
              options={[
                { value: 'list', label: 'List' },
                { value: 'spine', label: 'Spines' },
              ]}
              onChange={(v) =>
                void update({ defaultView: { ...settings.defaultView, [s.key]: v } })
              }
              ariaLabel={`Default view for ${s.label}`}
            />
          </Row>
        ))}
        <Row label="Series sections start open">
          <Switch
            on={settings.seriesSectionsDefaultOpen}
            onChange={(v) => void update({ seriesSectionsDefaultOpen: v })}
            ariaLabel="Series sections start open"
          />
        </Row>
      </Group>

      <Group heading="Your data">
        <button
          data-hover="raised"
          onClick={() => {
            void buildBackup(APP_VERSION).then((file) => {
              downloadBackup(file);
              void update({ lastManualExportAt: new Date().toISOString() });
              setExported(new Date().toISOString());
            });
          }}
          style={rowButton}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ fontSize: 'var(--size-body)', lineHeight: 'var(--lh-body)' }}>
              Export a copy
            </span>
            <br />
            <span style={label}>
              {settings.lastManualExportAt
                ? `Last one ${localDay(settings.lastManualExportAt)}`
                : 'Never exported. This is the only copy that survives losing the phone.'}
            </span>
          </span>
        </button>

        <button data-hover="raised" onClick={() => nav.push({ screen: 'trash' })} style={rowButton}>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 'var(--size-body)' }}>Trash</span>
          <span style={{ ...caption, ...tabular, color: 'var(--text-secondary)' }}>
            {trash === undefined ? '—' : trash.length === 0 ? 'empty' : `${trash.length} waiting`}
          </span>
          <ChevronRight />
        </button>

        {/* C4. Real numbers or an em dash — never a plausible zero. */}
        <Row label="Storage used">
          <span style={{ ...caption, ...tabular, color: 'var(--text-secondary)' }}>
            {usage && usage.quotaBytes > 0
              ? `${mb(usage.usedBytes)} of ${mb(usage.quotaBytes)}`
              : '—'}
          </span>
        </Row>
        <Row label="Kept safe from eviction">
          <span style={{ ...caption, color: 'var(--text-secondary)' }}>
            {usage === null ? '—' : usage.persisted ? 'Yes' : 'Not yet'}
          </span>
        </Row>
        {usage && !usage.persisted ? (
          <p style={{ ...label, padding: 'var(--space-2) 0 0', textWrap: 'pretty' }}>
            Browsers only promise to keep an app&apos;s data once it is installed to the home
            screen. Until then this library could be cleared under storage pressure, so an export is
            worth having.
          </p>
        ) : null}
      </Group>

      {/* C1. This was filed under "Help from a model", which has nothing to do
          with it. */}
      <Group heading="Tags">
        <Row label="Show content warning tags">
          <Switch
            on={settings.contentWarningsOn}
            onChange={(v) => void update({ contentWarningsOn: v })}
            ariaLabel="Show content warning tags"
          />
        </Row>
        <p style={{ ...label, padding: 'var(--space-2) 0 0', textWrap: 'pretty' }}>
          {settings.contentWarningsOn
            ? 'On. Warning tags show with a red wash wherever tags appear.'
            : 'Off. Those tags are neither shown nor created when a work is added.'}
        </p>
      </Group>

      <Group heading="">
        <button data-hover="raised" onClick={() => nav.push({ screen: 'about' })} style={rowButton}>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 'var(--size-body)' }}>About</span>
          <ChevronRight />
        </button>
      </Group>
    </div>
  );
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;

const rowButton = {
  ...resetButton,
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minHeight: 56,
  padding: 'var(--space-2) 0',
  borderTop: 'var(--hairline-width) solid var(--hairline)',
} as const;

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      {heading ? (
        <div style={{ ...displayS, marginBottom: 'var(--space-1)' }}>{heading}</div>
      ) : null}
      {children}
      {/* The last row in a group takes a bottom border so the group closes
          (COMPONENTS, LedgerRow). */}
      <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }} />
    </section>
  );
}

function Row({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        minHeight: 56,
        padding: 'var(--space-2) 0',
        borderTop: 'var(--hairline-width) solid var(--hairline)',
      }}
    >
      <span style={{ flex: 1, fontSize: 'var(--size-body)', lineHeight: 'var(--lh-body)' }}>
        {text}
      </span>
      {children}
    </div>
  );
}

/** The compact segmented pill Settings uses, at 13px (COMPONENTS). */
function Pill<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        border: 'var(--hairline-width) solid var(--hairline)',
        borderRadius: 'var(--radius-button)',
        overflow: 'hidden',
        flex: 'none',
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={{
              ...resetButton,
              padding: '6px 14px',
              ...caption,
              background: on ? 'var(--surface-raised)' : 'transparent',
              color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 44×26 pill, 20px knob. The knob travels by transform, never by
 *  justify-content, which cannot tween (audit M-04). */
function Switch({
  on,
  onChange,
  ariaLabel,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      style={{
        ...resetButton,
        width: 44,
        height: 26,
        flex: 'none',
        borderRadius: 'var(--radius-pill)',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        background: on ? 'var(--accent)' : 'var(--surface-sunken)',
        border: `var(--hairline-width) solid ${on ? 'var(--accent)' : 'var(--hairline-strong)'}`,
        transition: 'background-color var(--dur-fast) var(--ease-snap)',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          // Non-text UI, so --text-muted clears the 3:1 floor and is legal here.
          background: on ? 'var(--on-accent)' : 'var(--text-muted)',
          transform: on ? 'translateX(18px)' : 'none',
          transition: 'transform var(--dur-fast) var(--ease-snap)',
        }}
      />
    </button>
  );
}

/** B7. Saves on blur rather than on every keystroke, so the bookplate does not
 *  redraw under the reader mid-word. */
function OwnerName({
  settings,
  onSave,
}: {
  settings: SettingsRow;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(settings.ownerName ?? '');
  const changed = name.trim() !== (settings.ownerName ?? '');
  const ok = name.trim().length > 0;

  return (
    <div
      style={{
        padding: 'var(--space-3) 0',
        borderTop: 'var(--hairline-width) solid var(--hairline)',
      }}
    >
      <Field
        label="From the books of"
        value={name}
        onChange={setName}
        display
        note={ok ? 'It goes on the bookplate, and nowhere else.' : 'The bookplate needs a name.'}
      />
      {changed && ok ? (
        <button
          onClick={() => onSave(name.trim())}
          style={{
            ...resetButton,
            marginTop: 'var(--space-2)',
            ...caption,
            color: 'var(--accent-text)',
          }}
        >
          Save the name
        </button>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { nav } from '../../router/router';
import { caption, displayL, displayS, label, resetButton, tabular } from '../styles';
import { ChevronLeft } from '../icons';
import { APP_VERSION } from '../store';
import type { Settings } from '../../db/schema';
import { storageUsage, type StorageUsage } from '../../storage/opfs';
import { localDay } from '../../db/dates';
import { LEAF_GRADIENT } from '../design-literals';
import { Illustration } from '../illustration';

/**
 * About — the bookplate, kept.
 *
 * Brief §8: the bookplate "becomes the About screen permanently", with the name
 * field replaced by the stored name as static text. So this is the same frame,
 * the same illustration, the same band, and nothing new.
 *
 * The owner's name is edited in Settings rather than here (B7): About is a
 * plate, and a plate is read rather than filled in.
 */
export function About({ settings }: { settings: Settings }) {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [usageError, setUsageError] = useState(false);

  useEffect(() => {
    void storageUsage()
      .then(setUsage)
      .catch(() => setUsageError(true));
  }, []);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <button
          aria-label="Back"
          // D-051: a drawer destination goes home, because a back arrow that
          // always returned to Settings would lie to whoever arrived by drawer.
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
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: 'var(--space-5) 0 var(--space-6)',
        }}
      >
        <Illustration
          name="magic-tree-cuate"
          style={{ width: '72%', maxWidth: 260, marginBottom: 'var(--space-5)' }}
        />
        <h1 style={{ ...displayL, margin: 0 }}>Ex Libris</h1>
        <div style={{ ...label, margin: 'var(--space-3) 0 var(--space-1)' }}>From the books of</div>
        <div style={{ ...displayS, overflowWrap: 'anywhere', maxWidth: '100%' }}>
          {settings.ownerName ?? 'no name yet'}
        </div>
        <div
          style={{
            ...label,
            letterSpacing: '0.06em',
            marginTop: 'var(--space-2)',
            background: LEAF_GRADIENT,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Built for one reader
        </div>
      </div>

      <Row label="Version" value={APP_VERSION} />
      <Row
        label="Search index"
        value={settings.corpusVersion ? `v${settings.corpusVersion}` : 'not installed'}
      />
      <Row
        label="Kept on"
        value={settings.firstTrackedAt ? localDay(settings.firstTrackedAt) : '—'}
      />
      <Row
        label="Storage used"
        value={
          usageError
            ? 'unavailable'
            : usage && usage.quotaBytes > 0
              ? `${(usage.usedBytes / 1048576).toFixed(1)} MB`
              : '—'
        }
      />
      <div style={{ borderTop: 'var(--hairline-width) solid var(--hairline)' }} />

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--size-body-l)',
          lineHeight: 'var(--lh-body-l)',
          color: 'var(--text-secondary)',
          textWrap: 'pretty',
          marginTop: 'var(--space-6)',
        }}
      >
        Everything in this library lives on this device. There is no account, no server and nothing
        to sign in to, which also means there is nothing to fall back on if the phone is lost — an
        export is the only copy.
      </p>
    </div>
  );
}

function Row({ label: text, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        minHeight: 44,
        padding: '13px 0',
        borderTop: 'var(--hairline-width) solid var(--hairline)',
      }}
    >
      <span style={{ flex: 1, fontSize: 'var(--size-body)', lineHeight: 'var(--lh-body)' }}>
        {text}
      </span>
      <span
        style={{
          ...caption,
          ...tabular,
          color: 'var(--text-secondary)',
          maxWidth: '58%',
          textAlign: 'right',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  );
}

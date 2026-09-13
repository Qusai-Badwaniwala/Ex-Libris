import { useEffect, useRef, useState } from 'react';
import { coverService } from '../covers';
import { nav } from '../router/router';
import { Cover, Sheet } from './components';
import { useWork } from './store';
import { caption, displayS, label, resetButton } from './styles';
import { withInteractionFeedback } from './interaction-feedback';

export function CoverPicker({ id }: { id: string }) {
  const row = useWork(id);
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selected) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(selected);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selected]);

  if (!row) return null;
  const { work } = row;
  const hasStoredCover = !!work.coverPath;
  const canRetryRemote = !!work.coverRemoteUrl && work.coverSource !== 'user';

  const run = async (pendingLabel: string, action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await withInteractionFeedback(pendingLabel, action);
      nav.close();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The cover could not be changed. Your library record is unchanged.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={() => nav.close()} title="Cover" maxHeight="92%">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={displayS}>Cover</div>
        <div style={{ ...caption, color: 'var(--text-secondary)', textWrap: 'pretty' }}>
          Choose an image from this device. Ex Libris makes a smaller private copy for the library
          and never uploads it.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {preview ? (
          <img
            src={preview}
            alt="Selected cover preview"
            style={{
              width: 156,
              maxHeight: 234,
              objectFit: 'cover',
              borderRadius: 'var(--cover-radius)',
              boxShadow: 'var(--cover-inset)',
            }}
          />
        ) : (
          <Cover
            color={work.coverDominantColor ?? 'var(--cover-fallback)'}
            ink={work.coverTextColor === 'light' ? 'var(--surface-base)' : 'var(--text-primary)'}
            path={work.coverPath}
            width={156}
            height={234}
            title={work.title}
          />
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        aria-label="Choose a cover image"
        tabIndex={-1}
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          setError('');
          setConfirmRemove(false);
          if (file) setSelected(file);
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span style={label}>Image source</span>
        <button
          disabled={busy}
          onClick={() => input.current?.click()}
          style={{
            ...resetButton,
            minHeight: 44,
            padding: '0 16px',
            borderRadius: 'var(--radius-button)',
            border: 'var(--hairline-width) solid var(--hairline-strong)',
            color: 'var(--text-primary)',
            textAlign: 'center',
            fontSize: 'var(--size-body)',
          }}
        >
          {selected
            ? 'Choose a different image'
            : hasStoredCover
              ? 'Replace from device'
              : 'Choose from device'}
        </button>
        {selected ? (
          <button
            data-active="accent"
            disabled={busy}
            onClick={() =>
              void run('Registering the cover…', () => coverService.selectUserCover(id, selected))
            }
            style={{
              ...resetButton,
              minHeight: 48,
              padding: '0 16px',
              borderRadius: 'var(--radius-button)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              textAlign: 'center',
              fontSize: 'var(--size-body)',
              fontWeight: 500,
            }}
          >
            {busy ? 'Saving…' : 'Use this cover'}
          </button>
        ) : null}
        {canRetryRemote ? (
          <button
            disabled={busy}
            onClick={() =>
              void run('Fetching the catalogue cover…', () =>
                coverService.fetchApiCover(id, work.coverRemoteUrl as string),
              )
            }
            style={{
              ...resetButton,
              minHeight: 44,
              padding: '0 16px',
              borderRadius: 'var(--radius-button)',
              color: 'var(--accent-text)',
              fontSize: 'var(--size-body)',
            }}
          >
            {busy
              ? 'Fetching…'
              : hasStoredCover
                ? 'Refresh catalogue cover'
                : 'Fetch catalogue cover'}
          </button>
        ) : null}
      </div>

      {hasStoredCover ? (
        <div
          style={{
            paddingTop: 'var(--space-3)',
            borderTop: 'var(--hairline-width) solid var(--hairline)',
          }}
        >
          {confirmRemove ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div role="alert" style={{ ...caption, color: 'var(--text-secondary)' }}>
                Remove this stored cover? A catalogue cover can be fetched again; a device image
                cannot be recovered here.
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  disabled={busy}
                  onClick={() => setConfirmRemove(false)}
                  style={{
                    ...resetButton,
                    flex: 1,
                    height: 44,
                    border: 'var(--hairline-width) solid var(--hairline-strong)',
                    borderRadius: 'var(--radius-button)',
                  }}
                >
                  Keep it
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run('Removing the stored cover…', () => coverService.removeCover(id))
                  }
                  style={{
                    ...resetButton,
                    flex: 1,
                    height: 44,
                    border: 'var(--hairline-width) solid var(--danger)',
                    borderRadius: 'var(--radius-button)',
                    color: 'var(--danger)',
                  }}
                >
                  {busy ? 'Removing…' : 'Remove cover'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              style={{
                ...resetButton,
                width: '100%',
                height: 44,
                color: 'var(--danger)',
                fontSize: 'var(--size-body)',
              }}
            >
              Remove cover
            </button>
          )}
        </div>
      ) : null}

      {error ? (
        <div role="alert" style={{ ...caption, color: 'var(--danger-text)' }}>
          {error}
        </div>
      ) : null}
    </Sheet>
  );
}

import { useEffect, useState } from 'react';
import { Close } from './icons';
import { caption, resetButton } from './styles';

/** Browser connection feedback only; no reachability probe or background request. */
export function ConnectionStatus() {
  const [message, setMessage] = useState(
    navigator.onLine ? '' : 'You are offline. Your library is still available.',
  );
  useEffect(() => {
    const offline = () => setMessage('You are offline. Your library is still available.');
    const online = () => setMessage('Connection restored.');
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 'calc(var(--safe-top) + 12px)',
        left: 16,
        right: 16,
        zIndex: 100,
        pointerEvents: message ? 'auto' : 'none',
      }}
    >
      {message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 12px',
            background: 'var(--surface-overlay)',
            border: 'var(--hairline-width) solid var(--hairline-strong)',
            borderRadius: 'var(--radius-button)',
          }}
        >
          <span style={{ ...caption, flex: 1 }}>{message}</span>
          <button
            aria-label="Dismiss connection message"
            onClick={() => setMessage('')}
            style={{
              ...resetButton,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Close />
          </button>
        </div>
      )}
    </div>
  );
}

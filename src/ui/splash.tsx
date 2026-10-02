import { useEffect } from 'react';

/** Storage readiness controls startup. Artwork loads with its screen. */
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    onDone();
  }, [onDone]);
  return (
    <div className="room-startup" role="status">
      <span className="room-seal" aria-hidden="true">
        ex
      </span>
      <span>Opening your reading room…</span>
    </div>
  );
}

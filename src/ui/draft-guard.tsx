import { useEffect, useRef, useState } from 'react';
import {
  guardOverlayDismiss,
  guardScreenDismiss,
  nav,
  useRoute,
  type OverlayKind,
} from '../router/router';
import { useIsPresent } from './motion';
import { Sheet } from './components';
import { protectDraft } from './draft-state';

export function useDraftGuard(dirty: boolean, busy: boolean, kind?: OverlayKind) {
  const route = useRoute();
  const present = useIsPresent();
  const [confirm, setConfirm] = useState(false);
  const bypass = useRef(false);
  const discardAction = useRef<() => void>(() => {
    if (kind) nav.close();
    else nav.back();
  });
  const custom = useRef(false);
  const entry = useRef(route);
  useEffect(() => {
    if (!present) return;
    const guard = (next?: import('../router/router').Route, replay?: () => void) => {
      if (next && (next.flow ?? next) === (entry.current.flow ?? entry.current)) return true;
      if (bypass.current) return true;
      if (busy) return false;
      if (!dirty) return true;
      custom.current = false;
      // Programmatic navigation resumes the destination the reader selected.
      // Browser Back has already restored its guarded entry and must rewind it.
      discardAction.current =
        replay ??
        (() => {
          if (kind) nav.close();
          else nav.back();
        });
      setConfirm(true);
      return false;
    };
    return kind ? guardOverlayDismiss(kind, guard) : guardScreenDismiss(entry.current, guard);
  }, [dirty, busy, kind, present]);
  useEffect(
    () => (present && (dirty || busy) ? protectDraft() : undefined),
    [dirty, busy, present],
  );
  useEffect(() => {
    if (!dirty || !present) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, present]);
  return {
    confirm,
    keep: () => setConfirm(false),
    allow: () => {
      bypass.current = true;
    },
    request: (action: () => void) => {
      if (busy) return;
      if (dirty) {
        custom.current = true;
        discardAction.current = action;
        setConfirm(true);
      } else action();
    },
    discard: () => {
      bypass.current = true;
      setConfirm(false);
      discardAction.current();
      if (custom.current) bypass.current = false;
    },
  };
}
export function DiscardDraft({ guard }: { guard: ReturnType<typeof useDraftGuard> }) {
  return (
    <Sheet title="Discard unsaved changes?" onClose={guard.keep}>
      <div className="room-sheet-title">
        <h2>Keep your changes?</h2>
        <p>Your draft has not been saved.</p>
      </div>
      <button className="room-primary" onClick={guard.keep}>
        Keep editing
      </button>
      <button className="room-text" onClick={guard.discard}>
        Discard changes
      </button>
    </Sheet>
  );
}

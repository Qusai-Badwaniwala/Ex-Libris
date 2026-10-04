import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted, not the Google CDN the prototype linked. An offline-first app
// that fetches its own typefaces over the network renders in a fallback face
// the first time it is opened without signal, which is exactly when it matters.
// Weights are the ones tokens.css names and no others.
import './styles/astra-fonts.css';

import './styles/reading-room-tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/astra.css';
import './styles/motion.css';

import { App } from './ui/App';
import { installHistory } from './router/router';
import { MotionRoot } from './ui/motion';

installHistory();

// The engineering fixture is forbidden in a normal build, but Playwright must
// prove the real HTTP range -> OPFS -> wa-sqlite worker path. This bridge exists
// only in Vite's explicit test mode and is constant-folded out of production.
if (import.meta.env.MODE === 'test') {
  void import('./catalogue/test-bridge');
  void import('./relationships/test-bridge');
  void import('./axes/test-bridge');
  void import('./notes/test-bridge');
  void import('./data-safety/test-bridge');
  void import('./stats/test-bridge');
  void import('./phase10/test-bridge');
}

const el = document.getElementById('root');
if (!el) throw new Error('#root is missing from index.html');

const root = createRoot(el);
const openApp = () =>
  root.render(
    <StrictMode>
      <MotionRoot>
        <App />
      </MotionRoot>
    </StrictMode>,
  );
// Sample records belong solely to the explicit engineering test build. Vite
// eliminates this import and its data from every production bundle.
if (import.meta.env.MODE === 'test' && new URLSearchParams(location.search).has('evaluate')) {
  void import('./ui/astra-evaluation').then(({ Evaluation }) => {
    root.render(
      <Evaluation
        onDone={() => {
          history.replaceState(history.state, '', import.meta.env.BASE_URL);
          openApp();
        }}
      />,
    );
  });
} else openApp();

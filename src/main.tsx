import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted, not the Google CDN the prototype linked. An offline-first app
// that fetches its own typefaces over the network renders in a fallback face
// the first time it is opened without signal, which is exactly when it matters.
// Weights are the ones tokens.css names and no others.
import '@fontsource/sansita/400.css';
import '@fontsource/sansita/700.css';
import '@fontsource/sansita/800.css';
import '@fontsource/montserrat-alternates/400.css';
import '@fontsource/montserrat-alternates/500.css';
import '@fontsource/montserrat-alternates/600.css';
import '@fontsource/taviraj/300.css';
import '@fontsource/taviraj/400.css';
import '@fontsource/taviraj/500.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';

import { App } from './ui/App';
import { installHistory } from './router/router';

installHistory();

const el = document.getElementById('root');
if (!el) throw new Error('#root is missing from index.html');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

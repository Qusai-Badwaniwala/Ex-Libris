import { catalogue } from './client';
import { installCatalogue, openInstalledCatalogue } from './install';
import type { CatalogueInstallState, CorpusMatch } from './types';

export interface CatalogueTestBridge {
  install(): Promise<CatalogueInstallState>;
  search(query: string): Promise<{ matches: CorpusMatch[]; elapsedMs: number }>;
  close(): Promise<void>;
  open(path: string): Promise<number>;
}

declare global {
  interface Window {
    __EXL_CATALOGUE_TEST__?: CatalogueTestBridge;
  }
}

window.__EXL_CATALOGUE_TEST__ = {
  install: async () => {
    const installed = await installCatalogue();
    if (installed.phase === 'ready') await openInstalledCatalogue(installed.manifest.version);
    return installed;
  },
  search: (query) => catalogue.search(query),
  close: () => catalogue.close(),
  open: (path) => catalogue.open(path),
};

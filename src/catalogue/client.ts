import type {
  CatalogueWorkerRequest,
  CatalogueWorkerResponse,
  CatalogueWorkerResult,
  CorpusMatch,
  CorpusRelationshipEvidence,
} from './types';

type RequestWithoutId = CatalogueWorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, 'id'>
    : never
  : never;

interface Pending {
  resolve: (value: CatalogueWorkerResult) => void;
  reject: (reason: Error) => void;
}

class CatalogueClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<CatalogueWorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.ok) pending.resolve(response.result);
      else pending.reject(new Error(response.error));
    });
    worker.addEventListener('error', () => {
      const error = new Error('The catalogue worker stopped unexpectedly.');
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      worker.terminate();
      if (this.worker === worker) this.worker = null;
    });
    this.worker = worker;
    return worker;
  }

  request(request: RequestWithoutId): Promise<CatalogueWorkerResult> {
    const id = this.nextId++;
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ ...request, id } satisfies CatalogueWorkerRequest);
    });
  }

  async open(path: string): Promise<number> {
    const result = await this.request({ type: 'open', path });
    if (result.type !== 'opened') throw new Error('The catalogue worker returned the wrong reply.');
    return result.works;
  }

  async verify(path: string): Promise<number> {
    const result = await this.request({ type: 'verify', path });
    if (result.type !== 'verified') {
      throw new Error('The catalogue worker returned the wrong reply.');
    }
    return result.works;
  }

  async search(query: string, limit = 20): Promise<{ matches: CorpusMatch[]; elapsedMs: number }> {
    const result = await this.request({ type: 'search', query, limit });
    if (result.type !== 'results')
      throw new Error('The catalogue worker returned the wrong reply.');
    return { matches: result.matches, elapsedMs: result.elapsedMs };
  }

  async relationship(corpusId: string): Promise<CorpusRelationshipEvidence | undefined> {
    const result = await this.request({ type: 'relationship', corpusId });
    if (result.type !== 'relationship') {
      throw new Error('The catalogue worker returned the wrong reply.');
    }
    return result.evidence;
  }

  async close(): Promise<void> {
    if (!this.worker) return;
    const worker = this.worker;
    try {
      await this.request({ type: 'close' });
    } finally {
      worker.terminate();
      if (this.worker === worker) this.worker = null;
    }
  }
}

export const catalogue = new CatalogueClient();

/** Verification must not switch the live reader to an unpromoted version. */
export async function verifyCatalogueFile(path: string): Promise<number> {
  const verifier = new CatalogueClient();
  try {
    return await verifier.verify(path);
  } finally {
    await verifier.close();
  }
}

import { db, saveSettings } from '../db/db';
import {
  deleteFile,
  fileSize,
  opfsAvailable,
  readFile,
  truncateFile,
  writeFile,
  writeFileAt,
} from '../storage/opfs';
import { catalogue, verifyCatalogueFile } from './client';
import { corpusPath, manifestPath, parseManifest, resumePath } from './manifest';
import type { CatalogueInstallState, CorpusManifest, InstallProgress } from './types';

const MANIFEST_URL = `${import.meta.env.BASE_URL}corpus/manifest.json`;

interface ResumeMarker {
  manifestSha256: string;
  completedChunks: number;
}

let state: CatalogueInstallState = { phase: 'idle' };
let running: Promise<CatalogueInstallState> | null = null;
const listeners = new Set<() => void>();

function publish(next: CatalogueInstallState) {
  state = next;
  for (const listener of listeners) listener();
}

export const catalogueInstallStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
};

function allowManifest(manifest: CorpusManifest): void {
  if (manifest.distribution === 'production') return;
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') return;
  throw new Error('This build was given an engineering-only catalogue fixture.');
}

export async function fetchCorpusManifest(url = MANIFEST_URL): Promise<CorpusManifest> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('No downloadable catalogue index is available in this build.');
    }
    throw new Error(`The catalogue manifest could not be fetched (${response.status}).`);
  }
  const manifest = parseManifest(await response.json());
  allowManifest(manifest);
  return manifest;
}

const chunkEnd = (manifest: CorpusManifest, completed: number) =>
  manifest.chunks.slice(0, completed).reduce((sum, chunk) => sum + chunk.bytes, 0);

async function sha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readResumeMarker(manifest: CorpusManifest): Promise<ResumeMarker | null> {
  const file = await readFile(resumePath(manifest.version));
  if (!file) return null;
  try {
    const marker = JSON.parse(await file.text()) as Partial<ResumeMarker>;
    if (
      marker.manifestSha256 === manifest.sha256 &&
      Number.isSafeInteger(marker.completedChunks) &&
      (marker.completedChunks ?? -1) >= 0 &&
      (marker.completedChunks ?? Infinity) <= manifest.chunks.length
    ) {
      return marker as ResumeMarker;
    }
  } catch {
    // A torn marker costs verification work, not the partially downloaded DB.
  }
  return null;
}

async function recoverCompletedChunks(manifest: CorpusManifest, path: string): Promise<number> {
  const size = await fileSize(path);
  const marker = await readResumeMarker(manifest);
  // A marker records progress, not integrity: storage may have changed after
  // it was written. Rehash existing chunks in bounded memory before trusting
  // them, including when the marker survived. A lost marker costs no download.
  const file = await readFile(path);
  if (!file) return 0;
  let completed = 0;
  const committedBytes = marker ? Math.min(size, chunkEnd(manifest, marker.completedChunks)) : size;
  for (const chunk of manifest.chunks) {
    if (chunk.offset + chunk.bytes > committedBytes) break;
    const data = await file.slice(chunk.offset, chunk.offset + chunk.bytes).arrayBuffer();
    if ((await sha256(data)) !== chunk.sha256) break;
    completed++;
  }
  const verifiedBytes = chunkEnd(manifest, completed);
  if (file.size !== verifiedBytes) await truncateFile(path, verifiedBytes);
  return completed;
}

async function fetchChunk(
  manifestURL: string,
  manifest: CorpusManifest,
  index: number,
): Promise<ArrayBuffer> {
  const chunk = manifest.chunks[index]!;
  const fileURL = new URL(manifest.file, new URL(manifestURL, location.href));
  const lastByte = chunk.offset + chunk.bytes - 1;
  const response = await fetch(fileURL, {
    cache: 'no-store',
    headers: { Range: `bytes=${chunk.offset}-${lastByte}` },
  });

  // A one-chunk file is the full response, so a server that ignores Range has
  // still returned exactly what was requested. Larger files must answer 206;
  // accepting a 200 would allocate the whole catalogue for every chunk.
  const wholeSingleChunk =
    response.status === 200 && manifest.chunks.length === 1 && chunk.bytes === manifest.bytes;
  if (response.status !== 206 && !wholeSingleChunk) {
    throw new Error('The catalogue host does not support resumable byte downloads.');
  }
  const data = await response.arrayBuffer();
  if (data.byteLength !== chunk.bytes) {
    throw new Error('The catalogue host returned an incomplete download chunk.');
  }
  if ((await sha256(data)) !== chunk.sha256) {
    throw new Error('A downloaded catalogue chunk failed its checksum.');
  }
  return data;
}

async function install(manifestURL: string): Promise<CatalogueInstallState> {
  if (!(await opfsAvailable())) {
    const unavailable: CatalogueInstallState = {
      phase: 'unavailable',
      reason: 'This browser cannot keep the catalogue index on this device.',
    };
    publish(unavailable);
    return unavailable;
  }

  publish({ phase: 'checking' });
  let manifest: CorpusManifest | undefined;
  try {
    manifest = await fetchCorpusManifest(manifestURL);
    const path = corpusPath(manifest.version);
    const active = await db.settings.get('singleton');
    if (active?.corpusVersion === manifest.version) {
      const stored = await readFile(manifestPath(manifest.version));
      const installed = stored ? parseManifest(JSON.parse(await stored.text())) : null;
      if (installed?.sha256 !== manifest.sha256)
        throw new Error(
          'The catalogue host reused an installed version for different data. Keep the current index and retry after the host is corrected.',
        );
      const works = await openInstalledCatalogue(manifest.version);
      const ready: CatalogueInstallState = { phase: 'ready', manifest, path, works };
      publish(ready);
      return ready;
    }
    const startedAt = performance.now();
    let completed = await recoverCompletedChunks(manifest, path);
    let receivedBytes = chunkEnd(manifest, completed);
    publish({
      phase: 'downloading',
      manifest,
      receivedBytes,
      totalBytes: manifest.bytes,
      startedAt,
    });

    while (completed < manifest.chunks.length) {
      const chunk = manifest.chunks[completed]!;
      const data = await fetchChunk(manifestURL, manifest, completed);
      await writeFileAt(path, chunk.offset, data);
      completed++;
      receivedBytes += chunk.bytes;
      const marker: ResumeMarker = {
        manifestSha256: manifest.sha256,
        completedChunks: completed,
      };
      await writeFile(resumePath(manifest.version), JSON.stringify(marker));
      const progress: InstallProgress = {
        receivedBytes,
        totalBytes: manifest.bytes,
        startedAt,
      };
      publish({ phase: 'downloading', manifest, ...progress });
    }

    if ((await fileSize(path)) !== manifest.bytes) {
      throw new Error('The downloaded catalogue size does not match its manifest.');
    }
    const works = await verifyCatalogueFile(path);
    if (works !== manifest.counts.works) {
      throw new Error('The downloaded catalogue row count does not match its manifest.');
    }

    // Promotion is a one-row pointer change. Until this write completes, the
    // old version remains active; after it completes, the fully verified,
    // versioned file is active. No half-file ever occupies the live path.
    const previous = await db.settings.get('singleton');
    await writeFile(manifestPath(manifest.version), JSON.stringify(manifest));
    await saveSettings({
      corpusVersion: manifest.version,
      corpusInstalledAt: new Date().toISOString(),
      corpusSkippedAt: undefined,
    });

    // Cleanup is after the pointer switch and deliberately best-effort. A stale
    // old file costs storage; it must never turn a successfully installed,
    // already-active catalogue into an error screen.
    const stalePaths = [resumePath(manifest.version)];
    if (previous?.corpusVersion && previous.corpusVersion !== manifest.version) {
      stalePaths.push(
        corpusPath(previous.corpusVersion),
        manifestPath(previous.corpusVersion),
        resumePath(previous.corpusVersion),
      );
    }
    await Promise.allSettled(stalePaths.map((stalePath) => deleteFile(stalePath)));

    const ready: CatalogueInstallState = { phase: 'ready', manifest, path, works };
    publish(ready);
    return ready;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The catalogue download stopped.';
    const failed: CatalogueInstallState = manifest
      ? { phase: 'error', message, manifest }
      : { phase: 'error', message };
    publish(failed);
    return failed;
  }
}

/** Concurrent taps share one install. A retry starts only after failure settles. */
export function installCatalogue(manifestURL = MANIFEST_URL): Promise<CatalogueInstallState> {
  if (running) return running;
  running = install(manifestURL).finally(() => {
    running = null;
  });
  return running;
}

export async function openInstalledCatalogue(version: string): Promise<number> {
  if (!(await opfsAvailable())) throw new Error('The catalogue is unavailable in this browser.');
  const path = corpusPath(version);
  const storedManifest = await readFile(manifestPath(version));
  if (!storedManifest) throw new Error('The catalogue manifest is missing from this device.');
  const manifest = parseManifest(JSON.parse(await storedManifest.text()));
  allowManifest(manifest);
  if ((await fileSize(path)) !== manifest.bytes) {
    throw new Error('The catalogue file on this device is incomplete.');
  }
  return catalogue.open(path);
}

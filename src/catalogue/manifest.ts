import type { CorpusChunk, CorpusManifest } from './types';

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_VERSION = /^[a-zA-Z0-9._-]+$/;
const SAFE_FILE = /^[a-zA-Z0-9._-]+$/;
const SAFE_SOURCE = /^[a-zA-Z0-9._-]+$/;

const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function isChunk(value: unknown): value is CorpusChunk {
  if (!value || typeof value !== 'object') return false;
  const chunk = value as Partial<CorpusChunk>;
  return (
    isInt(chunk.offset) &&
    isInt(chunk.bytes) &&
    chunk.bytes > 0 &&
    typeof chunk.sha256 === 'string' &&
    SHA256.test(chunk.sha256)
  );
}

/**
 * The manifest is untrusted network input. Rejecting one costs a retry;
 * accepting a malformed one can write beyond the intended OPFS file or mark a
 * partial database installed, so validation is deliberately strict.
 */
export function parseManifest(value: unknown): CorpusManifest {
  if (!value || typeof value !== 'object') throw new Error('The index manifest is unreadable.');
  const manifest = value as Partial<CorpusManifest>;
  if (manifest.schema !== 1) throw new Error('This index needs a newer version of Ex Libris.');
  if (typeof manifest.version !== 'string' || !SAFE_VERSION.test(manifest.version)) {
    throw new Error('The index version is invalid.');
  }
  if (typeof manifest.file !== 'string' || !SAFE_FILE.test(manifest.file)) {
    throw new Error('The index file name is invalid.');
  }
  if (!isInt(manifest.bytes) || manifest.bytes <= 0) {
    throw new Error('The index size is invalid.');
  }
  if (typeof manifest.sha256 !== 'string' || !SHA256.test(manifest.sha256)) {
    throw new Error('The index checksum is invalid.');
  }
  if (!isInt(manifest.chunkSize) || manifest.chunkSize <= 0) {
    throw new Error('The index chunk size is invalid.');
  }
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) {
    throw new Error('The index has no resumable checksum map.');
  }

  let expectedOffset = 0;
  for (const chunk of manifest.chunks) {
    if (!isChunk(chunk) || chunk.offset !== expectedOffset || chunk.bytes > manifest.chunkSize) {
      throw new Error('The index checksum map is invalid.');
    }
    const nextOffset = expectedOffset + chunk.bytes;
    if (!Number.isSafeInteger(nextOffset)) throw new Error('The index checksum map is invalid.');
    expectedOffset = nextOffset;
  }
  if (expectedOffset !== manifest.bytes) {
    throw new Error('The index checksum map does not match its size.');
  }
  if (manifest.distribution !== 'production' && manifest.distribution !== 'engineering-fixture') {
    throw new Error('The index distribution marker is missing.');
  }
  if (
    !manifest.counts ||
    !isInt(manifest.counts.works) ||
    manifest.counts.works <= 0 ||
    !isInt(manifest.counts.series) ||
    !isInt(manifest.counts.universes) ||
    !isInt(manifest.counts.withSeries) ||
    !isInt(manifest.counts.withCover) ||
    manifest.counts.withSeries > manifest.counts.works ||
    manifest.counts.withCover > manifest.counts.works
  ) {
    throw new Error('The index work count is invalid.');
  }
  if (
    !manifest.sources ||
    typeof manifest.sources !== 'object' ||
    Array.isArray(manifest.sources) ||
    Object.keys(manifest.sources).length === 0 ||
    Object.entries(manifest.sources).some(
      ([source, count]) => !SAFE_SOURCE.test(source) || !isInt(count) || count <= 0,
    )
  ) {
    throw new Error('The index source ledger is invalid.');
  }

  return manifest as CorpusManifest;
}

export function corpusPath(version: string): string {
  if (!SAFE_VERSION.test(version)) throw new Error('The index version is invalid.');
  return `catalogue/corpus-${version}.sqlite`;
}

export function manifestPath(version: string): string {
  if (!SAFE_VERSION.test(version)) throw new Error('The index version is invalid.');
  return `catalogue/manifest-${version}.json`;
}

export function resumePath(version: string): string {
  if (!SAFE_VERSION.test(version)) throw new Error('The index version is invalid.');
  return `catalogue/install-${version}.json`;
}

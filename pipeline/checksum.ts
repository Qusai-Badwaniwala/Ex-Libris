import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';

/**
 * Runtime downloads are resumable one verified piece at a time. Web Crypto has
 * no streaming digest API, so a browser cannot safely verify a 600 MB file by
 * passing the whole thing to `crypto.subtle.digest`. The manifest therefore
 * carries fixed-size SHA-256 chunks as well as the traditional whole-file
 * checksum. Four MiB keeps the browser's peak verification memory bounded
 * without turning one install into thousands of HTTP requests.
 */
export const CORPUS_CHUNK_BYTES = 4 * 1024 * 1024;

export interface CorpusChunk {
  offset: number;
  bytes: number;
  sha256: string;
}

export function checksumFile(path: string): { sha256: string; chunks: CorpusChunk[] } {
  const whole = createHash('sha256');
  const chunks: CorpusChunk[] = [];
  const fd = openSync(path, 'r');
  let offset = 0;

  try {
    for (;;) {
      const buffer = Buffer.allocUnsafe(CORPUS_CHUNK_BYTES);
      const bytes = readSync(fd, buffer, 0, buffer.byteLength, offset);
      if (bytes === 0) break;
      const part = buffer.subarray(0, bytes);
      whole.update(part);
      chunks.push({
        offset,
        bytes,
        sha256: createHash('sha256').update(part).digest('hex'),
      });
      offset += bytes;
    }
  } finally {
    closeSync(fd);
  }

  return { sha256: whole.digest('hex'), chunks };
}

import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

/**
 * Pipeline plumbing: where things are cached, how a stage checkpoints, and how
 * to fetch something enormous without starting from zero when it fails.
 *
 * The whole design rests on one rule from the brief: the editions dump alone is
 * eleven gigabytes, and a stage that fails at 90% must not restart from the
 * beginning. So every stage writes JSONL to `.cache/` as it goes and records
 * how far it got. Rerunning a finished stage is a no-op; rerunning an
 * interrupted one resumes.
 */

export const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const CACHE = join(ROOT, 'pipeline', '.cache');
export const OUT = join(ROOT, 'public', 'corpus');

export function cachePath(...parts: string[]): string {
  const p = join(CACHE, ...parts);
  mkdirSync(dirname(p), { recursive: true });
  return p;
}

/* ── checkpoints ────────────────────────────────────────────────────────── */

export interface Checkpoint {
  done: boolean;
  /** Whatever the stage needs to pick up where it stopped: a page number, an
   *  offset, a cursor. Opaque to everything but the stage that wrote it. */
  cursor?: unknown;
  counts?: Record<string, number>;
  updatedAt?: string;
}

export function readCheckpoint(stage: string): Checkpoint {
  const p = cachePath(stage, 'checkpoint.json');
  if (!existsSync(p)) return { done: false };
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Checkpoint;
  } catch {
    // A half-written checkpoint is worse than none: it would make the stage
    // resume from a position it never actually reached.
    return { done: false };
  }
}

export function writeCheckpoint(stage: string, cp: Checkpoint): void {
  writeAtomic(
    cachePath(stage, 'checkpoint.json'),
    JSON.stringify({ ...cp, updatedAt: new Date().toISOString() }, null, 2),
  );
}

/**
 * Write to a sibling temp file and rename. A rename is atomic on both NTFS and
 * ext4, so a process killed mid-write leaves the previous file intact rather
 * than a truncated one that parses as valid JSON with half the rows.
 */
export function writeAtomic(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

/* ── JSONL ──────────────────────────────────────────────────────────────── */

/**
 * Append-only JSONL is the interchange format between stages. Not JSON: a
 * 600,000-row array has to be complete before it can be parsed, so a crash
 * costs the whole stage. A line is a row, and a truncated last line is the only
 * thing lost.
 */
export class JsonlWriter {
  private stream;
  private count = 0;

  constructor(path: string, append = false) {
    mkdirSync(dirname(path), { recursive: true });
    this.stream = createWriteStream(path, { flags: append ? 'a' : 'w' });
  }

  write(row: unknown): void {
    this.stream.write(`${JSON.stringify(row)}\n`);
    this.count++;
  }

  get written(): number {
    return this.count;
  }

  async close(): Promise<number> {
    await new Promise<void>((res, rej) =>
      this.stream.end((e: Error | null) => (e ? rej(e) : res())),
    );
    return this.count;
  }
}

/** Streams a JSONL file a row at a time. Never loads it into memory. */
export async function* readJsonl<T>(path: string): AsyncGenerator<T> {
  if (!existsSync(path)) return;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line) as T;
    } catch {
      // A torn final line from a killed process. Skipping it is correct;
      // failing the whole stage over it is not.
    }
  }
}

export function countLines(path: string): number {
  if (!existsSync(path)) return 0;
  const text = readFileSync(path, 'utf8');
  return text.length === 0 ? 0 : text.split('\n').filter((l) => l.trim()).length;
}

/* ── HTTP ───────────────────────────────────────────────────────────────── */

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Retries on 429, 5xx and network errors. */
  retries?: number;
}

/**
 * Fetch with backoff that respects Retry-After.
 *
 * AniList and MangaDex both rate-limit, and both say so in a header. Guessing a
 * delay when the server has told you the answer is how a polite client becomes
 * an impolite one.
 */
export async function fetchRetry(url: string, opts: FetchOptions = {}): Promise<Response> {
  const retries = opts.retries ?? 5;
  let wait = 1000;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: { 'user-agent': USER_AGENT, ...(opts.headers ?? {}) },
        ...(opts.body !== undefined ? { body: opts.body } : {}),
      });
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(wait);
      wait *= 2;
      continue;
    }
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      const after = Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(after) && after > 0 ? after * 1000 : wait;
      if (attempt === retries) return res;
      await sleep(delay);
      wait *= 2;
      continue;
    }
    return res; // 4xx other than 429: retrying will not help
  }
  throw new Error(`unreachable: ${url}`);
}

/**
 * Identifies the client honestly. A pipeline that runs monthly against free
 * public APIs should be attributable, so a maintainer who wants it to stop has
 * somewhere to look.
 */
export const USER_AGENT =
  'ExLibris/0.1 (personal offline reading tracker; single user; contact via github)';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Resumable download. Sends a Range header when a partial file is already on
 * disk, so a dropped connection eleven gigabytes in costs the remainder rather
 * than the whole thing.
 */
export async function downloadResumable(
  url: string,
  dest: string,
  onProgress?: (got: number, total: number | null) => void,
): Promise<{ bytes: number; resumed: boolean }> {
  mkdirSync(dirname(dest), { recursive: true });
  const have = existsSync(dest) ? statSync(dest).size : 0;

  const head = await fetchRetry(url, { method: 'HEAD' });
  const total = Number(head.headers.get('content-length')) || null;
  if (total !== null && have === total) return { bytes: have, resumed: true };

  const headers: Record<string, string> = {};
  if (have > 0) headers['range'] = `bytes=${have}-`;
  const res = await fetchRetry(url, { headers });

  // 200 to a Range request means the server ignored it: start over rather than
  // append a second copy of the file to the first.
  const append = have > 0 && res.status === 206;
  if (!res.body) throw new Error(`no body for ${url}`);

  let got = append ? have : 0;
  const out = createWriteStream(dest, { flags: append ? 'a' : 'w' });
  const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  body.on('data', (c: Buffer) => {
    got += c.length;
    onProgress?.(got, total);
  });
  await pipeline(body, out);
  return { bytes: got, resumed: append };
}

/** Streams a .gz line by line without ever holding it in memory. */
export async function* readGzipLines(path: string): AsyncGenerator<string> {
  const rl = createInterface({
    input: createReadStream(path).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of rl) yield line;
}

/* ── reporting ──────────────────────────────────────────────────────────── */

export function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export const n = (v: number) => v.toLocaleString('en-US');

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!;
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

/**
 * Writes a standards-compliant ZIP using stored entries. Backups favour a
 * small, dependency-free recovery surface over compression: cover images are
 * already compressed and JSON remains readable even with basic ZIP tools.
 */
export function createZip(entries: ZipEntry[]): Uint8Array {
  if (entries.length > 0xffff) throw new Error('The backup has too many ZIP entries.');
  const seen = new Set<string>();
  const encoded = entries.map((entry) => {
    if (!entry.name || entry.name.startsWith('/') || entry.name.includes('..')) {
      throw new Error(`Unsafe ZIP entry name: ${entry.name}`);
    }
    if (seen.has(entry.name)) throw new Error(`Duplicate ZIP entry: ${entry.name}`);
    seen.add(entry.name);
    return { ...entry, nameBytes: encoder.encode(entry.name), crc: crc32(entry.data) };
  });

  const localSize = encoded.reduce(
    (sum, entry) => sum + 30 + entry.nameBytes.length + entry.data.length,
    0,
  );
  const centralSize = encoded.reduce((sum, entry) => sum + 46 + entry.nameBytes.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  const offsets: number[] = [];
  let cursor = 0;

  for (const entry of encoded) {
    offsets.push(cursor);
    u32(view, cursor, 0x04034b50);
    u16(view, cursor + 4, 20);
    u16(view, cursor + 6, 0x0800);
    u16(view, cursor + 8, 0);
    u16(view, cursor + 10, 0);
    u16(view, cursor + 12, 0);
    u32(view, cursor + 14, entry.crc);
    u32(view, cursor + 18, entry.data.length);
    u32(view, cursor + 22, entry.data.length);
    u16(view, cursor + 26, entry.nameBytes.length);
    u16(view, cursor + 28, 0);
    output.set(entry.nameBytes, cursor + 30);
    output.set(entry.data, cursor + 30 + entry.nameBytes.length);
    cursor += 30 + entry.nameBytes.length + entry.data.length;
  }

  const centralOffset = cursor;
  encoded.forEach((entry, index) => {
    u32(view, cursor, 0x02014b50);
    u16(view, cursor + 4, 20);
    u16(view, cursor + 6, 20);
    u16(view, cursor + 8, 0x0800);
    u16(view, cursor + 10, 0);
    u16(view, cursor + 12, 0);
    u16(view, cursor + 14, 0);
    u32(view, cursor + 16, entry.crc);
    u32(view, cursor + 20, entry.data.length);
    u32(view, cursor + 24, entry.data.length);
    u16(view, cursor + 28, entry.nameBytes.length);
    u16(view, cursor + 30, 0);
    u16(view, cursor + 32, 0);
    u16(view, cursor + 34, 0);
    u16(view, cursor + 36, 0);
    u32(view, cursor + 38, 0);
    u32(view, cursor + 42, offsets[index]!);
    output.set(entry.nameBytes, cursor + 46);
    cursor += 46 + entry.nameBytes.length;
  });

  u32(view, cursor, 0x06054b50);
  u16(view, cursor + 4, 0);
  u16(view, cursor + 6, 0);
  u16(view, cursor + 8, encoded.length);
  u16(view, cursor + 10, encoded.length);
  u32(view, cursor + 12, centralSize);
  u32(view, cursor + 16, centralOffset);
  u16(view, cursor + 20, 0);
  return output;
}

/** Reads the uncompressed ZIPs Ex Libris writes and verifies every CRC. */
export function readZip(buffer: ArrayBuffer): Map<string, Uint8Array> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 22) throw new Error('That file is not a readable Ex Libris ZIP.');
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('That file is not a readable Ex Libris ZIP.');
  if (view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true)) {
    throw new Error('Multi-part ZIP backups are not supported.');
  }
  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (centralOffset + centralSize > eocd) throw new Error('The ZIP directory is incomplete.');
  let cursor = centralOffset;
  const result = new Map<string, Uint8Array>();

  for (let index = 0; index < count; index++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('The ZIP directory is incomplete.');
    }
    const method = view.getUint16(cursor + 10, true);
    const expectedCrc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const nameEnd = cursor + 46 + nameLength;
    if (nameEnd > bytes.length) throw new Error('The ZIP filename is incomplete.');
    const name = decoder.decode(bytes.slice(cursor + 46, nameEnd));
    if (!name || name.startsWith('/') || name.includes('..') || result.has(name)) {
      throw new Error('The ZIP contains an unsafe or duplicate path.');
    }
    if (method !== 0 || compressedSize !== uncompressedSize) {
      throw new Error('This backup uses a ZIP compression method Ex Libris does not write.');
    }
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error('A ZIP entry is missing its local header.');
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localNameEnd = localOffset + 30 + localNameLength;
    if (
      localNameEnd > bytes.length ||
      decoder.decode(bytes.slice(localOffset + 30, localNameEnd)) !== name ||
      view.getUint16(localOffset + 8, true) !== method ||
      view.getUint32(localOffset + 14, true) !== expectedCrc ||
      view.getUint32(localOffset + 18, true) !== compressedSize ||
      view.getUint32(localOffset + 22, true) !== uncompressedSize
    ) {
      throw new Error('A ZIP local header does not match its directory entry.');
    }
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error('A ZIP entry is incomplete.');
    const data = bytes.slice(dataStart, dataEnd);
    if (crc32(data) !== expectedCrc) throw new Error(`The ZIP entry ${name} failed its checksum.`);
    result.set(name, data);
    cursor = nameEnd + extraLength + commentLength;
  }
  return result;
}

import type { TextColor } from '../db/schema';

export interface PixelBuffer {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

interface ColorBucket {
  count: number;
  red: number;
  green: number;
  blue: number;
}

const channelHex = (value: number): string =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

const rgbHex = (red: number, green: number, blue: number): string =>
  `#${channelHex(red)}${channelHex(green)}${channelHex(blue)}`;

/**
 * Stable, deliberately small colour extractor. Quantising into 32-value RGB
 * buckets prevents compression noise from making every pixel a different
 * colour. The winning bucket is averaged from its original pixels; ties are
 * resolved by the numeric bucket key, so the same bytes always give the same
 * answer on every render.
 */
export function dominantColorFromPixels(pixels: PixelBuffer): string {
  const expected = pixels.width * pixels.height * 4;
  if (pixels.width <= 0 || pixels.height <= 0 || pixels.data.length < expected) {
    return rgbHex(0, 0, 0);
  }

  const buckets = new Map<number, ColorBucket>();
  for (let index = 0; index < expected; index += 4) {
    const alpha = pixels.data[index + 3] ?? 0;
    if (alpha < 128) continue;

    const red = pixels.data[index] ?? 0;
    const green = pixels.data[index + 1] ?? 0;
    const blue = pixels.data[index + 2] ?? 0;
    const key =
      (Math.floor(red / 32) << 10) | (Math.floor(green / 32) << 5) | Math.floor(blue / 32);
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }

  let winnerKey = Number.POSITIVE_INFINITY;
  let winner: ColorBucket | undefined;
  for (const [key, bucket] of buckets) {
    if (
      !winner ||
      bucket.count > winner.count ||
      (bucket.count === winner.count && key < winnerKey)
    ) {
      winner = bucket;
      winnerKey = key;
    }
  }
  // The browser processor requests an opaque canvas, so this is reachable only
  // for a malformed injected buffer. Transparent pixels have zero RGB channels;
  // derive that fact rather than introducing a design colour into storage code.
  if (!winner) return rgbHex(0, 0, 0);

  return rgbHex(winner.red / winner.count, winner.green / winner.count, winner.blue / winner.count);
}

function srgbToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number | null {
  const match = /^#([\dA-F]{2})([\dA-F]{2})([\dA-F]{2})$/i.exec(color);
  if (!match) return null;
  const red = srgbToLinear(Number.parseInt(match[1]!, 16));
  const green = srgbToLinear(Number.parseInt(match[2]!, 16));
  const blue = srgbToLinear(Number.parseInt(match[3]!, 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The flag names the text colour that has the stronger WCAG contrast. */
export function contrastTextForColor(color: string): TextColor {
  const luminance = relativeLuminance(color);
  if (luminance === null) return 'light';
  const lightContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return darkContrast >= lightContrast ? 'dark' : 'light';
}

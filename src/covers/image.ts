import type { TextColor } from '../db/schema';
import { contrastTextForColor, dominantColorFromPixels } from './color';

export const COVER_MAX_WIDTH = 600;
export const COVER_MAX_PIXELS = 720_000;
export const COVER_MAX_INPUT_BYTES = 20 * 1024 * 1024;

const ACCEPTED_INPUT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export class InvalidCoverImage extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCoverImage';
  }
}

export interface CoverDimensions {
  width: number;
  height: number;
}

export interface ProcessedCover extends CoverDimensions {
  blob: Blob;
  mimeType: 'image/webp' | 'image/png' | 'image/jpeg';
  extension: 'webp' | 'png' | 'jpg';
  dominantColor: string;
  textColor: TextColor;
}

export interface CoverImageProcessor {
  process(blob: Blob): Promise<ProcessedCover>;
}

export function validateCoverBlob(blob: Blob): void {
  if (blob.size <= 0) throw new InvalidCoverImage('The selected cover is empty.');
  if (blob.size > COVER_MAX_INPUT_BYTES) {
    throw new InvalidCoverImage('The cover is larger than the 20 MB safety limit.');
  }
  const type = blob.type.toLowerCase().split(';', 1)[0] ?? '';
  if (!ACCEPTED_INPUT_TYPES.has(type)) {
    throw new InvalidCoverImage('Choose a JPEG, PNG, WebP, AVIF or GIF image.');
  }
}

/** Bounds width and decoded pixel cost without ever enlarging the source. */
export function fittedCoverDimensions(
  width: number,
  height: number,
  maxWidth = COVER_MAX_WIDTH,
  maxPixels = COVER_MAX_PIXELS,
): CoverDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new InvalidCoverImage('The cover has unreadable dimensions.');
  }
  const scale = Math.min(1, maxWidth / width, Math.sqrt(maxPixels / (width * height)));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

type DrawableImage = CanvasImageSource & { width: number; height: number; close?: () => void };

async function decodeWithImageElement(blob: Blob): Promise<DrawableImage> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new InvalidCoverImage('This browser cannot decode cover images.');
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new InvalidCoverImage('The file could not be decoded as an image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeImage(blob: Blob): Promise<DrawableImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      throw new InvalidCoverImage('The file could not be decoded as an image.');
    }
  }
  return decodeWithImageElement(blob);
}

async function htmlCanvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new InvalidCoverImage('The cover could not be encoded.')),
      type,
      quality,
    );
  });
}

function encodedType(blob: Blob): Pick<ProcessedCover, 'mimeType' | 'extension'> {
  if (blob.type === 'image/webp') return { mimeType: 'image/webp', extension: 'webp' };
  if (blob.type === 'image/jpeg') return { mimeType: 'image/jpeg', extension: 'jpg' };
  return { mimeType: 'image/png', extension: 'png' };
}

/**
 * Browser implementation. The image is rasterised once, and colour extraction
 * happens from that same output before it is committed to OPFS.
 */
export const browserCoverImageProcessor: CoverImageProcessor = {
  async process(blob) {
    validateCoverBlob(blob);
    const image = await decodeImage(blob);
    try {
      const dimensions = fittedCoverDimensions(image.width, image.height);
      let context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
      let encoded: Blob;
      let pixels: ImageData;

      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
        context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new InvalidCoverImage('This browser cannot process cover images.');
        context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
        pixels = context.getImageData(0, 0, dimensions.width, dimensions.height);
        encoded = await canvas.convertToBlob({ type: 'image/webp', quality: 0.84 });
      } else {
        if (typeof document === 'undefined') {
          throw new InvalidCoverImage('This browser cannot process cover images.');
        }
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new InvalidCoverImage('This browser cannot process cover images.');
        context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
        pixels = context.getImageData(0, 0, dimensions.width, dimensions.height);
        encoded = await htmlCanvasBlob(canvas, 'image/webp', 0.84);
      }

      const dominantColor = dominantColorFromPixels(pixels);
      return {
        blob: encoded,
        ...dimensions,
        ...encodedType(encoded),
        dominantColor,
        textColor: contrastTextForColor(dominantColor),
      };
    } finally {
      image.close?.();
    }
  },
};

export interface FetchCoverOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

/** One bounded, user-relevant request; a response header alone is not trusted. */
export async function fetchCoverBlob(url: string, options: FetchCoverOptions = {}): Promise<Blob> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InvalidCoverImage('The cover address is invalid.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new InvalidCoverImage('The cover address must use HTTP or HTTPS.');
  }

  const response = await (options.fetcher ?? fetch)(parsed.href, {
    headers: { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
    signal: options.signal,
  });
  if (!response.ok) throw new InvalidCoverImage(`The cover request failed (${response.status}).`);

  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > COVER_MAX_INPUT_BYTES) {
    throw new InvalidCoverImage('The cover is larger than the 20 MB safety limit.');
  }
  const declaredType = (response.headers.get('content-type') ?? '').toLowerCase().split(';', 1)[0];
  if (!declaredType?.startsWith('image/')) {
    throw new InvalidCoverImage('The cover address did not return an image.');
  }

  const blob = await response.blob();
  validateCoverBlob(blob);
  return blob;
}

import { BoxConfig } from '../types';

/**
 * Cached, pre-decoded grayscale + alpha representation of a source image.
 * Decoding (drawImage + getImageData + RGB→gray conversion) is the expensive
 * part of image processing — it only needs to happen once per source image
 * (or when rasterResolution changes). Threshold/invert/bypassThreshold only
 * need a cheap single-pass re-scan of this cached data, not a full re-decode.
 */
export interface DecodedImage {
  gray: Uint8ClampedArray;
  alpha: Uint8Array;
  width: number;
  height: number;
}

/** Heavy step: decode + downscale + grayscale-convert an image once. */
export function decodeImageToGray(img: HTMLImageElement, maxDim: number): DecodedImage {
  const canvas = document.createElement('canvas');
  let w = img.width;
  let h = img.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const total = w * h;

  const gray  = new Uint8ClampedArray(total);
  const alpha = new Uint8Array(total);

  for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
    alpha[idx] = data[i + 3];
    gray[idx]  = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
  }

  return { gray, alpha, width: w, height: h };
}

/** Cheap step: threshold/invert a cached decode. Safe to re-run on every slider change. */
export function applyThreshold(decoded: DecodedImage, config: BoxConfig): Uint8ClampedArray {
  const { gray, alpha, width, height } = decoded;
  const total = width * height;
  const binaryData = new Uint8ClampedArray(total);

  // bypassThreshold: image is already a silhouette — skip dynamic threshold,
  // use a fixed gray < 128 cutoff so no extra processing distorts the shape.
  const cutoff = config.bypassThreshold ? 128 : config.threshold;
  const invert = config.invert;

  for (let idx = 0; idx < total; idx++) {
    // Transparent pixels are always background regardless of invert
    if (alpha[idx] < 128) { binaryData[idx] = 0; continue; }
    let isForeground = gray[idx] < cutoff;
    if (invert) isForeground = !isForeground;
    binaryData[idx] = isForeground ? 255 : 0;
  }

  (binaryData as any).width  = width;
  (binaryData as any).height = height;
  return binaryData;
}

/** Heavy step: rasterize + decode an SVG string into cached grayscale + alpha, once. */
export async function decodeSvgToGray(svgText: string, maxDim: number): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.naturalWidth || maxDim;
      let h = img.naturalHeight || maxDim;

      if (w === 0 || h === 0) { w = maxDim; h = maxDim; }

      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { reject(new Error('No canvas context')); return; }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const total = w * h;

      const gray  = new Uint8ClampedArray(total);
      const alpha = new Uint8Array(total);

      for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
        alpha[idx] = data[i + 3];
        gray[idx]  = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
      }

      resolve({ gray, alpha, width: w, height: h });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };

    img.src = url;
  });
}

export type DotFilterColor = 'white' | 'black' | 'both';

export function removeSmallComponents(
  binaryData: Uint8ClampedArray,
  minSize: number,
  color: DotFilterColor = 'white',
): Uint8ClampedArray {
  if (minSize <= 1) return binaryData;

  const targets: number[] =
    color === 'both' ? [255, 0] : color === 'white' ? [255] : [0];

  let current = binaryData;
  for (const target of targets) {
    current = removeSmallComponentsOfColor(current, minSize, target);
  }
  return current;
}

function removeSmallComponentsOfColor(
  binaryData: Uint8ClampedArray,
  minSize: number,
  target: number,
): Uint8ClampedArray {
  const width  = (binaryData as any).width  as number;
  const height = (binaryData as any).height as number;
  const total  = width * height;

  const visited = new Uint8Array(total);
  const result  = new Uint8ClampedArray(binaryData);
  (result as any).width  = width;
  (result as any).height = height;

  const fillValue = target === 255 ? 0 : 255;

  for (let start = 0; start < total; start++) {
    if (binaryData[start] !== target || visited[start]) continue;

    const component: number[] = [start];
    visited[start] = 1;
    let head = 0;

    while (head < component.length) {
      const idx = component[head++];
      const x   = idx % width;
      const y   = (idx / width) | 0;

      if (y > 0          && binaryData[idx - width] === target && !visited[idx - width]) { visited[idx - width] = 1; component.push(idx - width); }
      if (y < height - 1 && binaryData[idx + width] === target && !visited[idx + width]) { visited[idx + width] = 1; component.push(idx + width); }
      if (x > 0          && binaryData[idx - 1]     === target && !visited[idx - 1])     { visited[idx - 1]     = 1; component.push(idx - 1);     }
      if (x < width - 1  && binaryData[idx + 1]     === target && !visited[idx + 1])     { visited[idx + 1]     = 1; component.push(idx + 1);     }
    }

    if (component.length < minSize) {
      for (const i of component) result[i] = fillValue;
    }
  }

  return result;
}

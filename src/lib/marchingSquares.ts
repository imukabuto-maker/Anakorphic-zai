import { Path, Point } from '../types';

// Marching squares with:
//   - numeric packed adjacency keys (no string hashing / GC churn)
//   - flat Float64Array segment buffer (p1x,p1y,p2x,p2y per segment)
//   - inline bounds check (no pxFloat function call)
//   - no per-point object spread when chaining

const TABLE: Array<Array<Array<[number, number]>>> = (() => {
  const t: Record<number, Array<[number, number][]>> = {
    0:  [[]],
    1:  [[[3, 0]]],
    2:  [[[0, 1]]],
    3:  [[[3, 1]]],
    4:  [[[1, 2]]],
    5:  [[[3, 2], [0, 1]], [[3, 0], [1, 2]]],
    6:  [[[0, 2]]],
    7:  [[[3, 2]]],
    8:  [[[2, 3]]],
    9:  [[[2, 0]]],
    10: [[[2, 1], [3, 0]], [[2, 3], [0, 1]]],
    11: [[[2, 1]]],
    12: [[[1, 3]]],
    13: [[[1, 0]]],
    14: [[[0, 3]]],
    15: [[]],
  };
  const arr: Array<Array<Array<[number, number]>>> = new Array(16);
  for (let i = 0; i < 16; i++) arr[i] = t[i];
  return arr;
})();

export function marchingSquares(binaryData: Uint8ClampedArray): Path[] {
  const width  = (binaryData as any).width  as number;
  const height = (binaryData as any).height as number;
  if (!width || !height) return [];

  // Pre-allocate a large flat buffer, grow if needed
  let capacity = Math.max(1024, width * 2);
  let segData = new Float64Array(capacity * 4);
  let segCount = 0;

  const pushSeg = (x1: number, y1: number, x2: number, y2: number) => {
    if (segCount === capacity) {
      capacity *= 2;
      const next = new Float64Array(capacity * 4);
      next.set(segData);
      segData = next;
    }
    const o = segCount * 4;
    segData[o] = x1; segData[o + 1] = y1; segData[o + 2] = x2; segData[o + 3] = y2;
    segCount++;
  };

  const lerp = (a: number, b: number): number => {
    const d = b - a;
    if (d > -1e-6 && d < 1e-6) return 0.5;
    return (0.5 - a) / d;
  };

  for (let y = -1; y < height; y++) {
    for (let x = -1; x < width; x++) {
      const x0 = x, x1 = x + 1, y0 = y, y1 = y + 1;

      // Inline bounds: outside → 0
      const tl = (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height && binaryData[y0 * width + x0] > 0) ? 1 : 0;
      const tr = (x1 >= 0 && x1 < width && y0 >= 0 && y0 < height && binaryData[y0 * width + x1] > 0) ? 1 : 0;
      const br = (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height && binaryData[y1 * width + x1] > 0) ? 1 : 0;
      const bl = (x0 >= 0 && x0 < width && y1 >= 0 && y1 < height && binaryData[y1 * width + x0] > 0) ? 1 : 0;

      const caseIdx = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (caseIdx === 0 || caseIdx === 15) continue;

      const variants = TABLE[caseIdx];
      let edgePairs: Array<[number, number]>;
      if (variants.length === 1) {
        edgePairs = variants[0];
      } else {
        const avg = (bl + br + tr + tl) * 0.25;
        edgePairs = avg >= 0.5 ? variants[0] : variants[1];
      }

      for (let k = 0; k < edgePairs.length; k++) {
        const e1 = edgePairs[k][0], e2 = edgePairs[k][1];
        // getPt inlined
        let ax = 0, ay = 0, bx = 0, by = 0;
        // edge 0: bottom, 1: right, 2: top, 3: left
        // Using x0/y0/x1/y1
        switch (e1) {
          case 0: { const t = lerp(bl, br); ax = x0 + t; ay = y1; break; }
          case 1: { const t = lerp(br, tr); ax = x1;     ay = y1 - t; break; }
          case 2: { const t = lerp(tl, tr); ax = x0 + t; ay = y0; break; }
          case 3: { const t = lerp(bl, tl); ax = x0;     ay = y1 - t; break; }
        }
        switch (e2) {
          case 0: { const t = lerp(bl, br); bx = x0 + t; by = y1; break; }
          case 1: { const t = lerp(br, tr); bx = x1;     by = y1 - t; break; }
          case 2: { const t = lerp(tl, tr); bx = x0 + t; by = y0; break; }
          case 3: { const t = lerp(bl, tl); bx = x0;     by = y1 - t; break; }
        }
        pushSeg(ax, ay, bx, by);
      }
    }
  }

  if (segCount === 0) return [];

  // Adjacency map with packed numeric keys.
  // Points sit on half-integer grid (x*2, y*2 are integers) → multiply by 2 and round.
  // Coords range: -1 .. width, so shift by +2 to keep positive, then pack.
  const SHIFT = 2;
  const STRIDE = (width + 4) * 2 + 4; // safe upper bound for (y*2 + shift)
  const key = (x: number, y: number) =>
    ((x * 2 + SHIFT) | 0) * STRIDE + ((y * 2 + SHIFT) | 0);

  const adj = new Map<number, number[]>();
  for (let i = 0; i < segCount; i++) {
    const o = i * 4;
    const k1 = key(segData[o],     segData[o + 1]);
    const k2 = key(segData[o + 2], segData[o + 3]);
    let a = adj.get(k1); if (a) a.push(i); else adj.set(k1, [i]);
    let b = adj.get(k2); if (b) b.push(i); else adj.set(k2, [i]);
  }

  const used = new Uint8Array(segCount);
  const paths: Path[] = [];
  const invW = 1 / width, invH = 1 / height;

  for (let start = 0; start < segCount; start++) {
    if (used[start]) continue;
    used[start] = 1;

    const o = start * 4;
    let p1x = segData[o],     p1y = segData[o + 1];
    let p2x = segData[o + 2], p2y = segData[o + 3];

    // Grow chain forwards from p2, then backwards from p1.
    const forward: number[] = [p2x, p2y];
    let hx = p2x, hy = p2y;

    for (;;) {
      const neighbours = adj.get(key(hx, hy));
      if (!neighbours) break;
      let advanced = false;
      for (let j = 0; j < neighbours.length; j++) {
        const ni = neighbours[j];
        if (used[ni]) continue;
        used[ni] = 1;
        const oo = ni * 4;
        const sx1 = segData[oo], sy1 = segData[oo + 1];
        const sx2 = segData[oo + 2], sy2 = segData[oo + 3];
        if (key(sx1, sy1) === key(hx, hy)) { hx = sx2; hy = sy2; }
        else                                { hx = sx1; hy = sy1; }
        forward.push(hx, hy);
        advanced = true;
        break;
      }
      if (!advanced) break;
    }

    const backward: number[] = [];
    let tx = p1x, ty = p1y;
    for (;;) {
      const neighbours = adj.get(key(tx, ty));
      if (!neighbours) break;
      let advanced = false;
      for (let j = 0; j < neighbours.length; j++) {
        const ni = neighbours[j];
        if (used[ni]) continue;
        used[ni] = 1;
        const oo = ni * 4;
        const sx1 = segData[oo], sy1 = segData[oo + 1];
        const sx2 = segData[oo + 2], sy2 = segData[oo + 3];
        if (key(sx1, sy1) === key(tx, ty)) { tx = sx2; ty = sy2; }
        else                                { tx = sx1; ty = sy1; }
        backward.push(tx, ty);
        advanced = true;
        break;
      }
      if (!advanced) break;
    }

    // Assemble: reverse(backward) + p1 + p2 + forward (skipping first of forward = p2 already? no — forward starts with p2)
    const chain: Path = [];
    for (let i = backward.length - 2; i >= 0; i -= 2) {
      chain.push({ x: backward[i] * invW, y: backward[i + 1] * invH });
    }
    chain.push({ x: p1x * invW, y: p1y * invH });
    for (let i = 0; i < forward.length; i += 2) {
      chain.push({ x: forward[i] * invW, y: forward[i + 1] * invH });
    }

    if (chain.length >= 2) paths.push(chain);
  }

  return paths;
}

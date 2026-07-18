import { Point } from '../types';

function perpDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  const nx = ax + t * dx;
  const ny = ay + t * dy;
  return Math.hypot(px - nx, py - ny);
}

/**
 * Iterative Ramer-Douglas-Peucker path simplification.
 * Uses an index-stack + keep-mask to avoid O(n) array slicing per recursion frame.
 */
export function rdpSimplify(points: Point[], epsilon: number): Point[] {
  const n = points.length;
  if (n <= 2) return points;

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  // Stack of [firstIdx, lastIdx] ranges, packed as pairs in a flat Int32Array.
  const stack = new Int32Array(n * 2);
  let sp = 0;
  stack[sp++] = 0;
  stack[sp++] = n - 1;

  while (sp > 0) {
    const last  = stack[--sp];
    const first = stack[--sp];
    if (last - first < 2) continue;

    const ax = points[first].x, ay = points[first].y;
    const bx = points[last].x,  by = points[last].y;

    let maxDist = 0;
    let maxIdx  = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i];
      const d = perpDistance(p.x, p.y, ax, ay, bx, by);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }

    if (maxDist > epsilon && maxIdx > 0) {
      keep[maxIdx] = 1;
      stack[sp++] = first;
      stack[sp++] = maxIdx;
      stack[sp++] = maxIdx;
      stack[sp++] = last;
    }
  }

  const out: Point[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/**
 * Catmull-Rom → cubic bezier smoothing.
 */
export function smoothPathToSvg(points: Point[], closed: boolean, tension = 1): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${fmt(points[0].x)},${fmt(points[0].y)}`;
  if (n === 2) {
    return `M ${fmt(points[0].x)},${fmt(points[0].y)} L ${fmt(points[1].x)},${fmt(points[1].y)}`;
  }

  const pt = (i: number): Point => {
    if (closed) return points[((i % n) + n) % n];
    if (i < 0) { const p0 = points[0], p1 = points[1]; return { x: 2 * p0.x - p1.x, y: 2 * p0.y - p1.y }; }
    if (i >= n) { const pn = points[n - 1], pn1 = points[n - 2]; return { x: 2 * pn.x - pn1.x, y: 2 * pn.y - pn1.y }; }
    return points[i];
  };

  const start = points[0];
  // Preallocate string parts
  const parts: string[] = new Array(n);
  parts[0] = `M ${fmt(start.x)},${fmt(start.y)}`;
  const end = closed ? n : n - 1;
  const t6 = tension / 6;

  for (let i = 0; i < end; i++) {
    const p0 = pt(i - 1);
    const p1 = pt(i);
    const p2 = pt(i + 1);
    const p3 = pt(i + 2);

    const cp1x = p1.x + (p2.x - p0.x) * t6;
    const cp1y = p1.y + (p2.y - p0.y) * t6;
    const cp2x = p2.x - (p3.x - p1.x) * t6;
    const cp2y = p2.y - (p3.y - p1.y) * t6;

    parts[i + 1] = `C ${fmt(cp1x)},${fmt(cp1y)} ${fmt(cp2x)},${fmt(cp2y)} ${fmt(p2.x)},${fmt(p2.y)}`;
  }

  return parts.join(' ') + (closed ? ' Z' : '');
}

function fmt(v: number): string { return v.toFixed(4); }

export function simplifyAndSmooth(points: Point[], epsilon: number, closed = false): string {
  const simplified = rdpSimplify(points, epsilon);
  return smoothPathToSvg(simplified, closed);
}

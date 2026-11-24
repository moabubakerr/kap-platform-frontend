import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Short form of an ID for display: first 8 characters. */
export const shortId = (id: string) => id.replace(/-/g, '').slice(0, 8);

export const fmtInt = (n: number) => n.toLocaleString('en-GB');

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

/** SVG polyline points for a series scaled into a w×h box (y inverted). */
export function linePoints(values: number[], w: number, h: number, pad = 4, min?: number, max?: number) {
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => [i * step, h - pad - ((v - lo) / span) * (h - pad * 2)] as const);
}

export const toPolyline = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

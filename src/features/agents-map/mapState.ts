import * as React from 'react';

export type MapMode = 'live' | '1h' | '24h' | '7d';

export const MODES: { key: MapMode; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: '1h', label: 'Last 1 h' },
  { key: '24h', label: '24 h' },
  { key: '7d', label: '7 d' },
];

export const RANGE_LABEL: Record<MapMode, string> = { live: 'Live', '1h': 'Last 1 h', '24h': 'Last 24 h', '7d': 'Last 7 d' };

export const ZOOM_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25];
export const ZOOM_FIT = 0.6;

export const CANVAS_W = 1840;
export const VIEW_H = 680;

/** Canvas geometry depends on whether the deprecated band is shown. */
export const canvasGeom = (showDeprecated: boolean) => ({ h: showDeprecated ? 1030 : 850, kapY: showDeprecated ? 1012 : 828 });

export function zoomStep(zoom: number, dir: 1 | -1) {
  const i = Math.max(0, ZOOM_STEPS.indexOf(zoom));
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))];
}

/** True when the user asked for reduced motion (particles are skipped). */
export function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduce, setReduce] = React.useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  React.useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setReduce(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

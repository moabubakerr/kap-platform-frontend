/**
 * Mock live-event generator for the Agents map (README §10). Emits a
 * snapshot of in-flight Ask AI messages on an interval; the map uses it for
 * the "N in flight" badge, the queue node metric and the footer ticker.
 * Replace with an SSE/WebSocket subscription when the backend exists.
 */
import { INITIAL_TICKER, type TickerItem } from './agentsMap';

export interface LiveSnapshot {
  inFlight: number;
  waiting: number;
  ticker: TickerItem[];
}

const STAGES: TickerItem[] = [
  { text: 'Intent Agent', color: '#8A1538' },
  { text: 'resolving', color: '#8C8487' },
  { text: 'Indicator Picker', color: 'var(--warning)' },
  { text: 'computing', color: '#8C8487' },
  { text: 'composing', color: 'var(--info)' },
  { text: 'verifying', color: 'var(--success)' },
  { text: 'Oxford EconomicData', color: '#0F766E' },
  { text: 'Article retrieval', color: '#C8B49A' },
];

export const INITIAL_LIVE: LiveSnapshot = { inFlight: 6, waiting: 1, ticker: INITIAL_TICKER };

/** Subscribe to mock live events. Returns an unsubscribe function. */
export function subscribeLive(onEvent: (s: LiveSnapshot) => void, intervalMs = 2600): () => void {
  let seq = 0x7f21c1;
  let snap = INITIAL_LIVE;
  const id = window.setInterval(() => {
    const stage = STAGES[Math.floor(Math.random() * STAGES.length)];
    const lang = Math.random() < 0.38 ? 'AR' : 'EN';
    const item: TickerItem = { text: `msg ${(seq++).toString(16)} · ${lang} · ${stage.text}`, color: stage.color };
    const drift = Math.random() < 0.5 ? -1 : 1;
    const inFlight = Math.min(8, Math.max(4, snap.inFlight + drift));
    snap = { inFlight, waiting: inFlight >= 7 ? 2 : inFlight <= 4 ? 0 : 1, ticker: [item, ...snap.ticker].slice(0, 3) };
    onEvent(snap);
  }, intervalMs);
  return () => window.clearInterval(id);
}

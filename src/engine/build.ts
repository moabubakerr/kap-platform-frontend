/**
 * Small builders matching the prototype's helpers (`cell`, `act`, `fr`, `kv`,
 * `stP`) so screen builders read like the design reference.
 */
import type { Action, Cell, DsStatus, KV, Row } from './types';

export const cell = (v: unknown, o?: { m?: boolean; sub?: string; tip?: string; p?: [DsStatus, string] }): Cell => ({
  v: v == null ? '' : String(v),
  m: !!o?.m,
  sub: o?.sub || undefined,
  tip: o?.tip || undefined,
  p: o?.p,
});

export const pill = (status: DsStatus, label: string): Cell => cell('', { p: [status, label] });

export const act = (l: string, f: () => void, v?: Action['v']): Action => ({ l, f, v: v ?? 'outline' });

export const kv = (pairs: ([string, unknown] | [string, unknown, boolean] | false | null | undefined)[]): KV[] =>
  pairs.filter(Boolean).map((p) => {
    const [k, v, m] = p as [string, unknown, boolean?];
    return { k, v: v == null || v === '' ? '—' : String(v), mono: !!m };
  });

/** A row of a form section: label · value (+ sub) · actions. */
export const fr = (label: string, value: unknown, sub?: string, acts?: Action[], o?: { tip?: string; lock?: string }): Row => ({
  key: `f:${label}`,
  cells: [cell(label, { tip: o?.tip }), cell(value, { sub })],
  acts: acts ?? [],
  lockTip: o?.lock,
});

/** Job / run status → design-system pill. */
export const statusPill = (s: string): [DsStatus, string] =>
  (
    ({
      Succeeded: ['approved', 'Succeeded'],
      Failed: ['rejected', 'Failed'],
      Running: ['submitted', 'Running'],
      Queued: ['draft', 'Queued'],
      Waiting: ['draft', 'Waiting'],
      Cancelled: ['draft', 'Cancelled'],
      Reproduction: ['hold', 'Reproduction'],
    }) as Record<string, [DsStatus, string]>
  )[s] ?? ['draft', s];

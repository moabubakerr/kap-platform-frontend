/**
 * Canvas spec of a workflow graph (port of the prototype's `wfMap`): node boxes
 * with tones (by kind, issue, or test/replay state), edges with dash and tone,
 * optional tool nodes and the legend. Used by the designer canvas and by the
 * static previews (create wizard). Edge geometry mirrors `src/engine/Diagram.tsx`.
 */
import type { DiagramEdge, DiagramNode, DiagramSpec } from '@/engine/types';
import { KL, KTONE, NH, NW, runOrder, wfLayout, type PathSt, type WfCfg } from './model';

export type Tone = NonNullable<DiagramNode['tone']>;

export const TONE: Record<Tone, [string, string, string, string, string]> = {
  base: ['var(--surface-card)', 'var(--border-strong)', 'var(--text-strong)', 'var(--text-muted)', ''],
  brand: ['var(--brand-tint)', 'var(--brand)', 'var(--brand)', 'var(--text-muted)', ''],
  out: ['var(--teal-tint)', '#0F766E', '#0F766E', 'var(--text-muted)', ''],
  off: ['var(--surface-sunken)', 'var(--border-default)', 'var(--text-subtle)', 'var(--text-subtle)', '4 3'],
  ref: ['var(--surface-card)', 'var(--border-strong)', 'var(--text-body)', 'var(--text-muted)', '5 4'],
  ok: ['var(--success-bg)', 'var(--success)', 'var(--success-fg)', 'var(--success-fg)', ''],
  bad: ['var(--danger-bg)', 'var(--danger)', 'var(--danger-fg)', 'var(--danger-fg)', ''],
  warn: ['var(--warning-bg)', 'var(--warning)', 'var(--warning-fg)', 'var(--warning-fg)', ''],
  run: ['var(--info-bg)', 'var(--info)', 'var(--info)', 'var(--info)', ''],
  skip: ['var(--surface-sunken)', 'var(--border-default)', 'var(--text-muted)', 'var(--text-muted)', '2 3'],
};
export const EDGE_C: Record<string, string> = { ok: 'var(--success)', bad: 'var(--danger)', off: 'var(--border-default)', ref: 'var(--text-subtle)', brand: 'var(--brand)' };

export interface CanvasNode extends DiagramNode { kind: string }
export interface CanvasEdge extends DiagramEdge { i: number }
export interface CanvasSpec { nodes: CanvasNode[]; edges: CanvasEdge[]; legend: [string, Tone][] }

/** A test run or replay overlaid on the canvas. */
export interface RunOverlay { path: Record<string, PathSt>; running: boolean; stepI: number }

export interface MapOpts {
  sel?: string | null;
  test?: RunOverlay | null;
  /** tools of an agent (shows tool nodes under agent steps) */
  tools?: ((agent: string) => string[]) | null;
  toolOff?: (t: string) => boolean;
  /** ids with issues (node ids or 'e:<i>') */
  iss?: Set<string>;
  /** disabled agents */
  disabled?: (agent: string) => boolean;
}

export function wfMap(cfg: Pick<WfCfg, 'nodes' | 'edges' | 'pos'>, o: MapOpts = {}): CanvasSpec {
  const N = cfg.nodes, E = cfg.edges;
  const P0 = cfg.pos && N.every((n) => cfg.pos[n[0]]) ? cfg.pos : wfLayout(cfg);
  const P: Record<string, { x: number; y: number }> = {};
  N.forEach((n) => { const p = P0[n[0]] || [0, 0]; P[n[0]] = { x: p[0], y: p[1] }; });
  const iss = o.iss || new Set<string>();
  const T0 = o.test || null;
  const order = T0 ? runOrder(T0.path) : [];
  const activeI = T0 && T0.running ? T0.stepI : 1e9;
  const stOf = (id: string): Tone | null => {
    if (!T0) return null;
    const p = T0.path[id];
    if (!p || p === 'skip') return 'skip';
    const i = order.indexOf(id);
    if (i > activeI) return 'skip';
    if (i === activeI) return 'run';
    return p === 'bad' ? 'bad' : 'ok';
  };
  const condOf: Record<string, string> = {};
  E.forEach((e) => { if (e[2] === 'cond') condOf[e[1]] = e[3]; });
  const nodes: CanvasNode[] = N.map(([id, k, l, sub0]) => {
    const sub = condOf[id] != null ? (condOf[id] ? 'If ' + condOf[id] : 'Condition not set') : sub0;
    const s0 = stOf(id);
    const dis = (k === 'agent' || k === 'aggregate') && !!l && !!o.disabled?.(l);
    const l2 = s0 ? ({ ok: 'Completed', bad: 'Failed', run: 'Active', skip: T0 && T0.running ? 'Pending' : 'Skipped' } as Record<string, string>)[s0] : dis ? 'Disabled' : iss.has(id) ? 'Needs attention' : sub || KL[k];
    const tone: Tone = s0 || (dis || iss.has(id) ? 'bad' : KTONE[k]);
    return { id: 'n:' + id, kind: k, x: P[id].x, y: P[id].y, w: NW, h: NH, l1: l || (k === 'aggregate' ? 'Aggregator' : 'Choose agent'), l2, tone, sel: o.sel === 'n:' + id };
  });
  const edges: CanvasEdge[] = E.map(([a, b, k, l], i) => {
    const sa = stOf(a), sb = stOf(b);
    const on = !!T0 && !!sa && !!sb && sa !== 'skip' && sb !== 'skip';
    const ortho = (P[b]?.x ?? 0) > (P[a]?.x ?? 0);
    return {
      i, a: 'n:' + a, b: 'n:' + b, ortho, bend: ortho ? 0 : 30,
      l: k === 'cond' ? '' : l || (k === 'par' ? 'parallel' : k === 'delegate' ? 'delegates' : ''),
      dash: k === 'par' ? '6 3' : k === 'delegate' ? '2 3' : k === 'fallback' ? '5 4' : '',
      tone: o.sel === 'e:' + i ? 'brand' : on ? (sb === 'bad' ? 'bad' : 'ok') : iss.has('e:' + i) ? 'bad' : k === 'fallback' ? 'bad' : undefined,
    };
  });
  if (o.tools) {
    const toolY = Math.max(...nodes.map((n) => n.y)) + 84;
    N.filter((n) => n[1] === 'agent').forEach(([id, , l]) => {
      o.tools!(l).slice(0, 2).forEach((t, j) => {
        const tid = 't:' + id + ':' + j;
        const off = !!o.toolOff?.(t);
        nodes.push({ id: tid, kind: 'tool', x: P[id].x + 20, y: toolY + j * 58, w: 130, h: 44, l1: t.split(':').pop() || t, l2: off ? 'Disabled' : 'Tool', tone: off ? 'bad' : 'ref' });
        edges.push({ i: -1, a: 'n:' + id, b: tid, dash: '2 3', tone: 'ref', noArrow: true });
      });
    });
  }
  const legend: [string, Tone][] = T0
    ? [['Completed', 'ok'], ['Active', 'run'], ['Failed', 'bad'], ['Skipped or pending', 'skip']]
    : ([['Entry point', 'brand'], ['Agent', 'base'], ['Router or orchestrator', 'run'], ['Aggregation or output', 'out'], ['Validation or review', 'warn'], ['Fallback', 'off']] as [string, Tone][]).concat(o.tools ? [['Tool', 'ref']] : []);
  return { nodes, edges, legend };
}

/** Static preview (create wizard). */
export const previewDgm = (cfg: WfCfg): DiagramSpec => ({ ...wfMap(cfg), minScale: 0.6 });

export interface Geom { d: string; ah: string; lx: number; ly: number }

/** Edge path, arrow head and label position (same geometry as `Diagram.tsx`). */
export function edgeGeom(e: DiagramEdge, a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): Geom {
  const ca = [a.x + a.w / 2, a.y + a.h / 2];
  const cb = [b.x + b.w / 2, b.y + b.h / 2];
  const hit = (n: typeof a, from: number[]) => {
    const c = [n.x + n.w / 2, n.y + n.h / 2];
    const dx = from[0] - c[0], dy = from[1] - c[1];
    if (!dx && !dy) return c;
    const t = Math.min((n.w / 2 + 3) / Math.abs(dx || 1e-9), (n.h / 2 + 3) / Math.abs(dy || 1e-9));
    return [c[0] + dx * t, c[1] + dy * t];
  };
  let d: string, p2: number[], dir: number[], lx: number, ly: number;
  if (a === b) {
    const x0 = a.x + a.w * 0.65, x1 = a.x + a.w * 0.35, y0 = a.y - 2;
    d = `M${x0},${y0} C${x0 + 26},${y0 - 46} ${x1 - 26},${y0 - 46} ${x1},${y0 - 3}`;
    p2 = [x1, y0 - 3]; dir = [0.35, 1]; lx = a.x + a.w / 2; ly = y0 - 40;
  } else if (e.ortho) {
    const p1 = [a.x + a.w + 2, ca[1]];
    p2 = [b.x - 3, cb[1]];
    const mx = (p1[0] + p2[0]) / 2;
    d = `M${p1[0]},${p1[1]} C${mx},${p1[1]} ${mx},${p2[1]} ${p2[0]},${p2[1]}`;
    dir = [1, 0]; lx = mx; ly = (p1[1] + p2[1]) / 2 - 6;
  } else {
    const off = e.bend ?? 0;
    const mid = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2];
    const nx = -(cb[1] - ca[1]), ny = cb[0] - ca[0];
    const ln = Math.hypot(nx, ny) || 1;
    const ctl = [mid[0] + (nx / ln) * off, mid[1] + (ny / ln) * off];
    const p1 = hit(a, ctl);
    p2 = hit(b, ctl);
    d = `M${p1[0].toFixed(1)},${p1[1].toFixed(1)} Q${ctl[0].toFixed(1)},${ctl[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    const dx = p2[0] - ctl[0], dy = p2[1] - ctl[1], l2 = Math.hypot(dx, dy) || 1;
    dir = [dx / l2, dy / l2];
    lx = (p1[0] + 2 * ctl[0] + p2[0]) / 4; ly = (p1[1] + 2 * ctl[1] + p2[1]) / 4 - 4;
  }
  const ln = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / ln, uy = dir[1] / ln;
  const bx = p2[0] - ux * 8, by = p2[1] - uy * 8;
  const ah = e.noArrow ? '' : [p2, [bx - uy * 4, by + ux * 4], [bx + uy * 4, by - ux * 4]].map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return { d, ah, lx, ly };
}

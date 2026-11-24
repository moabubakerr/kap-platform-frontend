/**
 * Static diagram (lineage, workflow paths, access paths): absolutely-positioned
 * boxes over an SVG of edges, scaled to the container width. Port of the
 * prototype's `dgm()` helper and the `sec.isDgm` template.
 */
import type { DiagramEdge, DiagramNode, DiagramSpec } from './types';

const TONE: Record<NonNullable<DiagramNode['tone']>, [string, string, string, string, string]> = {
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
const EDGE_C: Record<string, string> = { ok: 'var(--success)', bad: 'var(--danger)', off: 'var(--border-default)', ref: 'var(--text-subtle)', brand: 'var(--brand)' };
const cut = (t: string | undefined, n: number) => {
  const s = String(t ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

type Geom = { d: string; ah: string; lx: number; ly: number };

function edgeGeom(e: DiagramEdge, a: DiagramNode, b: DiagramNode): Geom {
  const ca = [a.x + a.w / 2, a.y + a.h / 2];
  const cb = [b.x + b.w / 2, b.y + b.h / 2];
  const hit = (n: DiagramNode, from: number[]) => {
    const c = [n.x + n.w / 2, n.y + n.h / 2];
    const dx = from[0] - c[0];
    const dy = from[1] - c[1];
    if (!dx && !dy) return c;
    const t = Math.min((n.w / 2 + 3) / Math.abs(dx || 1e-9), (n.h / 2 + 3) / Math.abs(dy || 1e-9));
    return [c[0] + dx * t, c[1] + dy * t];
  };
  let d: string, p2: number[], dir: number[], lx: number, ly: number;
  if (a === b) {
    const x0 = a.x + a.w * 0.65, x1 = a.x + a.w * 0.35, y0 = a.y - 2;
    d = `M${x0},${y0} C${x0 + 26},${y0 - 46} ${x1 - 26},${y0 - 46} ${x1},${y0 - 3}`;
    p2 = [x1, y0 - 3]; dir = [0.35, 1]; lx = a.x + a.w / 2; ly = y0 - 40;
  } else if (e.wrap) {
    const p1 = [a.x + a.w / 2, a.y + a.h + 2];
    p2 = [b.x + b.w / 2, b.y - 3];
    const ym = (a.y + a.h + b.y) / 2;
    d = `M${p1[0]},${p1[1]} L${p1[0]},${ym} L${p2[0]},${ym} L${p2[0]},${p2[1]}`;
    dir = [0, 1]; lx = (p1[0] + p2[0]) / 2; ly = ym - 5;
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

export function Diagram({ spec }: { spec: DiagramSpec }) {
  const nodes = spec.nodes ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const W = Math.max(spec.minW ?? 0, Math.max(...nodes.map((n) => n.x + n.w), 100) + 16);
  const H = Math.max(spec.minH ?? 0, Math.max(...nodes.map((n) => n.y + n.h), 40) + 16);
  const fs = (px: number) => `${((px / W) * 100).toFixed(3)}cqw`;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

  return (
    <div className="card px-4 py-3.5">
      <div className="overflow-x-auto pb-0.5">
        <div className="relative w-full" style={{ containerType: 'inline-size', minWidth: Math.round(W * (spec.minScale ?? 0.8)), maxWidth: Math.round(W * 1.15) }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            {spec.edges.map((e, i) => {
              const a = byId.get(e.a), b = byId.get(e.b);
              if (!a || !b) return null;
              const g = edgeGeom(e, a, b);
              const c = EDGE_C[e.tone ?? ''] ?? 'var(--text-subtle)';
              return (
                <g key={i}>
                  <path d={g.d} style={{ fill: 'none', stroke: c, strokeWidth: 1.5, strokeDasharray: e.dash }} />
                  {g.ah && <polygon points={g.ah} style={{ fill: c }} />}
                </g>
              );
            })}
          </svg>
          {spec.edges.map((e, i) => {
            const a = byId.get(e.a), b = byId.get(e.b);
            if (!a || !b || !e.l) return null;
            const g = edgeGeom(e, a, b);
            return (
              <span key={i} className="pointer-events-none absolute whitespace-nowrap bg-surface px-[3px] text-ink-muted" style={{ left: pct(g.lx, W), top: pct(g.ly, H), transform: 'translate(-50%,-50%)', fontSize: fs(11) }}>
                {cut(e.l, 26)}
              </span>
            );
          })}
          {nodes.map((n) => {
            const t = TONE[n.tone ?? 'base'];
            return (
              <div
                key={n.id}
                title={n.l1 + (n.l2 ? ` · ${n.l2}` : '')}
                onClick={n.click}
                className="absolute flex flex-col items-center justify-center overflow-hidden rounded-lg px-[5px] text-center"
                style={{
                  left: pct(n.x, W), top: pct(n.y, H), width: pct(n.w, W), height: pct(n.h, H), background: t[0],
                  border: `${n.sel ? 2.5 : 1.25}px ${t[4] && !n.sel ? 'dashed' : 'solid'} ${n.sel ? 'var(--brand)' : t[1]}`,
                  cursor: n.click ? 'pointer' : 'default', boxShadow: n.sel ? '0 0 0 3px rgba(138,21,56,.14)' : undefined,
                }}
              >
                <div className="max-w-full overflow-hidden font-semibold leading-tight" style={{ color: t[2], fontSize: fs(12.5), display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {cut(n.l1, 60)}
                </div>
                {n.l2 && (
                  <div className="ellipsis max-w-full" style={{ color: t[3], fontSize: fs(11), lineHeight: 1.3 }}>
                    {cut(n.l2, 60)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {spec.legend && spec.legend.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3.5 text-xs text-ink-muted">
          {spec.legend.map(([l, tone]) => {
            const t = TONE[tone];
            return (
              <span key={l} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-3.5 rounded-[3px]" style={{ background: t[0], border: `1.25px ${t[4] ? 'dashed' : 'solid'} ${t[1]}` }} />
                {l}
              </span>
            );
          })}
        </div>
      )}
      {spec.inspect && spec.inspect.length > 0 && (
        <div className="mt-3 border-t border-line-subtle pt-2.5">
          <div className="mb-1 text-[13.5px] font-semibold text-ink-strong">{spec.inspectT}</div>
          {spec.inspect.map(([k, v]) => (
            <div key={k} className="grid gap-3 border-b border-dashed border-line-subtle py-[5px] text-[13px]" style={{ gridTemplateColumns: '200px minmax(0,1fr)' }}>
              <span className="text-ink-muted">{k}</span>
              <span className="break-words">{v == null || v === '' ? '—' : String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

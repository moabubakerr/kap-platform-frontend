import { cn, linePoints, toPolyline } from '@/lib/utils';

/** Tiny line sparkline (hand-rolled SVG, as in the design). */
export function Sparkline({
  values,
  color = 'var(--brand)',
  height = 24,
  className,
  area,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
  area?: boolean;
}) {
  const pts = linePoints(values, 100, height, 2);
  const line = toPolyline(pts);
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className={cn('block w-full', className)} style={{ height }}>
      {area && <path d={`M0,${height} L${line.replace(/ /g, ' L')} L100,${height} Z`} fill={color} opacity={0.1} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Half-circle gauge: red track, green arc = good / total. */
export function HalfGauge({ good, total, label, sub = 'helpful', size = 120 }: { good: number; total: number; label: string; sub?: string; size?: number }) {
  const len = Math.PI * 50;
  const g = (good / total) * len;
  return (
    <div className="relative flex-none" style={{ width: size, height: size * 0.55 }}>
      <svg viewBox="0 0 120 66" style={{ width: size, height: size * 0.55 }} className="block">
        <path d="M10,60 A50,50 0 0 1 110,60" fill="none" stroke="#F0ECEA" strokeWidth={12} />
        <path d="M10,60 A50,50 0 0 1 110,60" fill="none" stroke="#C0352B" strokeWidth={12} />
        <path d="M10,60 A50,50 0 0 1 110,60" fill="none" stroke="#1E7B4F" strokeWidth={12} strokeDasharray={`${g.toFixed(1)} ${len.toFixed(1)}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">
        <div className="text-xl font-semibold text-ink-strong">{label}</div>
        <div className="mt-0.5 text-[10.5px] text-ink-muted">{sub}</div>
      </div>
    </div>
  );
}

/** Two-part ring donut (e.g. EN 62% maroon / AR 38% sand). */
export function Ring({ pct, a = '#8A1538', b = '#C8B49A', size = 88 }: { pct: number; a?: string; b?: string; size?: number }) {
  const c = 2 * Math.PI * 36;
  const bLen = (1 - pct / 100) * c;
  return (
    <svg viewBox="0 0 88 88" style={{ width: size, height: size, transform: 'rotate(-90deg)' }} className="flex-none">
      <circle cx={44} cy={44} r={36} fill="none" stroke={a} strokeWidth={10} />
      <circle cx={44} cy={44} r={36} fill="none" stroke={b} strokeWidth={10} strokeDasharray={`${bLen.toFixed(1)} ${c.toFixed(1)}`} strokeDashoffset={-(c - bLen)} />
    </svg>
  );
}

/** Proportional split bar with 2px gaps. */
export function SplitBar({ parts, height = 10 }: { parts: { pct: number; color: string; label?: string }[]; height?: number }) {
  return (
    <div className="flex gap-0.5 overflow-hidden rounded-[2px]" style={{ height }}>
      {parts.map((p, i) => (
        <span key={i} title={p.label ? `${p.label} ${p.pct}%` : undefined} style={{ width: `${p.pct}%`, background: p.color }} />
      ))}
    </div>
  );
}

/** Row of coloured squares (last N runs). */
export function RunSquares({ runs, size = 12 }: { runs: ('ok' | 'warn' | 'fail' | 'run')[]; size?: number }) {
  const c = { ok: 'var(--success)', warn: 'var(--warning)', fail: 'var(--danger)', run: 'var(--info)' };
  return (
    <div className="flex gap-[3px]">
      {runs.map((r, i) => (
        <span key={i} className="rounded-[2px]" style={{ width: size, height: size, background: c[r] }} />
      ))}
    </div>
  );
}

import * as React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import type { Indicator, IndicatorSeries } from '@/mocks/catalogue';
import { Page } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';
import { cn } from '@/lib/utils';

export const readOnly = () => toast('Read-only in this version');

const MINUS = '−';

/** 8.8% · −0.5% · 84 days */
export const fmtValue = (s: IndicatorSeries, v: number) => `${v < 0 ? MINUS : ''}${Math.abs(v).toFixed(s.decimals)}${s.suffix}`;

/** Gap in percentage points for % series, otherwise in the series unit. */
export const fmtGap = (s: IndicatorSeries, g: number) => `${g >= 0 ? '+' : MINUS}${Math.abs(g).toFixed(s.decimals)}${s.suffix === '%' ? ' pp' : s.suffix}`;

/** 'Q4 24' → 'Q4 2024', 'Jan 19' → 'Jan 2019', '2019' stays. */
export const longPeriod = (l: string) => l.replace(' ', ' 20');

export const latest = (ind: Indicator) => {
  const s = ind.series;
  const i = s.actual.length - 1;
  const a = s.actual[i];
  const t = s.target ? s.target[i] : null;
  return { label: s.labels[i], actual: a, target: t, gap: t == null ? null : a - t };
};

export interface ObsRow {
  period: string;
  actual: string;
  target: string;
  gap: string;
  gapColor: string;
  above: boolean | null;
  source: string;
}

/** Observation rows, newest first (design `ci.obs` / `obs`). */
export function observationRows(ind: Indicator, longLabels = false): ObsRow[] {
  const s = ind.series;
  return s.actual
    .map((a, i) => {
      const t = s.target ? s.target[i] : null;
      const g = t == null ? null : a - t;
      return {
        period: longLabels ? longPeriod(s.labels[i]) : s.labels[i],
        actual: fmtValue(s, a),
        target: t == null ? '—' : fmtValue(s, t),
        gap: g == null ? '—' : fmtGap(s, g),
        gapColor: g == null ? 'var(--text-muted)' : g >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)',
        above: g == null ? null : g >= 0,
        source: `${s.file} · ${s.row + i}`,
      };
    })
    .reverse();
}

/** Legend for the chart header. */
export function ChartLegend({ hasTarget }: { hasTarget: boolean }) {
  return (
    <div className="flex gap-3.5 text-xs text-ink-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-[2.5px] w-4" style={{ background: '#8A1538' }} />
        Actual
      </span>
      {hasTarget ? (
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4" style={{ borderTop: '2px dashed #C8B49A' }} />
          Target
        </span>
      ) : (
        <span>No target defined</span>
      )}
    </div>
  );
}

/**
 * Actual vs target line chart, built from the indicator's own series with the
 * y-axis fitted to its range and unit (12% padding, 4 gridlines — as the design).
 */
export function ActualTargetChart({ series }: { series: IndicatorSeries }) {
  const { actual, target, labels, suffix } = series;
  const all = actual.concat(target ?? []);
  const mn = Math.min(...all);
  const mx = Math.max(...all);
  const pad = (mx - mn) * 0.12 || 1;
  const lo = mn - pad;
  const hi = mx + pad;
  const ticks = [0, 1, 2, 3].map((k) => mn + ((mx - mn) * k) / 3);
  const tickFmt = (v: number) => {
    const n = Math.abs(v) >= 10 ? String(Math.round(Math.abs(v))) : Math.abs(v).toFixed(1);
    return `${v < -1e-9 ? MINUS : ''}${n}${suffix === ' days' ? 'd' : suffix.trim()}`;
  };
  const data = labels.map((l, i) => ({ label: l, actual: actual[i], target: target ? target[i] : undefined }));

  return (
    <div className="mt-2 h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#E4DFDD" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#766E71' }} interval={0} padding={{ left: 20, right: 20 }} />
          <YAxis domain={[lo, hi]} ticks={ticks} tickFormatter={tickFmt} axisLine={false} tickLine={false} width={48} tick={{ fontSize: 11, fill: '#766E71' }} />
          <Tooltip
            cursor={{ stroke: '#E4DFDD' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-card border border-line-subtle bg-surface px-2.5 py-1.5 text-xs shadow-sm">
                  <div className="font-semibold text-ink-strong">{longPeriod(String(label))}</div>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)} className="flex justify-between gap-4 text-ink-muted">
                      <span>{p.dataKey === 'actual' ? 'Actual' : 'Target'}</span>
                      <span className="font-mono text-ink-strong">{fmtValue(series, Number(p.value))}</span>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          {target && <Line type="linear" dataKey="target" stroke="#C8B49A" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />}
          <Line
            type="linear"
            dataKey="actual"
            stroke="#8A1538"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#fff', stroke: '#8A1538', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: '#8A1538', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Card with the design's 14×16 header row. */
export function Panel({ title, meta, children, className, bodyClassName }: { title: React.ReactNode; meta?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('card min-w-0', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="font-semibold text-ink-strong">{title}</div>
        {meta && <div className="text-[12.5px] text-ink-muted">{meta}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** KPI tile (label, 22px value, sub). */
export function Kpi({ k, v, d, mono }: { k: React.ReactNode; v: React.ReactNode; d?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="card px-3.5 py-3">
      <div className="text-[12.5px] text-ink-muted">{k}</div>
      <div className={cn('font-semibold text-ink-strong', mono ? 'mt-1 font-mono text-base' : 'text-[22px]')}>{v}</div>
      {d && <div className="text-xs text-ink-muted">{d}</div>}
    </div>
  );
}

/** Plain table matching the design (sunken header in sentence case, 9×12 cells). */
export function SimpleTable({ head, children, minWidth = 560, right = [] }: { head: string[]; children: React.ReactNode; minWidth?: number; right?: number[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
            {head.map((h, i) => (
              <th key={h} className={cn('whitespace-nowrap px-3 py-[9px] font-semibold', right.includes(i) && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const tdc = 'border-t border-line-subtle px-3 py-[9px]';
export const tdm = 'border-t border-line-subtle px-3 py-[9px] font-mono text-[12.5px]';

export function PageLoading() {
  return (
    <Page>
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-64" />
    </Page>
  );
}

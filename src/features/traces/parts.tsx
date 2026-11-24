import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge, type Tone } from '@/components/ui/badge';
import { JsonViewer } from '@/components/common/JsonViewer';
import { SPAN_COLOR, fmtSpanDur, type AnswerPart, type Trace, type TraceSpan } from '@/mocks/traces';

const CHIP: Record<'local' | 'oxford' | 'documents', React.CSSProperties> = {
  local: { background: '#F6E8EC', color: '#6B0F2B' },
  oxford: { background: 'var(--teal-tint)', color: '#0F766E' },
  documents: { background: 'var(--sand-tint)', color: 'var(--sand-ink)' },
};

/** Answer text with provenance chips (maroon = local L1, teal = Oxford X1, sand = documents D1). */
export function AnswerText({ parts }: { parts: AnswerPart[] }) {
  return (
    <div className="text-[14.5px] leading-[1.75] text-ink-strong">
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <React.Fragment key={i}>{p}</React.Fragment>
        ) : (
          <span key={i} className="whitespace-nowrap rounded-card px-[5px] py-px font-semibold" style={CHIP[p.src]}>
            {p.v}
            <sup className="ml-0.5 text-[10px]">{p.ref}</sup>
          </span>
        ),
      )}
    </div>
  );
}

/** Small field label used above card blocks ("user_prompt", "Answer", "Input"). */
export const FieldLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('mb-1.5 text-xs font-semibold text-ink-muted', className)}>{children}</div>
);

/** Design meter: 13px label/value row over an 8px bar. */
export function LimitMeter({ k, v, p, danger }: { k: string; v: string; p: number; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex justify-between gap-2 whitespace-nowrap text-[13px]">
        <span className="text-ink-muted">{k}</span>
        <span className={cn('font-semibold', danger ? 'text-danger-fg' : 'text-ink-strong')}>{v}</span>
      </div>
      <div className="h-2 rounded-card bg-surface-sunken">
        <div className="h-full rounded-card" style={{ width: `${Math.min(100, p)}%`, background: danger ? 'var(--danger)' : 'var(--brand)' }} />
      </div>
    </div>
  );
}

const spanBar = (s: TraceSpan) => (s.state === 'error' ? 'var(--danger)' : s.state === 'cancelled' ? 'var(--neutral-500)' : SPAN_COLOR[s.source]);

/** Waterfall: Step | bar | Duration. Rows select a span. */
export function Waterfall({ trace, selected, onSelect }: { trace: Trace; selected: string; onSelect: (id: string) => void }) {
  const T = Math.max(trace.durationS, 0.001);
  return (
    <div className="card overflow-hidden">
      <div className="grid gap-3 bg-surface-sunken px-3.5 py-2 text-[11.5px] text-ink-subtle" style={{ gridTemplateColumns: '250px minmax(0,1fr) 70px' }}>
        <span>Step</span>
        <div className="flex justify-between">
          {trace.axis.map((a, i) => (
            <span key={i}>{a}</span>
          ))}
        </div>
        <span className="text-right">Duration</span>
      </div>
      {trace.spans.map((s) => {
        const on = s.id === selected;
        const indent = s.kind === 'Tool' ? 12 : 0;
        return (
          <button
            type="button"
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn('grid w-full items-center gap-3 border-t border-line-subtle px-3.5 py-[7px] text-left', on ? 'bg-brand-tint' : 'hover:bg-surface-hover')}
            style={{ gridTemplateColumns: '250px minmax(0,1fr) 70px' }}
          >
            <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: indent }}>
              <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: spanBar(s) }} />
              <span className={cn('ellipsis text-[12.5px]', s.mono ? 'font-mono' : 'font-sans', s.state === 'error' ? 'text-danger-fg' : 'text-ink-strong')}>{s.name}</span>
              <span className="whitespace-nowrap text-[11px] text-ink-subtle">{s.state === 'running' ? 'Running' : s.kind}</span>
            </div>
            <div className="relative h-4">
              <div
                className={cn('absolute bottom-0 top-0 min-w-[3px] rounded-sm', s.state === 'running' && 'animate-pulse')}
                style={{ left: `${((s.startS / T) * 100).toFixed(2)}%`, width: `${((s.durS / T) * 100).toFixed(2)}%`, background: spanBar(s) }}
              />
            </div>
            <span className="text-right font-mono text-xs">{s.state === 'running' ? '…' : fmtSpanDur(s.durS)}</span>
          </button>
        );
      })}
    </div>
  );
}

const SRC_BADGE: Record<TraceSpan['source'], [string, Tone]> = {
  oxford: ['Oxford MCP', 'info'],
  local: ['Local tool', 'brand'],
  documents: ['Documents', 'sand'],
  model: ['Model call', 'neutral'],
  queue: ['Queue', 'neutral'],
};

/** Selected span: name, source badge, duration, input/output JSON. */
export function SpanDetail({ span }: { span: TraceSpan }) {
  const [label, tone] = SRC_BADGE[span.source];
  return (
    <div className="card flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: spanBar(span) }} />
        <span className={cn('font-semibold text-ink-strong', span.mono && 'font-mono')}>{span.rawName}</span>
        <Badge tone={tone}>{label}</Badge>
        <span className="ml-auto font-mono text-[12.5px]">{span.state === 'running' ? 'running…' : fmtSpanDur(span.durS)}</span>
      </div>
      {span.error && (
        <div className={cn('rounded-sm px-3 py-2 text-[13px] font-medium', span.state === 'cancelled' ? 'bg-neutral-100 text-neutral-700' : 'bg-danger-bg text-danger-fg')}>{span.error}</div>
      )}
      {span.source === 'queue' ? (
        <div className="text-[13px] text-ink-muted">
          Waited {fmtSpanDur(span.durS)} on <span className="font-mono text-ink-body">kap.agent</span> before a worker picked the job up.
        </div>
      ) : (
        <>
          <div className="text-xs font-semibold text-ink-muted">Input</div>
          <JsonViewer value={span.input ?? {}} className="bg-surface-sunken" maxHeight={240} />
          <div className="text-xs font-semibold text-ink-muted">Output</div>
          {span.output === undefined ? (
            <div className="rounded-sm border border-line-subtle bg-surface-sunken px-3 py-2.5 text-[12.5px] text-ink-muted">{span.state === 'running' ? 'Waiting for the response…' : 'No output.'}</div>
          ) : (
            <JsonViewer value={span.output} className="bg-surface-sunken" maxHeight={240} />
          )}
        </>
      )}
    </div>
  );
}

function ProvCard({ color, title, titleColor, children }: { color: string; title: string; titleColor: string; children: React.ReactNode }) {
  return (
    <div className="card px-4 py-3.5 text-[13px]" style={{ borderTop: `3px solid ${color}` }}>
      <div className="mb-2.5 font-semibold" style={{ color: titleColor }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const Grid = ({ rows }: { rows: [string, React.ReactNode][] }) => (
  <div className="grid gap-x-2.5 gap-y-1.5" style={{ gridTemplateColumns: '100px 1fr' }}>
    {rows.map(([k, v]) => (
      <React.Fragment key={k}>
        <span className="text-ink-muted">{k}</span>
        <span className="min-w-0 break-words">{v}</span>
      </React.Fragment>
    ))}
  </div>
);

/** Answer & provenance: Local data · Document context · External (Oxford). */
export function Provenance({ trace }: { trace: Trace }) {
  const p = trace.provenance;
  const done = trace.status === 'succeeded';
  return (
    <>
      <div className="mt-1 text-base font-semibold text-ink-strong">Answer provenance</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <ProvCard color="#8A1538" titleColor="#8A1538" title={p.local.length ? `Local data · ${p.local.map((l) => l.ref).join(', ')}` : 'Local data'}>
          {p.local.length ? (
            <div className="flex flex-col gap-3">
              {p.local.map((l, i) => (
                <div key={l.ref} className={cn(i > 0 && 'border-t border-line-subtle pt-3')}>
                  <Grid
                    rows={[
                      ['Indicator', l.indicator],
                      ['Period', l.period],
                      [
                        l.target ? 'Actual / target' : 'Actual',
                        <>
                          <b>{l.actual}</b>
                          {l.target && ` vs ${l.target}`}
                        </>,
                      ],
                      ['Unit', l.unit],
                      ['Source org', l.org],
                      ['File · row', <span className="font-mono text-xs">{l.fileRow}</span>],
                    ]}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-ink-muted">{done ? 'No local indicator values were used in this answer.' : 'No answer was produced, so no local values were cited.'}</div>
          )}
        </ProvCard>
        <ProvCard color="#C8B49A" titleColor="var(--sand-ink)" title={p.docs.length ? `Document context · ${p.docs.map((d) => d.ref).join(', ')}` : 'Document context'}>
          {p.docs.length ? (
            p.docs.map((d) => (
              <Grid
                key={d.ref}
                rows={[
                  ['Document', d.doc],
                  ['Section', d.section],
                  ['Passage', <span className="italic text-ink-body">“{d.passage}”</span>],
                  ['Tool', <span className="font-mono text-xs">hybrid_search</span>],
                ]}
              />
            ))
          ) : (
            <div className="text-ink-muted">No document passages were used in this answer.</div>
          )}
        </ProvCard>
        <ProvCard color="#0F766E" titleColor="#0F766E" title={p.external ? `External · Oxford Economics · ${p.external.ref}` : 'External · Oxford Economics'}>
          {p.external ? (
            <>
              <Grid
                rows={[
                  ['Tool', <span className="font-mono text-xs">{p.external.tool}</span>],
                  ['Question sent', `"${p.external.question}"`],
                  ['Value', <b>{p.external.value}</b>],
                ]}
              />
              <LeakChecks />
            </>
          ) : (
            <div className="text-ink-muted">{p.oxfordAgent ? 'No Oxford Economics data was used in this answer.' : 'This agent has no access to Oxford Economics.'}</div>
          )}
        </ProvCard>
      </div>
    </>
  );
}

function LeakChecks() {
  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-line-subtle pt-2.5 text-[12.5px] text-success-fg">
      <span className="flex items-center gap-1.5">
        <Check size={14} />
        No local indicator codes or values sent
      </span>
      <span className="flex items-center gap-1.5">
        <Check size={14} />
        No tenant, user or job identifiers sent
      </span>
    </div>
  );
}

const lineColor = (t: string) =>
  /^\s*[{}[\]],?$/.test(t) ? 'var(--text-muted)' : /":\s*"/.test(t) ? '#0F766E' : /":\s*[\d-]/.test(t) ? '#2B6CB0' : 'var(--text-body)';

export function RawRecord({ lines }: { lines: string[] }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="font-semibold text-ink-strong">Raw job record</div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-[13px] text-brand hover:text-brand-strong"
          onClick={() => {
            void navigator.clipboard?.writeText(lines.join('\n'));
            toast.success('JSON copied');
          }}
        >
          <Copy size={15} />
          Copy JSON
        </button>
      </div>
      <pre className="m-0 max-h-[560px] overflow-auto px-4 py-3.5 font-mono text-xs leading-[1.65]">
        {lines.map((t, i) => (
          <div key={i} className="whitespace-pre">
            <span className="inline-block w-7 text-ink-subtle">{i + 1}</span>
            <span style={{ color: lineColor(t) }}>{t}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

const LV_COLOR = { INFO: 'var(--success-fg)', WARN: 'var(--warning-fg)', ERROR: 'var(--danger-fg)' } as const;

export function Logs({ logs }: { logs: Trace['logs'] }) {
  const [f, setF] = React.useState<'all' | 'warn' | 'error'>('all');
  const shown = logs.filter((l) => (f === 'all' ? true : f === 'warn' ? l.lv === 'WARN' : l.lv === 'ERROR'));
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="font-semibold text-ink-strong">Logs · {logs.length} lines</div>
        <div className="flex gap-1.5 text-[12.5px]">
          {(
            [
              ['all', 'All'],
              ['warn', 'Warnings'],
              ['error', 'Errors'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setF(v)}
              className={cn('rounded-sm px-2.5 py-[3px]', f === v ? 'bg-brand-tint font-semibold text-brand-strong' : 'border border-line hover:border-brand')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="py-2 font-mono text-xs leading-[1.8]">
        {shown.length === 0 && <div className="px-4 py-3 font-sans text-[13px] text-ink-muted">No {f === 'warn' ? 'warnings' : 'errors'} in this job.</div>}
        {shown.map((l, i) => (
          <div key={i} className="grid gap-2.5 px-4 hover:bg-surface-hover" style={{ gridTemplateColumns: '110px 56px 1fr' }}>
            <span className="text-ink-subtle">{l.t}</span>
            <span className="font-semibold" style={{ color: LV_COLOR[l.lv] }}>
              {l.lv}
            </span>
            <span className="whitespace-pre-wrap break-words text-ink-body">{l.m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

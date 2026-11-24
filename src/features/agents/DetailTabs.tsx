import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Database, Pencil, Plus, RotateCcw, BookOpen, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, type Tone } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';
import { EmptyState } from '@/components/common/primitives';
import { useBase } from '@/app/shell/AppShell';
import { JOBS } from '@/mocks/core';
import { diffLines, type AgentDetail, type DiffRow } from '@/mocks/agents';
import { CardHead, JobLine, SimpleTable, TOOL_SRC, ToolName, readOnly, tdc } from './shared';

const mono = 'font-mono text-[12.5px]';

// ---------------------------------------------------------------------------
// Configuration

const lineColor = (t: string) =>
  /^\s*[{}[\]],?$/.test(t) ? 'var(--text-muted)' : /":\s*"/.test(t) ? '#0F766E' : /":\s*[\d-]/.test(t) ? '#2B6CB0' : 'var(--text-body)';

export function ConfigTab({ d }: { d: AgentDetail }) {
  const base = useBase();
  const lines = d.versions[0].lines;
  return (
    <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
      <div className="card min-w-0">
        <CardHead title="Configuration">
          <Button variant="outline" onClick={readOnly}>
            <Pencil size={15} />
            Edit configuration
          </Button>
        </CardHead>
        <div className="flex flex-col gap-[18px] p-4">
          <div className="grid gap-x-3.5 gap-y-2 text-[13px]" style={{ gridTemplateColumns: '140px 1fr' }}>
            <span className="text-ink-muted">Model provider</span>
            <span>
              <Link to={`${base}/providers`} className={mono}>
                {d.provider.alias}
              </Link>{' '}
              · {d.provider.model}
            </span>
            {d.facts.map(([k, v]) => (
              <React.Fragment key={k}>
                <span className="text-ink-muted">{k}</span>
                <span>{v}</span>
              </React.Fragment>
            ))}
            <span className="text-ink-muted">Collections</span>
            <span className={mono}>
              {d.collections.length === 0
                ? '—'
                : d.collections.map((c, i) => (
                    <React.Fragment key={c.name}>
                      {i > 0 && ', '}
                      <Link to={c.kind === 'collection' ? `${base}/collections/${c.name}` : c.kind === 'catalogue' ? `${base}/catalogue` : `${base}/collections`}>{c.name}</Link>
                    </React.Fragment>
                  ))}
            </span>
            <span className="text-ink-muted">Tools</span>
            <span>{d.toolsSummary}</span>
            <span className="text-ink-muted">Groups</span>
            <span>
              {d.groups.map((g, i) => (
                <React.Fragment key={g}>
                  {i > 0 && ', '}
                  <Link to={`${base}/groups`}>{g}</Link>
                </React.Fragment>
              ))}
            </span>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-ink-muted">Limits</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              {d.limits.map(([k, v]) => (
                <div key={k} className="rounded-sm border border-line-subtle px-2.5 py-2">
                  <div className="text-[11.5px] text-ink-muted">{k}</div>
                  <div className="text-[15px] font-semibold text-ink-strong">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-ink-muted">System instructions{d.agent.kind === 'pipeline' && ' · read-only'}</div>
            <div className="whitespace-pre-wrap rounded-sm border border-line-subtle bg-surface-sunken p-3 font-mono text-xs leading-[1.6]">{d.systemPrompt}</div>
          </div>
        </div>
      </div>

      <div className="card min-w-0">
        <CardHead title="JSON">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(lines.join('\n'));
              toast.success('Copied');
            }}
            className="flex items-center gap-1.5 text-[13px] text-brand hover:underline"
          >
            <Copy size={14} />
            Copy
          </button>
        </CardHead>
        <pre className="m-0 overflow-auto px-4 py-3.5 font-mono text-xs leading-[1.65]">
          {lines.map((t, i) => (
            <div key={i} className="whitespace-pre">
              <span className="inline-block w-[26px] text-ink-subtle">{i + 1}</span>
              <span style={{ color: lineColor(t) }}>{t}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tools & collections

export function ToolsTab({ d }: { d: AgentDetail }) {
  const base = useBase();
  const nav = useNavigate();
  const isPipe = d.agent.kind === 'pipeline';
  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <CardHead title={`Allowed tools · ${d.tools.length}`}>
          <Button variant="outline" onClick={readOnly}>
            Edit tools
          </Button>
        </CardHead>
        {isPipe ? (
          <div className="px-4 py-6 text-[13px] text-ink-muted">
            This agent is a single model call inside the Ask AI pipeline. It does not call tools; resolvers and computation run as code before and after it.{' '}
            <Link to={`${base}/map`}>See it on the agents map</Link>.
          </div>
        ) : (
          <SimpleTable
            minWidth={720}
            head={[{ label: 'Tool' }, { label: 'Source' }, { label: 'Description' }, { label: 'Calls · 7 d', right: true }, { label: 'Errors', right: true }]}
          >
            {d.tools.map((t) => (
              <tr key={t.name} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/mcp`)}>
                <td className={tdc}>
                  <ToolName name={t.name} color={TOOL_SRC[t.source].color} />
                </td>
                <td className={cn(tdc, 'text-ink-muted')}>{TOOL_SRC[t.source].label}</td>
                <td className={cn(tdc, 'text-ink-muted')}>{t.description}</td>
                <td className={cn(tdc, mono, 'text-right')}>{t.calls7d}</td>
                <td
                  className={cn(tdc, mono, 'text-right')}
                  style={{ color: t.errorRate === '0%' ? 'var(--text-muted)' : t.source === 'oxford' ? 'var(--danger-fg)' : 'var(--warning-fg)' }}
                >
                  {t.errorRate}
                </td>
              </tr>
            ))}
          </SimpleTable>
        )}
      </div>

      <div className="card">
        <CardHead title={`Collections · ${d.collections.length}`} />
        {d.collections.length === 0 && <div className="px-4 py-3.5 text-[13px] text-ink-muted">No collections attached. This agent only sees what the pipeline passes to it.</div>}
        {d.collections.map((c) => {
          const to = c.kind === 'collection' ? `${base}/collections/${c.name}` : c.kind === 'catalogue' ? `${base}/catalogue` : `${base}/collections`;
          return (
            <div key={c.name} className="flex flex-wrap items-center gap-3.5 border-t border-line-subtle px-4 py-3.5 first:border-t-0">
              <span className="grid h-8 w-8 place-items-center rounded-sm bg-[#F6E8EC] text-[#8A1538]">
                {c.kind === 'catalogue' ? <BookOpen size={16} /> : c.kind === 'articles' ? <FileText size={16} /> : <Database size={16} />}
              </span>
              <div className="flex-1">
                <Link to={to} className={cn(mono, 'font-semibold')}>
                  {c.name}
                </Link>
                <div className="text-[12.5px] text-ink-muted">{c.meta}</div>
              </div>
              <StatusPill status="healthy" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access

const ROLE_TONE: Record<string, Tone> = { analyst: 'info', administrator: 'brand', viewer: 'neutral' };

export function AccessTab({ d }: { d: AgentDetail }) {
  const base = useBase();
  const nav = useNavigate();
  return (
    <div className="card">
      <CardHead title="Groups that can use this agent">
        <Button onClick={readOnly}>
          <Plus size={15} />
          Grant access
        </Button>
      </CardHead>
      <SimpleTable head={[{ label: 'Group' }, { label: 'Role' }, { label: 'Allows' }, { label: 'Members' }, { label: 'Granted by' }]}>
        {d.access.map((r) => (
          <tr key={r.group} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/groups`)}>
            <td className={cn(tdc, mono)}>{r.group}</td>
            <td className={tdc}>
              <Badge tone={ROLE_TONE[r.role]}>{r.role}</Badge>
            </td>
            <td className={cn(tdc, 'text-ink-muted')}>{r.allows}</td>
            <td className={tdc}>
              {r.members.split(', ').map((m, i) => (
                <React.Fragment key={m}>
                  {i > 0 && ', '}
                  <Link to={`${base}/users/${encodeURIComponent(m)}`} onClick={(e) => e.stopPropagation()} className="text-ink-body hover:text-brand">
                    {m}
                  </Link>
                </React.Fragment>
              ))}
            </td>
            <td className={cn(tdc, 'text-ink-muted')}>{r.grantedBy}</td>
          </tr>
        ))}
      </SimpleTable>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Jobs

export function JobsTab({ d }: { d: AgentDetail }) {
  const base = useBase();
  const nav = useNavigate();
  if (d.agent.kind === 'pipeline') {
    return (
      <EmptyState
        title="Pipeline agents do not run jobs"
        body={`${d.agent.name} runs inside Ask AI messages: ${d.jobs7d} calls in the last 7 days. Open a conversation message to see its step in the provenance.`}
        actions={
          <>
            <Button onClick={() => nav(`${base}/conversations`)}>Open conversations</Button>
            <Button variant="outline" onClick={() => nav(`${base}/map`)}>
              Agents map
            </Button>
          </>
        }
      />
    );
  }
  const jobs = JOBS.filter((j) => j.agent === d.agent.id);
  return (
    <div className="card">
      <CardHead title="Jobs · last 7 days">
        <Link to={`${base}/jobs`} className="text-[13px]">
          Open in Agent jobs
        </Link>
      </CardHead>
      {jobs.map((j) => (
        <JobLine key={j.id} job={j} onClick={() => nav(`${base}/traces/${j.id}`)} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics

export function MetricsTab({ d }: { d: AgentDetail }) {
  const m = d.metrics;
  const totals = m.days.map((x) => x.ok + x.fail + x.run);
  const scale = Math.max(14, ...totals);
  const maxFail = Math.max(1, ...m.failReasons.map((f) => f.v));
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
      <div className="card p-4">
        <div className="font-semibold text-ink-strong">{m.unit} per day</div>
        <div className="mt-3.5 flex h-[150px] items-end gap-3 border-b border-line-subtle">
          {m.days.map((x, i) => {
            const t = totals[i];
            return (
              <div
                key={x.label}
                title={`${x.label}: ${x.ok} succeeded · ${x.fail} failed${x.run ? ` · ${x.run} running` : ''}`}
                className="mx-auto flex max-w-[40px] flex-1 flex-col-reverse overflow-hidden rounded-t-[3px]"
                style={{ height: Math.round((t / scale) * 145) }}
              >
                <div style={{ height: `${(x.ok / t) * 100}%`, background: 'var(--success)' }} />
                <div style={{ height: `${(x.fail / t) * 100}%`, background: 'var(--danger)' }} />
                <div style={{ height: `${(x.run / t) * 100}%`, background: 'var(--info)' }} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-1.5">
          {m.days.map((x) => (
            <div key={x.label} className="flex-1 text-center text-[11.5px] text-ink-muted">
              {x.label}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-semibold text-ink-strong">{m.timeTitle}</div>
        <div className="mt-[18px] flex h-[22px] overflow-hidden rounded-card">
          {m.time.map((t) => (
            <span key={t.label} title={`${t.label} ${t.value}`} style={{ width: `${t.pct}%`, background: t.color }} />
          ))}
        </div>
        <div className="mt-4 grid gap-x-3 gap-y-2 text-[13px]" style={{ gridTemplateColumns: '1fr auto' }}>
          {m.time.map((t) => (
            <React.Fragment key={t.label}>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: t.color }} />
                {t.label}
              </span>
              <span className={mono}>{t.value}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-semibold text-ink-strong">Failure reasons · 7 d</div>
        {m.failReasons.length === 0 ? (
          <div className="mt-3.5 text-[13px] text-ink-muted">No failures in the last 7 days.</div>
        ) : (
          <div className="mt-3.5 flex flex-col gap-3 text-[13px]">
            {m.failReasons.map((f) => (
              <div key={f.name}>
                <div className="flex justify-between">
                  <span>{f.name}</span>
                  <span className={mono}>{f.v}</span>
                </div>
                <div className="mt-[5px] h-2 rounded-card bg-surface-sunken">
                  <div className="h-full rounded-card bg-danger" style={{ width: `${(f.v / maxFail) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Versions: list + side-by-side diff + Restore

const BG: Record<NonNullable<DiffRow['lb'] | DiffRow['rb']>, string> = { del: 'var(--danger-bg)', add: 'var(--success-bg)', gap: 'var(--surface-sunken)' };

export function VersionsTab({ d }: { d: AgentDetail }) {
  const vs = d.versions;
  const [sel, setSel] = React.useState(vs[0].v);
  const idx = vs.findIndex((v) => v.v === sel);
  const to = vs[idx];
  const from = vs[idx + 1];
  const rows = React.useMemo(() => diffLines(from?.lines ?? [], to.lines), [from, to]);
  const changed = rows.some((r) => r.lb || r.rb);
  const restore = idx === 0 ? from : to;
  const meta = (v: typeof to, cur: boolean) => `${v.v} · ${cur ? 'current' : v.when} · ${v.by}`;

  return (
    <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)' }}>
      <div className="card">
        <CardHead title={`Versions · ${vs.length}`} />
        {vs.map((v, i) => {
          const on = v.v === sel || v.v === from?.v;
          return (
            <button
              key={v.v}
              type="button"
              onClick={() => setSel(v.v)}
              className={cn('block w-full px-4 py-2.5 text-left', i > 0 && 'border-t border-line-subtle', on ? 'bg-brand-tint' : 'hover:bg-surface-hover')}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12.5px] font-semibold text-ink-strong">
                  {v.v}
                  {i === 0 && <span className="ml-1.5 font-sans text-[11px] font-medium text-ink-muted">current</span>}
                </span>
                <span className="text-xs text-ink-muted">{v.when}</span>
              </div>
              <div className="text-[12.5px] text-ink-body">{v.note}</div>
              <div className="text-xs text-ink-muted">{v.by}</div>
            </button>
          );
        })}
      </div>

      <div className="card min-w-0 overflow-hidden">
        <CardHead title={from ? `Compare ${from.v} → ${to.v}` : `${to.v} · first version`}>
          {restore && (
            <Button variant="outline" onClick={readOnly}>
              <RotateCcw size={15} />
              Restore {restore.v}
            </Button>
          )}
        </CardHead>
        {!changed && (
          <div className="border-b border-line-subtle bg-surface-sunken px-4 py-2.5 text-[13px] text-ink-muted">
            {to.promptOnly ? 'Only the system instructions changed in this version; the configuration JSON is identical.' : 'No changes to the configuration JSON in this version.'}
          </div>
        )}
        <div className="overflow-auto">
          <div className="grid min-w-[640px] font-mono text-xs leading-[1.7]" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="border-b border-line-subtle bg-surface-sunken px-3 py-1.5 font-sans text-xs font-semibold text-ink-muted">{from ? meta(from, false) : 'No previous version'}</div>
            <div className="border-b border-l border-line-subtle bg-surface-sunken px-3 py-1.5 font-sans text-xs font-semibold text-ink-muted">{meta(to, idx === 0)}</div>
            {rows.map((r, i) => (
              <React.Fragment key={i}>
                <div className="flex gap-2.5 whitespace-pre px-3" style={{ background: r.lb ? BG[r.lb] : undefined }}>
                  <span className="w-[22px] flex-none text-right text-ink-subtle">{r.ln}</span>
                  <span>{r.l}</span>
                </div>
                <div className="flex gap-2.5 whitespace-pre border-l border-line-subtle px-3" style={{ background: r.rb ? BG[r.rb] : undefined }}>
                  <span className="w-[22px] flex-none text-right text-ink-subtle">{r.rn}</span>
                  <span>{r.r}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

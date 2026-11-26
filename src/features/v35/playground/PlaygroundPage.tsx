/**
 * Playground: run a real agent of a live tenant from the console and watch the
 * job — status, answer, then its trace once the gateway's calls are linked.
 * Jobs are submitted through the platform API (which asks KAP to call it back
 * when the job finishes), so they appear in Monitoring like any other job.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, Play, RotateCcw } from 'lucide-react';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useAddToTestSet } from '@/features/v35/evals/addToSet';
import { useCrumbs } from '@/app/shell/crumbs';
import { errorMessage, fetchAgents, fetchTrace, submitJob, toTrace, type PlatformAgentSummary } from '@/api/platformLive';
import { PageHeadView, DsPill } from '@/engine/ScreenView';
import { statusPill } from '@/engine/build';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/common/primitives';
import { JsonViewer } from '@/components/common/JsonViewer';
import { Page } from '@/components/common/layout';
import { useAccess } from '@/v35/access';
import { runSpans } from '../monitoring/build';
import { cn } from '@/lib/utils';

const EXAMPLES = [
  'What was the non-hydrocarbon export share of total exports in 2019, and how does it compare with the target?',
  'What is the latest strategic food reserve coverage?',
  'Which indicators are currently below their target?',
];

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

interface RunRef {
  jobId: string;
  agent: string;
  prompt: string;
  at: number;
}

export default function PlaygroundPage() {
  const scope = useScope();
  const project = scope.kind === 'project' ? scope.project : null;
  useCrumbs([]);
  if (!project?.live) {
    return (
      <Page>
        <PageHeadView head={{ title: 'Playground' }} />
        <EmptyState
          icon={<FlaskConical size={22} />}
          title="The playground runs real agents"
          body={`${project?.name ?? 'This tenant'} has no live connection yet. Switch to the sandbox tenant to run agents on the test stand.`}
        />
      </Page>
    );
  }
  return <Playground tenantId={project.tenantId} tenantKey={project.key} tenantName={project.name} />;
}

function Playground({ tenantId, tenantKey, tenantName }: { tenantId: string; tenantKey: 'sceai' | 'econ' | 'sandbox' | 'default'; tenantName: string }) {
  const base = useBase();
  const nav = useNavigate();
  const access = useAccess(tenantKey);
  const addCase = useAddToTestSet(tenantId);
  const agents = useQuery({ queryKey: ['pg-agents', tenantId], queryFn: () => fetchAgents(tenantId), staleTime: 60_000 });
  const [agentId, setAgentId] = React.useState('');
  const [prompt, setPrompt] = React.useState(EXAMPLES[0]);
  const [payload, setPayload] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [runs, setRuns] = React.useState<RunRef[]>([]);
  const [current, setCurrent] = React.useState<string | null>(null);

  const list = agents.data?.items ?? [];
  const agent: PlatformAgentSummary | undefined = list.find((a) => a.id === agentId) ?? list[0];
  React.useEffect(() => {
    if (!agentId && list[0]) setAgentId(list[0].id);
  }, [agentId, list]);
  const isWorkflow = agent?.type === 'workflow';
  const mayRun = agent ? access.can('agent:execute', 'agent', agent.name) : false;

  async function run() {
    if (!agent) return;
    setError(null);
    const body: { user_prompt?: string; payload?: unknown } = {};
    if (prompt.trim()) body.user_prompt = prompt.trim();
    if (payload.trim()) {
      try {
        body.payload = JSON.parse(payload);
      } catch {
        setError('The payload is not valid JSON.');
        return;
      }
    }
    if (!body.user_prompt && body.payload === undefined) {
      setError(isWorkflow ? 'Enter a payload (and optionally a prompt).' : 'Enter a prompt.');
      return;
    }
    setSubmitting(true);
    try {
      const job = await submitJob(tenantId, agent.id, body);
      setRuns((r) => [{ jobId: job.id, agent: agent.name, prompt: body.user_prompt ?? JSON.stringify(body.payload), at: Date.now() }, ...r].slice(0, 10));
      setCurrent(job.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      <PageHeadView head={{ title: 'Playground', sub: `Run ${tenantName} agents on the test stand and watch the result and its trace.` }} />
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'minmax(320px, 440px) minmax(0, 1fr)' }}>
        {/* ---------------- request */}
        <div className="card flex flex-col gap-3.5 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-strong">Agent</span>
            {agents.isLoading ? (
              <Skeleton className="h-9" />
            ) : agents.isError ? (
              <div className="text-[13px] text-danger-fg">Cannot load agents: {errorMessage(agents.error)}</div>
            ) : (
              <select value={agent?.id ?? ''} onChange={(e) => setAgentId(e.target.value)} className="h-9 rounded-card border border-line bg-surface px-2.5 font-mono text-[13px]">
                {list.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          {agent && (
            <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 rounded-card bg-surface-sunken px-3 py-2.5 text-[12.5px]">
              <span className="text-ink-muted">Type</span>
              <span className="font-mono">{agent.type}</span>
              <span className="text-ink-muted">Model</span>
              <span className="font-mono">{agent.model_ref}</span>
              <span className="text-ink-muted">Collections</span>
              <span className="font-mono">{agent.collections.join(', ') || '—'}</span>
              <span className="text-ink-muted">Tools</span>
              <span>{agent.allowed_tools.length} allowed</span>
              <span className="text-ink-muted">Limits</span>
              <span>
                {agent.request_limit ?? '—'} requests · {agent.tool_calls_limit ?? '—'} tool calls · {agent.timeout_seconds ?? '—'} s
              </span>
              {isWorkflow && (
                <>
                  <span className="text-ink-muted">Input schema</span>
                  <span className="font-mono">{agent.config?.input_schema_ref ?? '—'}</span>
                </>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-strong">{isWorkflow ? 'Prompt (optional, supplements the template)' : 'Prompt'}</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="resize-y rounded-card border border-line bg-surface px-3 py-2 text-[13.5px] leading-relaxed outline-none focus-visible:shadow-focus" />
          </label>
          {!isWorkflow && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">Examples</span>
              {EXAMPLES.map((x) => (
                <button key={x} type="button" onClick={() => setPrompt(x)} className="rounded-sm px-2 py-1 text-left text-[12.5px] text-brand hover:bg-brand-tint">
                  {x}
                </button>
              ))}
            </div>
          )}
          {isWorkflow && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-ink-strong">Payload (JSON, keys of the input schema)</span>
              <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={5} placeholder='{"question": "…"}' className="resize-y rounded-card border border-line bg-surface px-3 py-2 font-mono text-[12.5px] outline-none focus-visible:shadow-focus" />
            </label>
          )}
          {error && <div className="rounded-card bg-danger-bg px-3 py-2 text-[13px] text-danger-fg">{error}</div>}
          <div className="flex items-center gap-2">
            <Button size="md" onClick={() => void run()} disabled={!agent || submitting || !mayRun}>
              <Play size={15} />
              {submitting ? 'Submitting…' : 'Run'}
            </Button>
            {!mayRun && agent && <span className="text-xs text-ink-muted">Your account may not run {agent.name}.</span>}
          </div>
          <p className="text-xs text-ink-muted">Runs as the platform layer's KAP account for this tenant, not as {access.name}. Each run is a real job on the test stand and appears in Monitoring & Insights.</p>
        </div>

        {/* ---------------- result */}
        <div className="flex min-w-0 flex-col gap-4">
          {current ? (
            <RunView key={current} jobId={current} onOpen={(t) => nav(`${base}/monitoring/runs/${current}${t ? `/${t}` : ''}`)} onAddCase={(q, a) => void addCase({ question: q, answer: a, source: 'playground' })} />
          ) : (
            <EmptyState icon={<FlaskConical size={22} />} title="No run yet" body="Choose an agent, write a prompt and press Run. The answer and the trace appear here." />
          )}
          {runs.length > 1 && (
            <div className="card">
              <div className="border-b border-line-subtle px-4 py-3 text-[13.5px] font-semibold text-ink-strong">Runs in this session</div>
              {runs.map((r) => (
                <button key={r.jobId} type="button" onClick={() => setCurrent(r.jobId)} className={cn('flex w-full items-center gap-3 border-t border-line-subtle px-4 py-2 text-left text-[12.5px] first:border-t-0 hover:bg-surface-hover', r.jobId === current && 'bg-brand-tint')}>
                  <span className="font-mono">{r.jobId.slice(0, 8)}</span>
                  <span className="font-mono text-ink-muted">{r.agent}</span>
                  <span className="ellipsis flex-1 text-ink-body">{r.prompt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RunView({ jobId, onOpen, onAddCase }: { jobId: string; onOpen: (tab?: string) => void; onAddCase: (question: string, answer: string | null) => void }) {
  const started = React.useRef(Date.now());
  const [, tick] = React.useState(0);
  const [sel, setSel] = React.useState<string | null>(null);
  const q = useQuery({
    queryKey: ['pg-run', jobId],
    queryFn: () => fetchTrace(jobId),
    // poll until the job is final and its trace is linked (or given up)
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 1500;
      if (!TERMINAL.has(d.job.status)) return 1500;
      if (d.job.trace_status === 'pending' && Date.now() - started.current < 90_000) return 2500;
      return false;
    },
  });
  const d = q.data;
  const done = !!d && TERMINAL.has(d.job.status);
  React.useEffect(() => {
    if (done) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [done]);

  if (!d) return <Skeleton className="h-64" />;
  const t = toTrace(d);
  const elapsed = done ? t.duration : `${((Date.now() - started.current) / 1000).toFixed(1)} s`;
  const linked = d.job.trace_status === 'linked';
  const selected = t.spans.find((s) => s.id === (sel ?? t.defaultSpan));

  return (
    <>
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[15px] font-semibold text-ink-strong">Job {jobId.slice(0, 8)}</span>
          <DsPill p={statusPill(t.statusLabel)} />
          <span className="font-mono text-[12.5px] text-ink-muted">{elapsed}</span>
          <span className="ml-auto flex gap-2">
            {done && d.job.user_prompt && (
              <Button size="xs" variant="outline" onClick={() => onAddCase(d.job.user_prompt!, d.job.status === 'succeeded' ? (d.job.result ?? null) : null)}>
                Add to test set
              </Button>
            )}
            <Button size="xs" variant="outline" onClick={() => onOpen()}>
              Open in Monitoring
            </Button>
          </span>
        </div>
        <div className="text-[12.5px] text-ink-muted">{d.job.user_prompt}</div>
        {d.job.status === 'failed' && <div className="rounded-card bg-danger-bg px-3 py-2 text-[13px] text-danger-fg">{d.job.error}</div>}
        {d.job.status === 'succeeded' && (
          <div>
            <div className="mb-1 text-xs font-semibold text-ink-muted">Answer</div>
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-strong">{d.job.result}</div>
          </div>
        )}
        {!done && <div className="text-[13px] text-ink-muted">{d.job.status === 'waiting' ? 'Waiting for a worker…' : 'Running — the model is planning and calling tools…'}</div>}
      </div>

      {done && (
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-ink-strong">Trace</span>
            {linked ? (
              <Badge tone="success">{d.trace.totals.model_calls} model calls · {d.trace.totals.tool_calls} tool calls · {d.trace.totals.prompt_tokens.toLocaleString('en-GB')} tokens in</Badge>
            ) : d.job.trace_status === 'pending' ? (
              <Badge tone="info">
                <RotateCcw size={12} className="animate-spin" /> Linking model calls…
              </Badge>
            ) : (
              <Badge tone="neutral">No trace ({d.job.trace_status})</Badge>
            )}
          </div>
          {linked && (
            <>
              <div className="overflow-hidden rounded-card border border-line-subtle">
                {runSpans(t, selected?.id ?? null, setSel).map((s, i) => (
                  <div key={i} onClick={s.onClick} className={cn('grid cursor-pointer items-center gap-3 border-t border-line-subtle px-3 py-1.5 text-[12.5px] first:border-t-0 hover:bg-surface-hover', s.selected && 'bg-brand-tint')} style={{ gridTemplateColumns: '220px minmax(0,1fr) 70px' }}>
                    <div className="min-w-0">
                      <div className="ellipsis font-semibold text-ink-strong">{s.n}</div>
                      <div className="ellipsis text-[11px] text-ink-muted">{s.sub}</div>
                    </div>
                    <div className="relative h-2.5 rounded-[3px] bg-surface-sunken">
                      <div className="absolute inset-y-0 rounded-[3px]" style={{ left: s.l, width: s.w, background: s.c }} />
                    </div>
                    <div className="text-right font-mono text-xs">{s.d}</div>
                  </div>
                ))}
              </div>
              {selected && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="text-xs font-semibold text-ink-muted">{selected.kind === 'Tool' ? `${selected.rawName} · input` : 'Input'}</div>
                    <JsonViewer value={selected.input ?? null} maxHeight={280} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="text-xs font-semibold text-ink-muted">Output</div>
                    <JsonViewer value={selected.output ?? null} maxHeight={280} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

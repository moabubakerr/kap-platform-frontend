import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, FlaskConical, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KeyValues } from '@/components/common/primitives';
import { useBase } from '@/app/shell/AppShell';
import { JOBS } from '@/mocks/core';
import type { AgentDetail, TestStep } from '@/mocks/agents';
import { JobLine, Spinner } from './shared';

export function OverviewTab({ d, runSignal, onTab }: { d: AgentDetail; runSignal: number; onTab: (t: string) => void }) {
  const base = useBase();
  const nav = useNavigate();
  const isPipe = d.agent.kind === 'pipeline';
  const jobs = JOBS.filter((j) => j.agent === d.agent.id).slice(0, 5);

  return (
    <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          {d.kpis.map(([k, v]) => (
            <div key={k} className="card px-3.5 py-3">
              <div className="text-[12.5px] text-ink-muted">{k}</div>
              <div className="text-[22px] font-semibold text-ink-strong">{v}</div>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <div className="mb-3.5 font-semibold text-ink-strong">Topology</div>
          <Topology d={d} onTools={() => onTab('tools')} />
        </div>

        {isPipe ? (
          <div className="card">
            <div className="flex justify-between px-4 py-3.5 font-semibold text-ink-strong">
              Where it runs
              <Link to={`${base}/map`} className="text-[13px] font-medium">
                Open agents map
              </Link>
            </div>
            <div className="border-t border-line-subtle px-4 py-3.5">
              <KeyValues
                rows={[
                  ['Pipeline', 'Ask AI · chat'],
                  ['Model', <span className="font-mono text-[12.5px]">{d.provider.model}</span>],
                  ...d.facts.map(([k, v]) => [k, v] as [string, string]),
                ]}
              />
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="flex justify-between px-4 py-3.5 font-semibold text-ink-strong">
              Recent jobs
              <button type="button" onClick={() => onTab('jobs')} className="text-[13px] font-medium text-brand hover:underline">
                View all
              </button>
            </div>
            {jobs.map((j) => (
              <JobLine key={j.id} job={j} dense onClick={() => nav(`${base}/traces/${j.id}`)} />
            ))}
          </div>
        )}
      </div>

      <TestAgentPanel d={d} runSignal={runSignal} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Box({ children, className, style, to }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; to?: string }) {
  const cls = `block rounded-sm px-2.5 py-2 text-xs hover:no-underline ${className ?? ''}`;
  return to ? (
    <Link to={to} className={`${cls} transition-colors hover:bg-surface-hover`} style={style}>
      {children}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

const Line = ({ color = '#D2CBC9' }: { color?: string }) => <span className="h-0.5" style={{ background: color }} />;

function Topology({ d, onTools }: { d: AgentDetail; onTools: () => void }) {
  const base = useBase();
  const isPipe = d.agent.kind === 'pipeline';
  const local = d.tools.filter((t) => t.source === 'local').length;
  const docs = d.tools.filter((t) => t.source === 'documents');
  const ox = d.tools.filter((t) => t.source === 'oxford');
  const chip = 'w-full rounded-sm px-2.5 py-1.5 text-left text-xs hover:bg-surface-hover';

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[620px] items-center" style={{ gridTemplateColumns: '1fr 24px 1fr 24px 1.2fr 24px 1fr' }}>
        <Box to={`${base}/providers`} className="border border-line-subtle p-2.5">
          <div className="text-ink-muted">Model</div>
          <div className="font-mono text-ink-strong">{d.provider.alias}</div>
          <div className="text-ink-muted">{d.agent.model}</div>
        </Box>
        <Line color="#8C8487" />
        <div className="rounded-sm border-[1.5px] border-[#8A1538] bg-[#F6E8EC] p-2.5 text-xs">
          <div className="text-[#6B0F2B]">Agent</div>
          <div className="break-all font-mono text-ink-strong">{d.agent.name}</div>
        </div>
        <Line />
        <div className="flex flex-col gap-1.5">
          {isPipe ? (
            <div className="rounded-sm border border-line-subtle px-2.5 py-1.5 text-xs text-ink-muted">No tools · single model call</div>
          ) : (
            <>
              <button type="button" onClick={onTools} className={`${chip} border border-[#8A1538] text-[#6B0F2B]`}>
                {local} local indicator tools
              </button>
              {docs.map((t) => (
                <button key={t.name} type="button" onClick={onTools} className={`${chip} border border-[#C8B49A] font-mono text-sand-ink`}>
                  {t.name}
                </button>
              ))}
              {ox.length > 0 && (
                <button type="button" onClick={onTools} className={`${chip} border border-[#0F766E] font-mono text-[#0F766E]`}>
                  {ox.map((t) => t.name).join(' · ')}
                </button>
              )}
            </>
          )}
        </div>
        <Line />
        <div className="flex flex-col gap-1.5 text-xs">
          {d.collections.map((c) => (
            <Box
              key={c.name}
              to={c.kind === 'collection' ? `${base}/collections/${c.name}` : c.kind === 'catalogue' ? `${base}/catalogue` : `${base}/collections`}
              className="border border-line-subtle"
            >
              <div className="text-ink-muted">{c.kind === 'catalogue' ? 'Catalogue' : 'Collection'}</div>
              <div className="font-mono text-ink-body">{c.kind === 'catalogue' ? 'v2026.11.3' : c.name}</div>
            </Box>
          ))}
          {d.mcp && (
            <Box to={`${base}/mcp`} className="border border-dashed border-[#0F766E]">
              <div className="text-[#0F766E]">External MCP</div>
              <div className="font-mono text-ink-body">{d.mcp}</div>
            </Box>
          )}
          {isPipe && (
            <Box to={`${base}/map`} className="border border-line-subtle">
              <div className="text-ink-muted">Pipeline</div>
              <div className="font-mono text-ink-body">Ask AI · chat</div>
            </Box>
          )}
          {!isPipe && d.collections.length === 0 && <div className="rounded-sm border border-line-subtle px-2.5 py-2 text-ink-muted">No collections</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test agent: a local simulation that "streams" the designed plan + tool steps.

type Phase = 'idle' | 'running' | 'composing' | 'done';
const SCALE = 1.5; // simulated seconds per wall-clock second (oxford reaches ~6.2 s while composing)

function TestAgentPanel({ d, runSignal }: { d: AgentDetail; runSignal: number }) {
  const base = useBase();
  const isPipe = d.agent.kind === 'pipeline';
  const [prompt, setPrompt] = React.useState(d.test.prompt);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [done, setDone] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const timers = React.useRef<number[]>([]);
  const started = React.useRef(0);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
  };

  const run = React.useCallback(() => {
    clear();
    setPhase('running');
    setDone(0);
    setElapsed(0);
    started.current = Date.now();
    timers.current.push(window.setInterval(() => setElapsed(((Date.now() - started.current) / 1000) * SCALE), 100));
    let t = 0;
    d.test.steps.forEach((s, i) => {
      t += s.ms;
      timers.current.push(window.setTimeout(() => setDone(i + 1), t));
    });
    timers.current.push(window.setTimeout(() => setPhase('composing'), t + 50));
    t += isPipe ? 900 : 2600;
    timers.current.push(
      window.setTimeout(() => {
        clear();
        setElapsed(((Date.now() - started.current) / 1000) * SCALE);
        setPhase('done');
      }, t),
    );
  }, [d, isPipe]);

  // Auto-run once on open, and again whenever the header "Test agent" button is pressed.
  React.useEffect(() => {
    run();
    return clear;
  }, [run]);
  React.useEffect(() => {
    if (runSignal > 0) {
      run();
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [runSignal, run]);

  const steps = d.test.steps.slice(0, done);
  const toolCalls = steps.filter((s) => s.mono).length;
  const secs = `${elapsed.toFixed(1)} s`;
  const next = d.test.steps[done];
  const traceId = d.agent.id === 'sceai_indicators_agent' ? '4be0d913' : '93c7a1f2';

  return (
    <div ref={panelRef} className="card flex min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3.5">
        <span className="flex text-brand">
          <FlaskConical size={16} />
        </span>
        <span className="whitespace-nowrap font-semibold text-ink-strong">Test agent</span>
        <span className="ml-auto whitespace-nowrap text-xs text-ink-muted">Runs as {d.test.runAs}</span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="min-h-16 resize-y rounded-card border border-line px-3 py-2.5 text-[13.5px] text-ink-strong outline-none focus:border-brand focus:shadow-focus"
          placeholder="Ask the agent a question"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-subtle">Simulated run · nothing is sent</span>
          <Button onClick={run} disabled={!prompt.trim()}>
            <Play size={14} />
            Run
          </Button>
        </div>

        {phase !== 'idle' && (
          <div className="flex flex-col text-[13px]">
            {steps.map((s) => (
              <StepRow key={s.name} s={s} state="ok" />
            ))}
            {phase === 'running' && next && <StepRow s={{ ...next, sub: next.mono ? 'Calling…' : 'Thinking…', dur: '…' }} state="run" />}
            {!isPipe && (phase === 'composing' || phase === 'done') && (
              <StepRow
                s={{ name: 'Compose answer', sub: phase === 'done' ? 'Answer written' : 'Streaming…', dur: phase === 'done' ? '1.7 s' : '—', mono: false, ms: 0 }}
                state={phase === 'done' ? 'ok' : 'run'}
              />
            )}
          </div>
        )}

        {(phase === 'running' || phase === 'composing') && (
          <div className="flex items-center gap-2 rounded-sm bg-surface-sunken px-3 py-2.5 text-[13px] text-ink-muted">
            <Spinner />
            {phase === 'composing'
              ? d.test.footer(toolCalls, secs)
              : isPipe
                ? `Calling ${d.provider.model} · ${secs}`
                : `${next && !next.mono ? 'Planning' : `Calling ${next?.name ?? ''}`} · ${toolCalls} / 15 tool calls · ${secs}`}
          </div>
        )}

        {phase === 'done' && (
          <>
            <div className="rounded-sm border border-line-subtle px-3 py-2.5 text-[13.5px] leading-relaxed text-ink-strong">{d.test.answer}</div>
            <div className="flex items-center gap-2 rounded-sm bg-success-bg px-3 py-2.5 text-[13px] text-success-fg">
              <Check size={14} />
              {isPipe ? `Succeeded · 1 model call · ${secs}` : `Succeeded · ${toolCalls} / 15 tool calls · ${secs}`}
            </div>
          </>
        )}

        {isPipe ? (
          <Link to={`${base}/conversations`} className="flex items-center gap-1.5 text-[13px]">
            Open recent Ask AI messages <ArrowRight size={14} />
          </Link>
        ) : (
          <Link to={`${base}/traces/${traceId}`} className="flex items-center gap-1.5 text-[13px]">
            Open live trace <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

function StepRow({ s, state }: { s: TestStep; state: 'ok' | 'run' }) {
  return (
    <div className="grid items-start gap-2.5 py-[7px]" style={{ gridTemplateColumns: '18px 1fr auto' }}>
      <span className="mt-0.5 grid h-3.5 w-3.5 place-items-center rounded-full text-white" style={{ background: state === 'ok' ? 'var(--success)' : 'var(--info)' }}>
        {state === 'ok' ? <Check size={10} strokeWidth={3} /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
      </span>
      <div className="min-w-0">
        <div className={`${s.mono ? 'font-mono' : ''} text-[12.5px] text-ink-strong`}>{s.name}</div>
        <div className="text-xs text-ink-muted">{s.sub}</div>
      </div>
      <span className="font-mono text-xs text-ink-muted">{s.dur}</span>
    </div>
  );
}

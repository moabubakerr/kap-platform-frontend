import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Cog, Copy, MessagesSquare, Network, ShieldCheck, ThumbsDown, ThumbsUp, TriangleAlert, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Page } from '@/components/common/layout';
import { AiMark, EmptyState, Skeleton } from '@/components/common/primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { Tooltip } from '@/components/ui/menu';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { useMessage } from '@/api/conversations';
import { fmtStage, type ChatMessage } from '@/mocks/conversations';
import { NumberedAnswer, UserRef } from './shared';

export default function MessagePage() {
  return (
    <ProjectPage resource="conversations">
      <MessageView />
    </ProjectPage>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-1.5 text-xs font-semibold text-ink-muted">{children}</div>;

function MessageView() {
  const { msgId } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const { data: m, isLoading } = useMessage(msgId);
  useCrumbs([msgId]);

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[520px]" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-72" />
      </Page>
    );
  }
  if (!m) {
    return (
      <Page>
        <EmptyState
          icon={<MessagesSquare size={22} />}
          title={`Message ${msgId} not found`}
          body="Ask AI keeps the message log for 7 days in this view."
          actions={<Button onClick={() => nav(`${base}/conversations`)}>Open conversations</Button>}
        />
      </Page>
    );
  }

  const status =
    m.answerType === 'Numeric' ? (
      <StatusPill status="succeeded" label="Verified" />
    ) : m.answerType === 'Template fallback' ? (
      <StatusPill status="partial" label="Template answer" />
    ) : m.answerType === 'Refusal' ? (
      <StatusPill status="waiting" label="Not answered" />
    ) : null;

  return (
    <div className="flex max-w-[1440px] flex-col gap-4 px-8 pb-12 pt-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 whitespace-nowrap text-[22px] font-semibold text-ink-strong">
              Message <span className="font-mono font-medium">{m.message_id}</span>
            </h1>
            <Badge tone={m.tone}>{m.answerType}</Badge>
            {status}
          </div>
          <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 whitespace-nowrap text-[13px] text-ink-muted">
            <span>
              Session <span className="font-mono text-ink-body">{m.session_id}</span> · message {m.sessionPos} of {m.sessionLen}
            </span>
            <span>
              User <UserRef name={m.user} base={base} className="text-[13px]" />
            </span>
            <span>Channel {m.channel}</span>
            <span>Language {m.lang}</span>
            <span>
              Latency <b className="text-ink-strong">{m.latency}</b>
            </span>
            <Tooltip content={m.abs}>
              <span>{m.rel}</span>
            </Tooltip>
            {m.feedback &&
              (m.feedback.helpful ? (
                <span className="flex items-center gap-1 text-success-fg">
                  <ThumbsUp size={14} />
                  Helpful
                </span>
              ) : (
                <span className="flex items-center gap-1 text-danger-fg">
                  <ThumbsDown size={14} />
                  Not helpful{m.feedback.reason ? ` · ${m.feedback.reason}` : ''}
                </span>
              ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => nav(`${base}/map?view=pipe&msg=${m.message_id}`)}>
            <Network size={15} />
            Open in pipeline map
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              toast.success('Link copied');
            }}
          >
            <Copy size={15} />
            Copy link
          </Button>
        </div>
      </div>

      {/* Question / answer + understanding */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
        <div className="card flex min-w-0 flex-col gap-3 p-4">
          <div>
            <Label>Question</Label>
            <div dir="auto" className="rounded-sm bg-surface-sunken px-3 py-2.5 text-left text-ink-strong">
              {m.question}
            </div>
          </div>
          <div>
            <Label>Answer · {m.composer}</Label>
            <NumberedAnswer parts={m.answerParts} />
          </div>
          {m.followUps.length > 0 && (
            <div>
              <Label>Suggested follow-ups · Follow-up Agent</Label>
              <div className="flex flex-wrap gap-1.5">
                {m.followUps.map((f) => (
                  <span key={f} dir="auto" className="rounded-card border border-line px-2.5 py-1 text-[12.5px] leading-[1.4]">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {m.feedback && m.feedback.comment && (
            <div>
              <Label>User feedback · rating {m.feedback.rating} of 5</Label>
              <div dir="auto" className={cn('rounded-sm px-3 py-2 text-left text-[13px]', m.feedback.helpful ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')}>
                {m.feedback.comment}
              </div>
            </div>
          )}
        </div>
        <Understanding m={m} />
      </div>

      <PipelineTrace m={m} />

      <Provenance m={m} />
    </div>
  );
}

function Understanding({ m }: { m: ChatMessage }) {
  const u = m.understanding;
  const mono = 'font-mono text-[12.5px]';
  const banner =
    m.verifier.tone === 'ok'
      ? 'bg-success-bg text-success-fg'
      : m.verifier.tone === 'warn'
        ? 'bg-warning-bg text-warning-fg'
        : 'bg-surface-sunken text-ink-muted';
  return (
    <div className="card flex min-w-0 flex-col gap-3 p-4">
      <div className="font-semibold text-ink-strong">Understanding</div>
      <div className="grid gap-x-3 gap-y-2 text-[13px]" style={{ gridTemplateColumns: '110px 1fr' }}>
        <span className="text-ink-muted">Computation</span>
        <span className={mono}>{u.computation}</span>
        <span className="text-ink-muted">Indicator</span>
        <span>
          {u.indicator}
          {u.viaPicker && <span className="text-[11.5px] text-warning-fg"> · via Indicator Picker</span>}
        </span>
        <span className="text-ink-muted">Countries</span>
        <span className={mono}>{u.countries}</span>
        <span className="text-ink-muted">Periods</span>
        <span className={mono}>{u.periods}</span>
        <span className="text-ink-muted">Frequency</span>
        <span className={mono}>{u.frequency}</span>
      </div>
      <div className={cn('flex items-center gap-2 rounded-sm px-3 py-2.5 text-[13px] font-medium', banner)}>
        {m.verifier.tone === 'ok' ? <ShieldCheck size={16} /> : m.verifier.tone === 'warn' ? <TriangleAlert size={16} /> : <Info size={16} />}
        {m.verifier.text}
      </div>
    </div>
  );
}

const STAGE_GRID = '110px 210px minmax(0,1fr) 64px';

function PipelineTrace({ m }: { m: ChatMessage }) {
  const base = useBase();
  const [sel, setSel] = React.useState(0);
  React.useEffect(() => setSel(0), [m.message_id]);
  const T = Math.max(m.latency_ms / 1000, 0.001);
  // Design labels whole seconds (0 · 1 s · 2 s · 3 s · 4.1 s) for ~4 s messages; quarters otherwise.
  const ticks = Math.abs(T - 4) < 0.6 ? ['0', '1 s', '2 s', '3 s', m.latency] : ['0', `${(T / 4).toFixed(1)} s`, `${(T / 2).toFixed(1)} s`, `${((3 * T) / 4).toFixed(1)} s`, m.latency];
  const cs = m.stages[Math.min(sel, m.stages.length - 1)];

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="font-semibold text-ink-strong">Pipeline trace · {m.latency}</div>
        <div className="flex gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-[5px]">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-brand" />
            AI agent
          </span>
          <span className="flex items-center gap-[5px]">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-model" />
            Code step
          </span>
        </div>
      </div>
      <div className="grid items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))' }}>
        <div className="min-w-0 overflow-x-auto">
          <div className="grid gap-2.5 bg-surface-sunken px-3.5 py-2 text-[11.5px] text-ink-subtle" style={{ gridTemplateColumns: STAGE_GRID }}>
            <span>Stage</span>
            <span>Agent or step</span>
            <div className="flex justify-between">
              {ticks.map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
            <span className="text-right">Time</span>
          </div>
          {m.stages.map((g, i) => {
            const ai = g.kind === 'ai';
            return (
              <button
                type="button"
                key={i}
                onClick={() => setSel(i)}
                className={cn('grid w-full items-center gap-2.5 border-t border-line-subtle px-3.5 py-2 text-left', i === sel ? 'bg-brand-tint' : 'hover:bg-surface-hover', g.skipped && 'opacity-50')}
                style={{ gridTemplateColumns: STAGE_GRID }}
              >
                <span className="whitespace-nowrap text-xs text-ink-muted">{g.stage}</span>
                <span className="flex min-w-0 items-center gap-[7px]">
                  <span
                    className="grid h-5 w-5 flex-none place-items-center"
                    style={{ borderRadius: ai ? '50%' : 2, background: ai ? '#F6E8EC' : '#E4DFDD', color: ai ? '#8A1538' : 'var(--text-muted)' }}
                  >
                    {ai ? <AiMark size={12} /> : <Cog size={12} />}
                  </span>
                  <span className={cn('ellipsis text-[12.5px]', g.failed ? 'text-danger-fg' : 'text-ink-strong')}>{g.name}</span>
                </span>
                <div className="relative h-4">
                  <div
                    className="absolute bottom-0 top-0 min-w-[3px] rounded-sm"
                    style={{ left: `${((g.startS / T) * 100).toFixed(2)}%`, width: `${((g.durS / T) * 100).toFixed(2)}%`, background: g.failed ? 'var(--danger)' : ai ? '#8A1538' : '#8C8487' }}
                  />
                </div>
                <span className="text-right font-mono text-xs">{fmtStage(g.durS)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 border-l border-line-subtle p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink-strong">{cs.name}</span>
            <span className="text-xs text-ink-muted">{cs.detail}</span>
            <span className="ml-auto font-mono text-[12.5px]">{fmtStage(cs.durS)}</span>
          </div>
          <div className="text-[12.5px] text-ink-muted">
            {cs.note}
            {cs.agentId && (
              <>
                {' '}
                <Link to={`${base}/agents/${cs.agentId}`}>Open agent</Link>
              </>
            )}
          </div>
          <div className="text-xs font-semibold text-ink-muted">Input</div>
          <pre dir="auto" className="m-0 whitespace-pre-wrap break-words rounded-sm border border-line-subtle bg-surface-sunken px-3 py-2.5 text-left font-mono text-xs leading-[1.6]">
            {cs.input}
          </pre>
          <div className="text-xs font-semibold text-ink-muted">Output</div>
          <pre dir="auto" className="m-0 whitespace-pre-wrap break-words rounded-sm border border-line-subtle bg-surface-sunken px-3 py-2.5 text-left font-mono text-xs leading-[1.6]">
            {cs.output}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Provenance({ m }: { m: ChatMessage }) {
  const th = 'whitespace-nowrap px-3 py-[9px] text-left text-xs font-semibold text-ink-muted';
  const td = 'px-3 py-[9px]';
  const mono = 'font-mono text-[12.5px]';
  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
          <div className="font-semibold text-ink-strong">Number provenance</div>
        </div>
        {m.citations.length === 0 ? (
          <div className="px-4 py-4 text-[13px] text-ink-muted">This answer contains no numbers.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-sunken">
                  <th className={th}>#</th>
                  <th className={cn(th, 'text-right')}>Value</th>
                  <th className={th}>Indicator</th>
                  <th className={th}>Period</th>
                  <th className={th}>Source</th>
                  <th className={th}>Produced by</th>
                  <th className={th}>Catalogue version</th>
                  <th className={th}>Verifier</th>
                </tr>
              </thead>
              <tbody>
                {m.citations.map((c) => (
                  <tr key={c.position} className="border-t border-line-subtle">
                    <td className={cn(td, mono)}>{c.position}</td>
                    <td className={cn(td, mono, 'whitespace-nowrap text-right font-semibold')} dir="auto">
                      {c.value}
                    </td>
                    <td className={td}>{c.indicator}</td>
                    <td className={cn(td, mono, 'whitespace-nowrap')}>{c.period_label}</td>
                    <td className={td}>{c.source}</td>
                    <td className={cn(td, mono)}>{c.produced_by}</td>
                    <td className={cn(td, mono)}>{c.catalogue_version}</td>
                    <td className={td}>
                      <Badge tone={c.verifier === 'Matched' ? 'success' : 'danger'}>{c.verifier}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {m.passages.length > 0 && (
        <div className="card">
          <div className="border-b border-line-subtle px-4 py-3.5 font-semibold text-ink-strong">Article sources</div>
          <div className="flex flex-col">
            {m.passages.map((p) => (
              <div key={p.position} className="flex items-center gap-3 border-t border-line-subtle px-4 py-2.5 text-[13px] first:border-t-0">
                <span className="font-mono text-[12.5px] text-ink-muted">{p.position}</span>
                <span className="h-2 w-2 flex-none rounded-[2px] bg-sand" />
                <span className="text-ink-strong">{p.doc}</span>
                <span className="text-ink-muted">· {p.section}</span>
                <span className="ml-auto font-mono text-xs text-ink-subtle">SCEAI articles</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

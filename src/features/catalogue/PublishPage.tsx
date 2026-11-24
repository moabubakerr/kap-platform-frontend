import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Info, Minus, Upload } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { Page } from '@/components/common/layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CURRENT_VERSION,
  NEXT_VERSION,
  PUBLISH_CHANGES,
  PUBLISH_CHECKS,
  PUBLISH_EVAL,
  PUBLISH_SUMMARY,
  RELEASE_NOTES,
  indicatorByCode,
  type ChangeKind,
} from '@/mocks/catalogue';
import { SimpleTable, readOnly, tdc } from './shared';

const STEPS: [string, string][] = [
  ['Changes', '9 indicators affected'],
  ['Checks', '5 passed · 1 warning'],
  ['Review and publish', 'Notes and rollout'],
];

const KIND: Record<ChangeKind, [string, string]> = {
  Added: ['var(--success-bg)', 'var(--success-fg)'],
  Changed: ['var(--info-bg)', 'var(--info)'],
  Retired: ['var(--danger-bg)', 'var(--danger-fg)'],
};

const ROLLOUTS = ['Immediately, for new messages', 'Staged: 10% of messages for 24 h', 'Scheduled: tonight 02:00 AST'];

export default function PublishPage() {
  const base = useBase();
  const nav = useNavigate();
  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [rollout, setRollout] = React.useState(ROLLOUTS[0]);
  const [notes, setNotes] = React.useState(RELEASE_NOTES);
  const [ack, setAck] = React.useState(true);
  useCrumbs([`Publish ${NEXT_VERSION}`]);

  const head = (t: string, meta?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
      <div className="font-semibold text-ink-strong">{t}</div>
      {meta}
    </div>
  );

  return (
    <ProjectPage resource="catalogue versions">
      <Page className="max-w-[1240px] gap-4">
        <Link to={`${base}/catalogue`} className="flex w-fit items-center gap-1.5 text-[13px]">
          <ChevronLeft size={16} strokeWidth={1.75} />
          Back to catalogue
        </Link>
        <div>
          <h1 className="h1">Publish catalogue version</h1>
          <p className="mt-1 text-ink-muted">Review what changes, check that Ask AI still answers correctly, then publish. Nothing changes for users until you confirm.</p>
        </div>

        <div className="card flex flex-wrap items-center gap-4 px-4 py-3">
          <div>
            <div className="text-[11.5px] text-ink-muted">Current</div>
            <div className="font-mono text-[12.5px] font-semibold text-ink-strong">{CURRENT_VERSION}</div>
          </div>
          <ArrowRight size={16} strokeWidth={1.75} className="text-ink-subtle" />
          <div>
            <div className="text-[11.5px] text-ink-muted">New version</div>
            <div className="font-mono text-[12.5px] font-semibold text-brand">{NEXT_VERSION}</div>
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap gap-2">
            {PUBLISH_SUMMARY.map((x) => (
              <span key={x.text} className="flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-[12.5px] font-semibold" style={{ background: x.bg, color: x.fg }}>
                {x.text}
              </span>
            ))}
          </div>
        </div>

        <div className="grid items-start gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          <ol className="flex flex-col gap-0.5 md:sticky md:top-3">
            {STEPS.map(([n, d], i) => {
              const isDone = i < step || done;
              const cur = i === step && !done;
              return (
                <li key={n}>
                  <button type="button" onClick={() => setStep(i)} className={cn('flex w-full items-center gap-2.5 rounded-sm px-2.5 py-[9px] text-left', cur && 'bg-brand-tint')}>
                    <span
                      className="grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-semibold"
                      style={{
                        background: isDone ? 'var(--brand)' : cur ? '#fff' : 'transparent',
                        color: isDone ? '#fff' : cur ? 'var(--brand)' : 'var(--text-muted)',
                        border: `1.5px solid ${isDone || cur ? 'var(--brand)' : 'var(--border-default)'}`,
                      }}
                    >
                      {isDone ? <Check size={12} strokeWidth={3} /> : i + 1}
                    </span>
                    <div>
                      <div className={cn('text-[13.5px]', cur ? 'font-semibold text-brand-strong' : 'font-medium text-ink-strong')}>{n}</div>
                      <div className="text-[11.5px] text-ink-muted">{d}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="card min-w-0">
            {step === 0 && (
              <>
                {head(`1 · Changes in ${NEXT_VERSION}`, <span className="text-[12.5px] text-ink-muted">From ingest package pkg_2024Q4_indicators and 3 manual edits</span>)}
                <SimpleTable head={['Change', 'Indicator', 'Field', 'Before', 'After', 'By']} minWidth={760}>
                  {PUBLISH_CHANGES.map((c, i) => {
                    const [bg, fg] = KIND[c.kind];
                    const exists = !!indicatorByCode(c.code);
                    return (
                      <tr key={i} className={exists ? 'cursor-pointer hover:bg-surface-hover' : undefined} onClick={exists ? () => nav(`${base}/catalogue/${c.code}`) : undefined}>
                        <td className={tdc}>
                          <span className="rounded-[3px] px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: bg, color: fg }}>
                            {c.kind}
                          </span>
                        </td>
                        <td className={tdc}>
                          <div className="font-medium text-ink-strong">{c.name}</div>
                          <div className="font-mono text-[12.5px] text-ink-muted">{c.code}</div>
                        </td>
                        <td className={`${tdc} text-ink-muted`}>{c.field}</td>
                        <td className={`${tdc} text-[12.5px]`}>
                          <span
                            className="rounded-[3px] px-[5px] py-px"
                            style={{ background: c.kind === 'Added' ? 'transparent' : 'var(--danger-bg)', textDecoration: c.kind === 'Retired' ? 'none' : 'line-through' }}
                          >
                            {c.before}
                          </span>
                        </td>
                        <td className={`${tdc} text-[12.5px]`}>
                          <span className="rounded-[3px] px-[5px] py-px" style={{ background: c.kind === 'Retired' ? 'var(--danger-bg)' : 'var(--success-bg)' }}>
                            {c.after}
                          </span>
                        </td>
                        <td className={`${tdc} font-mono text-[12.5px] text-ink-muted`}>{c.by}</td>
                      </tr>
                    );
                  })}
                </SimpleTable>
              </>
            )}

            {step === 1 && (
              <>
                {head('2 · Checks', <span className="text-[12.5px] font-semibold text-success-fg">5 passed · 1 warning</span>)}
                <div className="py-1.5">
                  {PUBLISH_CHECKS.map((c, i) => (
                    <div key={c.title} className={cn('grid items-start gap-3 px-4 py-3', i > 0 && 'border-t border-line-subtle')} style={{ gridTemplateColumns: '22px minmax(0, 1fr) auto' }}>
                      <span className="grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: c.ok ? 'var(--success)' : 'var(--warning)' }}>
                        {c.ok ? <Check size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                      </span>
                      <div>
                        <div className="text-[13.5px] font-semibold text-ink-strong">{c.title}</div>
                        <div className="mt-0.5 text-[12.5px] text-ink-muted">{c.detail}</div>
                      </div>
                      <span className="whitespace-nowrap font-mono text-[12.5px]" style={{ color: c.ok ? 'var(--success-fg)' : 'var(--warning-fg)' }}>
                        {c.metric}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mx-4 mb-4 rounded-sm border border-line-subtle bg-surface-sunken p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-ink-strong">Regression questions · 120 EN + 80 AR</span>
                    <span className="text-[12.5px] text-ink-muted">Ran 4 min ago · 3 m 12 s</span>
                  </div>
                  <div className="mt-2.5 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                    {PUBLISH_EVAL.map((e) => (
                      <div key={e.k}>
                        <div className="text-xs text-ink-muted">{e.k}</div>
                        <div className="text-lg font-semibold text-ink-strong">{e.v}</div>
                        <div className="text-[11.5px]" style={{ color: e.c }}>
                          {e.d}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                {head('3 · Review and publish')}
                <div className="flex flex-col gap-[18px] p-4">
                  <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-ink-strong">Version</span>
                      <input readOnly value={NEXT_VERSION} className="h-10 rounded-card border border-line bg-surface px-3 text-sm text-ink-strong outline-none focus:border-brand" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-ink-strong">Rollout</span>
                      <select value={rollout} onChange={(e) => setRollout(e.target.value)} className="h-10 rounded-card border border-line bg-surface px-2.5 text-sm text-ink-strong outline-none focus:border-brand">
                        {ROLLOUTS.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col">
                    <span className="mb-1.5 text-sm font-medium">Release notes</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="min-h-[90px] resize-y rounded-card border border-line px-3 py-2.5 text-[13.5px] leading-relaxed text-ink-body outline-none focus:border-brand"
                    />
                  </label>
                  <div className="flex gap-2.5 rounded-card bg-info-bg p-3.5 text-[13px] text-info">
                    <Info size={16} strokeWidth={1.75} className="mt-px flex-none" />
                    <div>
                      <b>What changes for users.</b> New Ask AI messages use {NEXT_VERSION}. Messages already in progress finish on {CURRENT_VERSION}. The Indicator Picker will see 215 names instead of 214. You can roll back to {CURRENT_VERSION} at any time from Version history.
                    </div>
                  </div>
                  <button type="button" onClick={() => setAck((a) => !a)} className="flex items-start gap-2.5 text-left text-[13px]">
                    <span className={cn('mt-px grid h-4 w-4 flex-none place-items-center rounded-[3px] border', ack ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface')}>
                      {ack && <Check size={11} strokeWidth={3} />}
                    </span>
                    I have reviewed the 1 warning (Arabic alias coverage) and want to publish anyway.
                  </button>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-card border-t border-line-subtle bg-surface-sunken px-4 py-3.5">
              <Button variant="ghost" onClick={readOnly}>
                Save as draft
              </Button>
              <div className="flex flex-wrap gap-2">
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    <ChevronLeft size={15} strokeWidth={1.75} />
                    Back
                  </Button>
                )}
                {step < 2 && (
                  <Button onClick={() => setStep(step + 1)}>
                    {step === 0 ? 'Next: Checks' : 'Next: Review'}
                    <ChevronRight size={15} strokeWidth={1.75} />
                  </Button>
                )}
                {step === 2 && (
                  <Button onClick={() => setDone(true)} disabled={!ack || done}>
                    <Upload size={15} strokeWidth={1.75} />
                    Publish {NEXT_VERSION}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {done && (
          <div className="card flex flex-wrap items-center gap-3 border-success px-4 py-3.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-success text-white">
              <Check size={16} strokeWidth={2.5} />
            </span>
            <div className="min-w-[240px] flex-1">
              <div className="font-semibold text-ink-strong">{NEXT_VERSION} is live</div>
              <div className="text-[12.5px] text-ink-muted">Published by m.alkuwari just now · Ask AI uses it for new messages</div>
            </div>
            <Button variant="outline" onClick={() => nav(`${base}/catalogue`)}>
              Back to catalogue
            </Button>
          </div>
        )}
      </Page>
    </ProjectPage>
  );
}

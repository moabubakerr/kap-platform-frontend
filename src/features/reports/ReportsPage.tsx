import * as React from 'react';
import { Link } from 'react-router-dom';
import { Check, Mail, Plus, Send, X } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useReports } from '@/api/governance';
import { cn } from '@/lib/utils';
import { REP_SECTIONS, type RepDel, type RepFmt, type RepFreq, type RepRange, type RepSection } from '@/mocks/governance';
import { ListSkeleton, PlainTable, SelectField, readOnly } from '@/features/users/identity-ui';
import { ReportPreview } from './ReportPreview';
import { DAY_OPTIONS, UNIT, formFrom, type ReportForm } from './form';

export default function ReportsPage() {
  const { data } = useReports();
  const [selId, setSelId] = React.useState('weekly-summary');
  const [form, setForm] = React.useState<ReportForm | null>(null);

  React.useEffect(() => {
    const r = data?.reports.find((x) => x.id === selId);
    if (r) setForm(formFrom(r));
  }, [data, selId]);

  const set = <K extends keyof ReportForm>(k: K, v: ReportForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <ProjectPage resource="scheduled reports">
      <Page className="gap-4">
        <PageHeader
          title="Scheduled reports"
          count={data?.reports.length ?? 4}
          description="Recurring summaries of SCEAI agent activity, Ask AI usage and feedback, delivered as PDF or Excel."
          actions={
            <Button onClick={readOnly}>
              <Plus size={16} />
              New schedule
            </Button>
          }
        />
        {!data || !form ? (
          <ListSkeleton rows={8} />
        ) : (
          <>
            <div className="card overflow-hidden">
              <PlainTable head={['Report', 'Sections', 'Frequency', 'Recipients', 'Format', 'Next run', 'Last run', '']} minWidth={1040}>
                {data.reports.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelId(r.id)}
                    className={cn('cursor-pointer border-t border-line-subtle', r.id === selId ? 'bg-brand-tint' : 'hover:bg-surface-hover')}
                  >
                    <td className="px-3 py-[9px]">
                      <div className="font-semibold text-ink-strong">{r.name}</div>
                      <div className="text-xs text-ink-muted">Owner {r.owner}</div>
                    </td>
                    <td className="max-w-[240px] px-3 py-[9px] text-ink-muted">
                      <div className="truncate">{r.sectionsLabel}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-[9px]">{r.freqLabel}</td>
                    <td className="px-3 py-[9px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Mail size={15} className="text-ink-muted" />
                        {r.recipientsLabel}
                      </div>
                    </td>
                    <td className="px-3 py-[9px]">
                      <span className="rounded-card bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] font-semibold">{r.format}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-[9px]">{r.next}</td>
                    <td className="px-3 py-[9px]">
                      <StatusPill status={r.status} label={r.statusLabel} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-[9px] text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          readOnly();
                        }}
                        className="font-medium text-brand hover:underline"
                      >
                        Run now
                      </button>
                    </td>
                  </tr>
                ))}
              </PlainTable>
            </div>

            <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}>
              <EditPanel title={data.reports.find((r) => r.id === selId)?.name ?? form.name} form={form} set={set} />
              <ReportPreview form={form} />
            </div>

            <History history={data.history} onPick={setSelId} />
          </>
        )}
      </Page>
    </ProjectPage>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-sm font-medium text-ink-body">{children}</div>;
}

/** Design segmented control: bordered strip, selected = brand tint. */
function Seg<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex w-fit max-w-full flex-wrap overflow-hidden rounded-card border border-line" role="radiogroup">
      {options.map(([k, l], i) => {
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(k)}
            className={cn('whitespace-nowrap px-3.5 py-2 text-[13px]', i > 0 && 'border-l border-line-subtle', on ? 'bg-brand-tint font-semibold text-brand-strong' : 'bg-surface text-ink-body hover:bg-surface-hover')}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Box({ on }: { on: boolean }) {
  return (
    <span
      className="mt-px grid h-4 w-4 flex-none place-items-center rounded-[3px] text-white"
      style={{ background: on ? 'var(--brand)' : 'transparent', border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border-strong)'}` }}
    >
      {on && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

function EditPanel({ title, form, set }: { title: string; form: ReportForm; set: <K extends keyof ReportForm>(k: K, v: ReportForm[K]) => void }) {
  const [draft, setDraft] = React.useState('');
  const toggle = (k: RepSection) => set('sections', form.sections.includes(k) ? form.sections.filter((s) => s !== k) : [...form.sections, k]);
  const setFreq = (f: RepFreq) => {
    set('freq', f);
    if (!DAY_OPTIONS[f].includes(form.day)) set('day', DAY_OPTIONS[f][0]);
  };
  const addRecipient = () => {
    const v = draft.trim();
    if (v && !form.recipients.includes(v)) set('recipients', [...form.recipients, v]);
    setDraft('');
  };
  const unit = UNIT[form.freq];

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="font-semibold text-ink-strong">Edit schedule · {title}</div>
        <span className="text-xs text-ink-muted">Changes apply from the next run</span>
      </div>
      <div className="flex flex-col gap-[18px] p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-body">Report name</span>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="h-10 rounded-card border border-line bg-surface px-3 text-[13.5px] text-ink-strong outline-none focus-visible:border-brand focus-visible:shadow-focus"
          />
        </label>

        <div>
          <Label>Sections</Label>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {REP_SECTIONS.map((c) => {
              const on = form.sections.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(c.key)}
                  className="flex items-start gap-2.5 rounded-sm px-3 py-2.5 text-left"
                  style={{ border: `1px solid ${on ? 'var(--brand-tint)' : 'var(--border-default)'}`, background: on ? '#FCF7F8' : 'var(--surface-card)' }}
                >
                  <Box on={on} />
                  <span>
                    <span className="block text-[13px] font-medium text-ink-strong">{c.name}</span>
                    <span className="text-xs text-ink-muted">{c.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <Label>Frequency</Label>
            <Seg<RepFreq>
              value={form.freq}
              onChange={setFreq}
              options={[
                ['daily', 'Daily'],
                ['weekly', 'Weekly'],
                ['monthly', 'Monthly'],
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <SelectField label={form.freq === 'monthly' ? 'Day of month' : 'Day'} value={form.day} onChange={(v) => set('day', v)} className="min-w-[130px] flex-[1_1_130px]" options={DAY_OPTIONS[form.freq].map((d) => ({ value: d, label: d }))} />
            <SelectField label="Time (AST)" value={form.time} onChange={(v) => set('time', v)} className="min-w-[130px] flex-[1_1_130px]" options={['07:00', '08:00', '17:00'].map((d) => ({ value: d, label: d }))} />
          </div>
        </div>

        <div>
          <Label>Covers</Label>
          <Seg<RepRange>
            value={form.range}
            onChange={(v) => set('range', v)}
            options={[
              ['last', `Previous ${unit}`],
              ['mtd', 'Month to date'],
              ['30', 'Last 30 days'],
            ]}
          />
        </div>

        <div>
          <Label>Recipients</Label>
          <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-card border border-line px-2 py-1.5">
            {form.recipients.map((p) => (
              <span key={p} className="flex items-center gap-1.5 rounded-sm bg-surface-sunken py-[3px] pl-2.5 pr-1.5 text-[12.5px]">
                {p}
                <button type="button" aria-label={`Remove ${p}`} onClick={() => set('recipients', form.recipients.filter((x) => x !== p))} className="flex text-ink-subtle hover:text-ink-strong">
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addRecipient();
                } else if (e.key === 'Backspace' && !draft && form.recipients.length) set('recipients', form.recipients.slice(0, -1));
              }}
              onBlur={addRecipient}
              placeholder="Add a user, group or email"
              className="min-w-[180px] flex-1 bg-transparent pl-1 text-[13px] outline-none placeholder:text-ink-subtle"
            />
          </div>
          <div className="mt-1.5 text-xs text-ink-muted">Recipients only see sections they have access to. External emails receive the summary page only.</div>
        </div>

        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <Label>Format</Label>
            <Seg<RepFmt>
              value={form.fmt}
              onChange={(v) => set('fmt', v)}
              options={[
                ['pdf', 'PDF'],
                ['xlsx', 'Excel'],
                ['both', 'Both'],
              ]}
            />
          </div>
          <div>
            <Label>Delivery</Label>
            <Seg<RepDel>
              value={form.del}
              onChange={(v) => set('del', v)}
              options={[
                ['email', 'Email'],
                ['teams', 'Teams'],
                ['both', 'Email + Teams'],
              ]}
            />
          </div>
        </div>

        <button type="button" role="checkbox" aria-checked={form.skipEmpty} onClick={() => set('skipEmpty', !form.skipEmpty)} className="flex items-start gap-2.5 text-left text-[13px]">
          <Box on={form.skipEmpty} />
          <span>Skip sending when there was no activity in the period</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-card border-t border-line-subtle bg-surface-sunken px-4 py-3.5">
        <Button variant="ghost" onClick={readOnly}>
          Delete schedule
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={readOnly}>
            <Send size={15} />
            Send test to me
          </Button>
          <Button onClick={readOnly}>Save schedule</Button>
        </div>
      </div>
    </div>
  );
}

function History({ history, onPick }: { history: NonNullable<ReturnType<typeof useReports>['data']>['history']; onPick: (id: string) => void }) {
  const base = useBase();
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="font-semibold text-ink-strong">Delivery history</div>
        <span className="text-[12.5px] text-ink-muted">Last 30 days</span>
      </div>
      <PlainTable head={['Sent', 'Report', 'Period', 'Recipients', 'Delivery', 'Status', '']} minWidth={860} align={['left', 'left', 'left', 'right']}>
        {history.map((x, i) => (
          <tr key={i} className="border-t border-line-subtle">
            <td className="whitespace-nowrap px-3 py-[9px]">{x.sent}</td>
            <td className="px-3 py-[9px] font-medium">
              <button type="button" onClick={() => onPick(x.reportId)} className="text-left text-ink-strong hover:text-brand hover:underline">
                {x.report}
              </button>
            </td>
            <td className="whitespace-nowrap px-3 py-[9px] text-ink-muted">{x.period}</td>
            <td className="px-3 py-[9px] text-right font-mono text-[12.5px]">{x.recipients}</td>
            <td className="whitespace-nowrap px-3 py-[9px]">{x.delivery}</td>
            <td className="px-3 py-[9px]">
              <StatusPill status={x.status} label={x.statusLabel} />
              {x.err && <div className="text-[11.5px] text-danger-fg">{x.err}</div>}
            </td>
            <td className="whitespace-nowrap px-3 py-[9px] text-right">
              {x.action === 'Details' ? (
                <Link to={`${base}/audit`} className="font-medium text-brand">
                  {x.action}
                </Link>
              ) : (
                <button type="button" onClick={readOnly} className="font-medium text-brand hover:underline">
                  {x.action}
                </button>
              )}
            </td>
          </tr>
        ))}
      </PlainTable>
    </div>
  );
}

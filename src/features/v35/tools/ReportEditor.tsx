/**
 * Scheduled report editor and live PDF preview (prototype markup `s.reports`:
 * report editor card + "Preview · page 1 of 4"). Rendered as a custom section
 * of the Scheduled Reports screen; the engine has no segmented or check-card
 * fields, so this part is bespoke.
 */
import * as React from 'react';
import { Check, Download, Mail, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { REPORT_ATTENTION, REPORT_DAYS, REPORT_KPI, REPORT_SECTIONS, REPORT_TOP_Q, type Report } from '@/v35/data/toolsConfidence';

export type ReportDraft = Omit<Report, 'next' | 'p' | 'pl' | 'on'>;

function Seg<T extends string>({ label, value, opts, onChange, disabled }: { label: string; value: T; opts: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs text-ink-muted">{label}</div>
      <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-sm border border-line">
        {opts.map(([k, l]) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={cn('border-r border-line px-3 py-1.5 text-[13px] last:border-r-0', value === k ? 'bg-brand-tint font-semibold text-brand' : 'bg-surface text-ink-body', disabled && 'cursor-default')}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const selCls = 'h-[34px] rounded-sm border border-line bg-surface px-2 text-[13px] text-ink-body';

export function ReportEditor({
  E, setE, isNew, dirty, canEdit, on, tn, onSave, onDelete, onPause, onTest,
}: {
  E: ReportDraft;
  setE: (p: Partial<ReportDraft>) => void;
  isNew: boolean;
  dirty: boolean;
  canEdit: boolean;
  on: boolean;
  tn: string;
  onSave: () => void;
  onDelete: () => void;
  onPause: () => void;
  onTest: () => void;
}) {
  const [rcp, setRcp] = React.useState('');
  const ro = !canEdit;
  const title = ro ? `Report · ${E.n}` : `${isNew ? 'New report · ' : 'Edit report · '}${E.n || 'Untitled'}`;
  const addRcp = () => {
    const v = rcp.trim();
    if (v && !E.rcp.includes(v)) setE({ rcp: E.rcp.concat([v]) });
    setRcp('');
  };
  const max = Math.max(...REPORT_DAYS.map(([o, f, r]) => o + f + r));
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
      {/* ---------------- editor */}
      <div className="card flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
          <div className="font-semibold text-ink-strong">{title}</div>
          <span className="text-xs text-ink-muted">Changes apply from the next run{dirty ? ' · unsaved changes' : ''}</span>
        </div>
        <fieldset disabled={ro} className="flex flex-col gap-4 px-4 py-3.5">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Report name
            <input type="text" value={E.n} onChange={(e) => setE({ n: e.target.value })} className={cn(selCls, 'w-full')} />
          </label>
          <div>
            <div className="mb-1 text-xs text-ink-muted">Sections</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              {REPORT_SECTIONS.map(([k, n, d]) => {
                const sel = E.sec.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => setE({ sec: sel ? E.sec.filter((x) => x !== k) : E.sec.concat([k]) })}
                    className={cn('flex items-start gap-2 rounded-sm border px-2.5 py-2 text-left', sel ? 'border-brand bg-brand-tint' : 'border-line bg-surface')}
                  >
                    <span className={cn('mt-0.5 inline-flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3px] border', sel ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface')}>{sel && <Check size={11} />}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink-strong">{n}</span>
                      <span className="block text-xs text-ink-muted">{d}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <Seg label="Frequency" value={E.freq} opts={[['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]} onChange={(freq) => setE({ freq, day: freq === 'monthly' ? '1st' : freq === 'weekly' ? 'Sunday' : '' })} disabled={ro} />
            {E.freq !== 'daily' && (
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                Day
                <select aria-label="Day" value={E.day} onChange={(e) => setE({ day: e.target.value })} className={selCls}>
                  {(E.freq === 'monthly' ? ['1st', '15th', 'Last day'] : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']).map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Time (AST)
              <select aria-label="Time (AST)" value={E.time} onChange={(e) => setE({ time: e.target.value })} className={selCls}>
                {['06:00', '07:00', '08:00', '12:00', '17:00'].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          </div>
          <Seg label="Covers" value={E.range} opts={[['last', 'Previous week'], ['mtd', 'Month to date'], ['30', 'Last 30 days']]} onChange={(range) => setE({ range })} disabled={ro} />
          <div>
            <div className="mb-1 text-xs text-ink-muted">Recipients</div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-line bg-surface px-2 py-1.5">
              {E.rcp.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 rounded-sm bg-surface-sunken px-2 py-0.5 text-[12.5px] text-ink-body">
                  {n}
                  {!ro && (
                    <button type="button" aria-label={`Remove ${n}`} onClick={() => setE({ rcp: E.rcp.filter((y) => y !== n) })} className="text-ink-muted hover:text-ink-strong">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              {!ro && (
                <input
                  type="text"
                  aria-label="Add recipient"
                  placeholder="Add a user, group or email and press Enter"
                  value={rcp}
                  onChange={(e) => setRcp(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRcp(); } }}
                  onBlur={addRcp}
                  className="min-w-[220px] flex-1 bg-transparent text-[13px] outline-none"
                />
              )}
            </div>
            <div className="mt-1 text-xs text-ink-muted">Recipients only see sections they have access to. External emails receive the summary page only.</div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Seg label="Format" value={E.fmt} opts={[['pdf', 'PDF'], ['xlsx', 'Excel'], ['both', 'Both']]} onChange={(fmt) => setE({ fmt })} disabled={ro} />
            <Seg label="Delivery" value={E.del} opts={[['email', 'Email'], ['teams', 'Teams'], ['both', 'Email + Teams']]} onChange={(del) => setE({ del })} disabled={ro} />
          </div>
          <div className="flex items-center gap-2 text-[13px] text-ink-body">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-brand bg-brand text-white"><Check size={11} /></span>
            Skip sending when there was no activity in the period
          </div>
        </fieldset>
        {canEdit && (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-4 py-3">
            <div className="flex gap-2">
              {!isNew && (
                <>
                  <Button size="sm" variant="ghost" onClick={onDelete}>Delete report</Button>
                  <Button size="sm" variant="ghost" onClick={onPause}>{on ? 'Pause' : 'Resume'}</Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onTest}><Send size={14} />Send test to me</Button>
              <Button size="sm" onClick={onSave}>Save report</Button>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- PDF preview */}
      <div className="card flex flex-col">
        <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
          <div className="font-semibold text-ink-strong">Preview · page 1 of 4</div>
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><Download size={13} />Download sample</span>
        </div>
        <div className="bg-surface-sunken p-4">
          <div className="mx-auto flex max-w-[560px] flex-col gap-4 rounded-sm border border-line-subtle bg-white p-5 text-[#1F1A1C] shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b-2 border-[#8A1538] pb-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#8C8487]">KAP Console · {tn}</div>
                <div className="text-lg font-semibold">{E.n || 'Untitled report'}</div>
                <div className="text-[11px] text-[#5C5457]">10 – 16 Nov 2026 · generated 17 Nov 2026, 07:00 AST</div>
              </div>
              <span className="rounded-sm border border-dashed border-[#C8B49A] px-2 py-1 text-[10px] text-[#8C8487]">LOGO</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {REPORT_KPI.map(([k, v, d, c]) => (
                <div key={k} className="rounded-sm border border-[#E4DFDD] p-2">
                  <div className="text-[10px] text-[#8C8487]">{k}</div>
                  <div className="text-base font-semibold">{v}</div>
                  <div className="text-[10px]" style={{ color: c }}>{d}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold">Agent jobs by day</div>
              <div className="flex h-[60px] items-end gap-2">
                {REPORT_DAYS.map(([o, f, r, l]) => {
                  const tt = o + f + r;
                  return (
                    <div key={l} className="flex flex-1 flex-col-reverse" style={{ height: `${Math.round((tt / max) * 60)}px` }} title={`${l}: ${o} succeeded · ${f} failed · ${r} running`}>
                      <div style={{ height: `${(o / tt) * 100}%`, background: '#1E7B4F' }} />
                      <div style={{ height: `${(f / tt) * 100}%`, background: '#C0352B' }} />
                      <div style={{ height: `${(r / tt) * 100}%`, background: '#2B6CB0' }} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex gap-2">{REPORT_DAYS.map(([, , , l]) => <div key={l} className="flex-1 text-center text-[9px] text-[#8C8487]">{l}</div>)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-[11px] font-semibold">Top Ask AI questions</div>
                {REPORT_TOP_Q.map(([q, n]) => <div key={q} className="flex justify-between border-b border-[#F0ECEA] py-0.5 text-[11px]"><span>{q}</span><span className="text-[#5C5457]">{n}</span></div>)}
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold">Needs attention</div>
                {REPORT_ATTENTION.map(([tx, c]) => <div key={tx} className="flex items-center gap-1.5 py-0.5 text-[11px]"><span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: c }} />{tx}</div>)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold">User feedback</div>
              <div className="flex h-2 overflow-hidden rounded-full"><span style={{ width: '92%', background: '#1E7B4F' }} /><span style={{ width: '8%', background: '#C0352B' }} /></div>
              <div className="mt-1 flex justify-between text-[10px] text-[#5C5457]"><span>86 helpful</span><span>7 not helpful · 4 open</span></div>
            </div>
            <div className="flex justify-between border-t border-[#E4DFDD] pt-2 text-[9px] text-[#8C8487]"><span>Confidential · {tn} internal use</span><span>Page 1 of 4</span></div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-ink-muted"><Mail size={13} />Sections and figures follow the report settings; the sample uses last week’s data.</div>
      </div>
    </div>
  );
}

import { Download } from 'lucide-react';
import { AGENTS, TOOLS } from '@/mocks/core';
import { REP_ATTENTION, REP_DAYS, REP_KPI, REP_TOP_Q, type RepFreq, type RepRange } from '@/mocks/governance';
import { readOnly } from '@/features/users/identity-ui';
import { UNIT, type ReportForm } from './form';

const PERIOD: Record<RepFreq, Record<RepRange, string>> = {
  daily: { last: '16 Nov 2026', mtd: '1 – 16 Nov 2026', '30': '18 Oct – 16 Nov 2026' },
  weekly: { last: '10 – 16 Nov 2026', mtd: '1 – 16 Nov 2026', '30': '18 Oct – 16 Nov 2026' },
  monthly: { last: 'October 2026', mtd: '1 – 16 Nov 2026', '30': '18 Oct – 16 Nov 2026' },
};

const pagesFor = (n: number) => Math.max(1, Math.ceil(n * 0.8));

/** Live PDF page-1 preview: every block follows the edit form. Colours are print colours from the design. */
export function ReportPreview({ form }: { form: ReportForm }) {
  const on = (k: ReportForm['sections'][number]) => form.sections.includes(k);
  const n = form.sections.length;
  const pages = pagesFor(n);
  const compare = form.range === 'last' ? `vs prior ${UNIT[form.freq]}` : 'vs prior period';
  const headerLabel = form.fmt === 'xlsx' ? `Preview · summary sheet of ${n + 1}` : `Preview · page 1 of ${pages}`;

  const oxford = TOOLS.filter((t) => t.source === 'oxford');
  const models = Object.entries(AGENTS.reduce<Record<string, number>>((m, a) => ({ ...m, [a.model]: (m[a.model] ?? 0) + a.calls24h }), {}));

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="font-semibold text-ink-strong">{headerLabel}</div>
        <button type="button" onClick={readOnly} className="flex items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-brand">
          <Download size={15} />
          Download sample
        </button>
      </div>
      <div className="bg-surface-sunken p-5">
        <div
          className="mx-auto flex max-w-[520px] flex-col gap-4 overflow-hidden border border-line-subtle bg-white px-[30px] py-7 text-[10px] text-[#1F1A1C]"
          style={{ aspectRatio: '1 / 1.414', boxShadow: '0 4px 12px rgba(31,26,28,.08)' }}
        >
          <div className="flex items-start justify-between pb-2.5" style={{ borderBottom: '2px solid #8A1538' }}>
            <div className="min-w-0">
              <div className="text-[8px] font-semibold uppercase tracking-[.08em] text-[#766E71]">KAP Console · SCEAI</div>
              <div className="mt-0.5 truncate text-base font-semibold">{form.name || 'Untitled report'}</div>
              <div className="mt-0.5 text-[#5C5457]">
                {PERIOD[form.freq][form.range]} · generated 17 Nov 2026, {form.time} AST
              </div>
            </div>
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-card border border-dashed border-[#A8A0A3] text-[6px] text-[#766E71]">LOGO</span>
          </div>

          {n === 0 && <div className="grid flex-1 place-items-center text-center text-[11px] text-[#766E71]">Select at least one section to build the report.</div>}

          {on('overview') && (
            <div className="grid grid-cols-4 gap-1.5">
              {REP_KPI.map((k, i) => (
                <div key={k.k} className="rounded-card border border-[#E4DFDD] px-2 py-1.5">
                  <div className="text-[8px] text-[#5C5457]">{k.k}</div>
                  <div className="text-sm font-semibold">{k.v}</div>
                  <div className="text-[7.5px]" style={{ color: k.c }}>
                    {i === 0 ? `${k.d} ${compare}` : k.d}
                  </div>
                </div>
              ))}
            </div>
          )}

          {on('jobs') && (
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold">Agent jobs by day</div>
              <div className="flex h-16 items-end gap-2 border-b border-[#E4DFDD]">
                {REP_DAYS.map((d) => {
                  const t = d.ok + d.fail + d.run;
                  return (
                    <div key={d.label} className="flex flex-1 flex-col-reverse" style={{ height: Math.round((t / 14) * 60) }}>
                      <div style={{ height: `${(d.ok / t) * 100}%`, background: '#1E7B4F' }} />
                      <div style={{ height: `${(d.fail / t) * 100}%`, background: '#C0352B' }} />
                      <div style={{ height: `${(d.run / t) * 100}%`, background: '#2B6CB0' }} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-[3px] flex gap-2">
                {REP_DAYS.map((d) => (
                  <div key={d.label} className="flex-1 text-center text-[7.5px] text-[#766E71]">
                    {d.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(on('ask') || on('attention')) && (
            <div className="grid gap-3.5" style={{ gridTemplateColumns: on('ask') && on('attention') ? '1fr 1fr' : '1fr' }}>
              {on('ask') && (
                <div className="min-w-0">
                  <div className="mb-1 text-[10.5px] font-semibold">Top Ask AI questions</div>
                  {REP_TOP_Q.map((q) => (
                    <div key={q.q} className="flex justify-between gap-1.5 border-b border-[#F0ECEA] py-[3px]">
                      <span className="truncate">{q.q}</span>
                      <span className="font-mono">{q.n}</span>
                    </div>
                  ))}
                </div>
              )}
              {on('attention') && (
                <div className="min-w-0">
                  <div className="mb-1 text-[10.5px] font-semibold">Needs attention</div>
                  {REP_ATTENTION.map((a) => (
                    <div key={a.t} className="flex gap-[5px] border-b border-[#F0ECEA] py-[3px]">
                      <span className="mt-1 h-[5px] w-[5px] flex-none rounded-full" style={{ background: a.c }} />
                      <span>{a.t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {on('feedback') && (
            <div>
              <div className="mb-1 text-[10.5px] font-semibold">User feedback</div>
              <div className="flex h-2 overflow-hidden rounded-[2px]">
                <span style={{ width: '92%', background: '#1E7B4F' }} />
                <span style={{ width: '8%', background: '#C0352B' }} />
              </div>
              <div className="mt-[3px] flex justify-between text-[8px] text-[#5C5457]">
                <span>86 helpful</span>
                <span>7 not helpful · 4 open</span>
              </div>
            </div>
          )}

          {(on('oxford') || on('access') || on('cost')) && (
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              {on('oxford') && (
                <MiniList
                  title="Oxford Economics usage"
                  rows={[...oxford.map((t) => [t.name, `${t.calls7d} calls · ${t.errorRate} errors`] as [string, string]), ['Leak guard', '0 blocked']]}
                />
              )}
              {on('access') && (
                <MiniList
                  title="Access changes"
                  rows={[
                    ['sceai_analyst', '→ catalog_readers'],
                    ['Token dashboards-svc', 'created'],
                    ['Grants', 'no changes'],
                  ]}
                />
              )}
              {on('cost') && <MiniList title="Model usage · calls 24 h" rows={models.map(([m, c]) => [m, String(c)] as [string, string])} />}
            </div>
          )}

          <div className="mt-auto flex justify-between border-t border-[#E4DFDD] pt-1.5 text-[7.5px] text-[#766E71]">
            <span>Confidential · SCEAI internal use</span>
            <span>Page 1 of {pages}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniList({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10.5px] font-semibold">{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-1.5 border-b border-[#F0ECEA] py-[3px]">
          <span className="truncate">{k}</span>
          <span className="whitespace-nowrap font-mono">{v}</span>
        </div>
      ))}
    </div>
  );
}

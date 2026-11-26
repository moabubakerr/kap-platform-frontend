/**
 * A Postgres export run (route /runs/pg-<id8>): header, progress, the steps
 * read → write → upload → kap_scan → kap_load, counts and files, and the KAP
 * run it started. Read every 2 s while queued, running or waiting for KAP.
 */
import * as React from 'react';
import { ChevronRight, XCircle } from 'lucide-react';
import { act } from '@/engine/build';
import { ScreenView } from '@/engine/ScreenView';
import type { ScreenModel } from '@/engine/types';
import type { ExportRun, PgDataset } from '@/api/platformPg';
import { useLiveLoad } from '@/v35/live';
import { stP } from './logic';
import { rel, runId as kapRunId, span } from './fromKap';
import { hhmmss } from './runView';
import { Field, LinkBtn, ProgressBar, StatusBadge, Stepper } from './LiveRunView';
import { loadPgExport, PG_RUN_MS } from './pgLive';
import { EXPORT_STATUS_LABEL, exportOf, exportProgress, exportStatus, exportSteps, fmtBytes, fmtCount, isActiveExport, kapPercent, kapResultText, runFileRows, runLabel, triggerLabel } from './pgView';
import { AgentCtaCard, PgBanner } from './PgSourceView';
import { agentCta, isRecordsRun, KAP_LOAD_NOTE, recordCountRows } from './pgRecords';
import { datasetTab } from './pgActions';
import type { useIngest } from './useIngest';

type Ctx = ReturnType<typeof useIngest>;

function Overview({ c, x, ds, now }: { c: Ctx; x: ExportRun; ds: PgDataset | undefined; now: number }) {
  const st = exportStatus(x.status);
  const active = isActiveExport(x);
  const records = isRecordsRun(x, ds);
  const steps = exportSteps(x, now, records);
  const pr = exportProgress(x, now, records);
  const kapLoading = active && steps.some((s) => (s.key === 'kap_load' || s.key === 'kap_scan') && s.state === 'current');
  const cta = records && x.status === 'succeeded' ? agentCta(ds, [x]) : null;
  const files = runFileRows(x);
  const t0 = x.started_at ? Date.parse(x.started_at) : NaN;
  const dur = Number.isNaN(t0) ? (active ? 'not started' : '—') : `${span((x.finished_at ? Date.parse(x.finished_at) : now) - t0)}${active ? ' so far' : ''}`;
  const srcName = ds ? c.pg.state?.sources.find((s) => s.id === ds.source_id)?.name ?? ds.source_name : '';
  const coll = ds?.collection_name ?? x.kap?.collection ?? '';
  const job = x.kap?.pipeline_job_id ?? null;
  const kp = kapPercent(x.kap?.progress);
  const kr = kapResultText(x.kap?.result);
  return (
    <div className="flex flex-col gap-4">
      <div className="card px-4 py-3.5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <StatusBadge st={st} />
          {x.status === 'waiting_for_kap' && <span className="text-[13px] font-semibold text-info">Waiting for KAP</span>}
          <span className="text-[13px] text-ink-muted">{triggerLabel(x.trigger)}</span>
          {active && <span className="ml-auto text-[12px] text-ink-muted">Updates every 2 seconds</span>}
        </div>
        <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          <Field k="Dataset">{ds && srcName ? <LinkBtn onClick={() => c.go.source(srcName, datasetTab(ds.id))}>{x.dataset_name}</LinkBtn> : x.dataset_name}</Field>
          <Field k="Data source">{srcName ? <LinkBtn onClick={() => c.go.source(srcName)}>{srcName}</LinkBtn> : '—'}</Field>
          <Field k="Target collection">{coll ? ds?.kap?.collection_id || x.kap?.collection ? <LinkBtn onClick={() => c.go.collection(coll)}>{coll}</LinkBtn> : coll : '—'}</Field>
          <Field k="Started">
            {hhmmss(x.started_at ?? x.created_at)}
            <div className="text-[12px] text-ink-muted">{rel(x.created_at, now)}</div>
          </Field>
          <Field k="Duration">{dur}</Field>
        </div>
      </div>

      <div className="card px-4 py-3.5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13.5px] font-semibold text-ink-strong">Export</span>
          <span className="text-[13px] text-ink-body">
            {pr.label}
            <span className="ml-2 font-mono text-ink-muted">{pr.percent}%</span>
          </span>
        </div>
        <ProgressBar percent={pr.percent} indeterminate={pr.indeterminate} tone={active ? 'info' : x.status === 'failed' ? 'bad' : 'ok'} />
      </div>

      {x.error && (
        <div className="flex items-start gap-3 rounded-card border border-line-subtle bg-danger-bg px-4 py-3 text-[13px] text-danger-fg">
          <XCircle size={18} className="mt-0.5 flex-none" />
          <div>
            <div className="font-semibold">The export failed</div>
            <div className="[overflow-wrap:anywhere]">{x.error}</div>
          </div>
        </div>
      )}

      <div className="card px-4 py-4">
        <div className="mb-3 text-[15px] font-semibold text-ink-strong">Steps</div>
        <Stepper steps={steps} />
        <div className="mt-3 text-[12px] text-ink-muted">The platform reports the first three steps; KAP’s scan and load are read from KAP’s run.</div>
      </div>

      {records && kapLoading && (
        <div className="rounded-card border border-line-subtle bg-info-bg px-4 py-3 text-[13px] text-info">{KAP_LOAD_NOTE} With many new or changed records this takes a while.</div>
      )}

      {cta && <AgentCtaCard c={c} cta={cta} />}

      {records ? (
        <div className="card px-4 py-3.5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[15px] font-semibold text-ink-strong">Documents</span>
            {x.files.length > 0 && (
              <span className="text-[12px] text-ink-muted">
                {fmtCount(x.files.length)} {x.files.length === 1 ? 'file' : 'files'} uploaded · {fmtBytes(x.files.reduce((a, f) => a + (f.bytes ?? 0), 0))}
              </span>
            )}
          </div>
          <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
            {recordCountRows(x.counts).map((r) => (
              <div key={r.key} title={r.hint}>
                <div className="text-[12px] text-ink-muted">{r.label}</div>
                <div className="text-[20px] font-semibold text-ink-strong">{fmtCount(r.value)}</div>
                <div className="text-[11.5px] text-ink-subtle">{r.hint}</div>
              </div>
            ))}
          </div>
          {!x.counts && <div className="mt-2 text-[12.5px] text-ink-muted">{active ? 'Counted once the platform has read the table.' : 'No counts were reported.'}</div>}
        </div>
      ) : (
      <div className="card overflow-auto">
        <div className="px-4 pb-2 pt-3.5 text-[15px] font-semibold text-ink-strong">Files</div>
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
              {['File', 'Rows', 'Size', 'Location in the bucket'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-[9px] font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.name} className="border-t border-line-subtle">
                <td className="px-3 py-2.5 font-mono font-semibold text-ink-strong">{f.name}</td>
                <td className="px-3 py-2.5 text-ink-body">{fmtCount(f.rows)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{fmtBytes(f.bytes)}</td>
                <td className="max-w-[360px] truncate px-3 py-2.5 font-mono text-[12px] text-ink-muted" title={f.key}>
                  {f.key || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!files.length && <div className="p-6 text-center text-ink-muted">{active ? 'No files written yet.' : 'No files were written.'}</div>}
      </div>
      )}

      <div className="card px-4 py-3.5">
        <div className="mb-2 text-[15px] font-semibold text-ink-strong">KAP</div>
        {x.kap ? (
          <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
            <Field k="KAP run">
              {job ? (
                <LinkBtn onClick={() => c.go.run(kapRunId(job))}>
                  Open KAP run {kapRunId(job)}
                  <ChevronRight size={14} />
                </LinkBtn>
              ) : (
                <span className="text-ink-muted">Not started yet: KAP starts it when its connector scans the bucket</span>
              )}
            </Field>
            <Field k="State">{x.kap.state ?? '—'}{kp != null ? ` · ${kp}%` : ''}</Field>
            <Field k="Result">{kr || '—'}</Field>
          </div>
        ) : (
          <div className="text-[13px] text-ink-muted">{active ? 'KAP is involved once the files are uploaded.' : 'KAP was not reached in this run.'}</div>
        )}
      </div>
    </div>
  );
}

export function pgRunModel(c: Ctx, id: string, x: ExportRun | null, ds: PgDataset | undefined, now: number): ScreenModel {
  if (!x) {
    const P = c.pg.state;
    return {
      head: { title: id, acts: [act('Back to runs', c.go.runs)] },
      sections: [{ callout: !P ? 'Loading the export run from the platform API…' : P.missing ? 'The platform API does not have PostgreSQL exports yet.' : `No Postgres export ${id} among the newest ${P.exports.length} export runs. It may be older, or the ID is wrong.` }],
    };
  }
  const st = exportStatus(x.status);
  const done = !isActiveExport(x);
  return {
    head: {
      title: id,
      status: [stP(st), x.status === 'waiting_for_kap' ? EXPORT_STATUS_LABEL.waiting_for_kap : st],
      sub: runLabel(x.dataset_name),
      acts: [...(c.canRun && done && ds ? [act('Run again', () => c.pg.a.runDataset(ds.id))] : []), act('Back to runs', c.go.runs)],
    },
    sections: [{ custom: <Overview c={c} x={x} ds={ds} now={now} /> }],
  };
}

/** The run page of a Postgres export run. */
export function PgRunPage({ c, runId }: { c: Ctx; runId: string }) {
  const x = exportOf(c.pg.state, runId);
  const t = c.tenant;
  const active = !!x && isActiveExport(x);
  const [failed, setFailed] = React.useState(false);
  const runLive = useLiveLoad(
    `pg-run:${x?.id ?? ''}`,
    x ? t : null,
    async (tenantId) => {
      if (t && x) await loadPgExport(tenantId, t, x.id);
    },
    !x ? 0 : failed ? 10_000 : active ? PG_RUN_MS : 0,
  );
  React.useEffect(() => setFailed(!!runLive.error), [runLive.error]);
  const ds = x ? c.pg.state?.datasets.find((d) => d.id === x.dataset_id) : undefined;
  return (
    <>
      <PgBanner pg={c.pg} />
      {runLive.error && <div className="mx-8 mb-2 rounded-sm bg-danger-bg px-3 py-2 text-[13px] text-danger-fg">Could not read this export run from the platform API: {runLive.error}</div>}
      <ScreenView model={pgRunModel(c, runId, x, ds, Date.now())} />
    </>
  );
}

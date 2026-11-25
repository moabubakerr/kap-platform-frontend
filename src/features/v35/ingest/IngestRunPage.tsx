import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { LiveBanner, useLiveLoad } from '@/v35/live';
import { LIVE_RUN_TABS, RUN_TABS, runScreen, type LiveRunContent } from './build';
import { isConsoleRun } from './consoleRuns';
import { kapOfRun } from './fromKap';
import { liveIngestStore, liveRunStore, loadRun, RUN_NEXT_SCAN_MS, runRefreshMs } from './liveIngest';
import { LiveRunItems, LiveRunOverview, type LiveRunData } from './LiveRunView';
import { isPgRunId } from './pgView';
import { PgRunPage } from './PgRunView';
import { useIngest } from './useIngest';

/**
 * Ingestion run detail (route /runs/:runId/:tab?).
 * Design tenants: Overview · Processing Stages · Processed Items · Errors & Logs · Output & Lineage.
 * Live tenant (KAP job): a live step view (Overview), the run's files (Processed Items) and the logs;
 * the run is read every 2 s while it is waiting or running, and every 10 s after a run that found
 * nothing (to show the data source's next scan).
 * Live tenant, Postgres export run (`pg-<id8>`, platform API): `PgRunView.tsx`.
 */
export default function IngestRunPage() {
  const { runId = '' } = useParams();
  return isPgRunId(runId) ? <PgRun runId={runId} /> : <KapRunPage />;
}

function PgRun({ runId }: { runId: string }) {
  const c = useIngest();
  useCrumbs([runId]);
  return <PgRunPage c={c} runId={runId} />;
}

function KapRunPage() {
  const { runId = '', tab } = useParams();
  const c = useIngest();
  const [sel, setSel] = React.useState<string | null>(null);
  React.useEffect(() => setSel(null), [runId]);

  const raw = liveIngestStore.use();
  const runs = liveRunStore.use();
  const K = c.tenant ? raw[c.tenant] : undefined;
  const r = c.H.runs.find((x) => x.id === runId);
  const ref = kapOfRun(r);
  const jobId = ref?.job ?? null;
  const rl = jobId ? runs[jobId] : undefined;
  const t = c.tenant;
  // a run KAP could not read: retry slowly instead of every 2 s
  const [failed, setFailed] = React.useState(false);
  const runLive = useLiveLoad(
    `ingest-run:${jobId ?? ''}`,
    jobId ? t : null,
    async (tenantId) => {
      if (t && jobId) await loadRun(tenantId, t, jobId);
    },
    !jobId ? 0 : failed ? RUN_NEXT_SCAN_MS : runRefreshMs(rl),
  );
  React.useEffect(() => setFailed(!!runLive.error), [runLive.error]);

  let live: LiveRunContent | undefined;
  if (r && ref && K) {
    const job = rl?.job ?? K.jobs.find((j) => j.id === ref.job);
    if (job) {
      const D: LiveRunData = {
        run: r,
        job,
        pipe: K.pipes.find((p) => p.id === job.pipeline_id),
        collection: K.colls.find((x) => x.id === job.collection_id),
        conns: K.conns,
        files: rl ? rl.files : undefined,
        later: rl ? rl.later : undefined,
        ours: isConsoleRun,
        now: Date.now(),
        go: c.go,
      };
      live = { overview: <LiveRunOverview D={D} />, items: <LiveRunItems D={D} /> };
    }
  }

  const model = runScreen(c, runId, tab, (v) => c.go.run(runId, v), sel, setSel, live);
  const tabs = live ? LIVE_RUN_TABS : RUN_TABS;
  useCrumbs([runId, model.head.tabs ? tabs.find((x) => x.value === model.head.tab)?.label : undefined]);
  return (
    <>
      <LiveBanner live={c.liveState} what="ingestion runs (KAP pipeline jobs)" />
      {runLive.error && <div className="mx-8 mb-2 rounded-sm bg-danger-bg px-3 py-2 text-[13px] text-danger-fg">Could not read this run from KAP: {runLive.error}</div>}
      <ScreenView model={model} />
    </>
  );
}

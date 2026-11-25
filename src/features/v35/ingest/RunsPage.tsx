import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { LiveBanner } from '@/v35/live';
import { canCancel, runsScreen, srcOfRun, type ListFilters } from './build';
import { kapOfRun } from './fromKap';
import { liveIngestStore } from './liveIngest';
import { liveRunsSection } from './LiveRunView';
import { isConsoleRun } from './consoleRuns';
import { isEmptyScan } from './runView';
import { useIngest } from './useIngest';

/** Data Ingestion Hub · Ingestion Runs (route /runs). Live tenant: status icons and progress per run. */
export default function RunsPage() {
  const c = useIngest();
  const [f, setF] = React.useState<ListFilters>({});
  /** KAP registers a run for every scan; scans that found nothing are hidden unless asked for */
  const [showEmpty, setShowEmpty] = React.useState(false);
  const raw = liveIngestStore.use();
  const K = c.tenant ? raw[c.tenant] : undefined;
  useCrumbs([]);
  const live = c.live && K;
  const emptyIds = new Set(live ? K!.jobs.filter((j) => isEmptyScan(j, isConsoleRun(j.id))).map((j) => j.id.slice(0, 8)) : []);
  const model = runsScreen(
    c,
    f,
    setF,
    live
      ? (runs) => {
          const shown = c.H.runs.filter((r) => !!kapOfRun(r)).length;
          const reported = Object.values(K!.jobTotals ?? {}).reduce((a, b) => a + b, 0);
          const errs = Object.entries(K!.jobErrors ?? {});
          const notes = [
            reported > shown ? `KAP reports ${reported.toLocaleString('en-US')} runs; the newest ${shown.toLocaleString('en-US')} are shown.` : '',
            ...errs.map(([p, e]) => `Could not read the runs of ${p} from KAP (${e}); the runs shown for it may be out of date.`),
          ].filter(Boolean);
          return {
            ...liveRunsSection({
              runs: showEmpty ? runs : runs.filter((r) => !emptyIds.has(r.id)),
              srcOf: (r) => srcOfRun(c.H, r),
              go: c.go,
              canCancel: (r) => canCancel(c, r),
              cancel: (r) => c.a.cancelRun?.(r),
              empty: c.H.runs.length ? 'No runs match the filters.' : 'No ingestion runs yet.',
            }),
            note: [
              'Newest first. A data source scan that finds new or changed files starts its own run; "Run now" processes files the data source has already found.',
              !showEmpty && emptyIds.size ? `${emptyIds.size.toLocaleString('en-US')} data source scans that found nothing new are hidden.` : '',
              ...notes,
            ].join(' '),
          };
        }
      : undefined,
  );
  return (
    <>
      <LiveBanner live={c.liveState} what="ingestion runs (KAP pipeline jobs)" />
      {live && (
        <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 text-[13px] text-ink-body">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
          Show data source scans that found nothing new{emptyIds.size ? ` (${emptyIds.size.toLocaleString('en-US')})` : ''}
        </label>
      )}
      <ScreenView model={model} />
    </>
  );
}

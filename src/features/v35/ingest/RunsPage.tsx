import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { LiveBanner } from '@/v35/live';
import { canCancel, runsScreen, srcOfRun, type ListFilters } from './build';
import { kapOfRun } from './fromKap';
import { liveIngestStore } from './liveIngest';
import { liveRunsSection } from './LiveRunView';
import { useIngest } from './useIngest';

/** Data Ingestion Hub · Ingestion Runs (route /runs). Live tenant: status icons and progress per run. */
export default function RunsPage() {
  const c = useIngest();
  const [f, setF] = React.useState<ListFilters>({});
  const raw = liveIngestStore.use();
  const K = c.tenant ? raw[c.tenant] : undefined;
  useCrumbs([]);
  const live = c.live && K;
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
              runs,
              srcOf: (r) => srcOfRun(c.H, r),
              go: c.go,
              canCancel: (r) => canCancel(c, r),
              cancel: (r) => c.a.cancelRun?.(r),
              empty: c.H.runs.length ? 'No runs match the filters.' : 'No ingestion runs yet.',
            }),
            note: [
              'Newest first. A data source scan that finds new or changed files starts its own run; "Run now" processes files the data source has already found.',
              ...notes,
            ].join(' '),
          };
        }
      : undefined,
  );
  return (
    <>
      <LiveBanner live={c.liveState} what="ingestion runs (KAP pipeline jobs)" />
      <ScreenView model={model} />
    </>
  );
}

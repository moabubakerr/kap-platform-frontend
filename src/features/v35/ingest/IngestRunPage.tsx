import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { LiveBanner } from '@/v35/live';
import { RUN_TABS, runScreen } from './build';
import { useIngest } from './useIngest';

/** Ingestion run detail (route /runs/:runId/:tab?): Overview · Processing Stages · Processed Items · Errors & Logs · Output & Lineage. */
export default function IngestRunPage() {
  const { runId = '', tab } = useParams();
  const c = useIngest();
  const [sel, setSel] = React.useState<string | null>(null);
  React.useEffect(() => setSel(null), [runId]);
  // live tenant: read the job's result and error from KAP when the list did not include them
  const { fetchRun } = c;
  const loaded = !!c.H.runs.find((r) => r.id === runId);
  React.useEffect(() => {
    if (loaded) fetchRun(runId);
  }, [runId, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const model = runScreen(c, runId, tab, (v) => c.go.run(runId, v), sel, setSel);
  useCrumbs([runId, model.head.tabs ? RUN_TABS.find((x) => x.value === model.head.tab)?.label : undefined]);
  return (
    <>
      <LiveBanner live={c.liveState} what="ingestion runs (KAP pipeline jobs)" />
      <ScreenView model={model} />
    </>
  );
}

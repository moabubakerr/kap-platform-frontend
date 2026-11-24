import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { RUN_TABS, runScreen } from './build';
import { useIngest } from './useIngest';

/** Ingestion run detail (route /runs/:runId/:tab?): Overview · Processing Stages · Processed Items · Errors & Logs · Output & Lineage. */
export default function IngestRunPage() {
  const { runId = '', tab } = useParams();
  const c = useIngest();
  const [sel, setSel] = React.useState<string | null>(null);
  React.useEffect(() => setSel(null), [runId]);
  const model = runScreen(c, runId, tab, (v) => c.go.run(runId, v), sel, setSel);
  useCrumbs([runId, model.head.tabs ? RUN_TABS.find((x) => x.value === model.head.tab)?.label : undefined]);
  return <ScreenView model={model} />;
}

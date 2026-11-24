import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { LiveBanner } from '@/v35/live';
import { sourcesScreen, type ListFilters } from './build';
import { useIngest } from './useIngest';

/** Data Ingestion Hub · Data Sources (route /sources). */
export default function SourcesPage() {
  const c = useIngest();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs([]);
  return (
    <>
      <LiveBanner live={c.liveState} what="data sources (KAP connectors)" />
      <ScreenView model={sourcesScreen(c, f, setF)} />
    </>
  );
}

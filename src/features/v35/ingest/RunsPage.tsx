import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { LiveBanner } from '@/v35/live';
import { runsScreen, type ListFilters } from './build';
import { useIngest } from './useIngest';

/** Data Ingestion Hub · Ingestion Runs (route /runs). */
export default function RunsPage() {
  const c = useIngest();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs([]);
  return (
    <>
      <LiveBanner live={c.liveState} what="ingestion runs (KAP pipeline jobs)" />
      <ScreenView model={runsScreen(c, f, setF)} />
    </>
  );
}

import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { LiveBanner } from '@/v35/live';
import { pipesScreen, type ListFilters } from './build';
import { useIngest } from './useIngest';

/** Data Ingestion Hub · Ingestion Pipelines (route /pipelines). */
export default function PipelinesPage() {
  const c = useIngest();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs([]);
  return (
    <>
      <LiveBanner live={c.liveState} what="pipelines" />
      <ScreenView model={pipesScreen(c, f, setF)} />
    </>
  );
}

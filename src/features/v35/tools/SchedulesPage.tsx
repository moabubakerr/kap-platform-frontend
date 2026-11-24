import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { emptyTenant, modHead, SCHEDULE_TABS, schedulesScreen, type ListFilters } from './build';
import { useSchedCtx } from './useTools';

/** Schedules & Events · Triggers (route /schedules): time-based and event-driven triggers of agents and workflows. */
export default function SchedulesPage() {
  const c = useSchedCtx();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs(['Triggers']);
  if (!c.ok) {
    const head = modHead('Schedules & Events', SCHEDULE_TABS, 'schedules', (v) => c.nav(v === 'reports' ? `${c.base}/schedules/reports` : `${c.base}/schedules`));
    return <ScreenView model={emptyTenant(head, 'schedules and event bindings', c.tn, c.key === 'default')} />;
  }
  return <ScreenView model={schedulesScreen(c, f, setF)} />;
}

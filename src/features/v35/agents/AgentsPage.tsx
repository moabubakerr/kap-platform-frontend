import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { agentsScreen, type ListFilters } from './build';
import { AgentsLiveBanner } from './LiveStrip';
import { useAgents } from './useAgents';

/** AI Agent Factory · Agents (route /agents). Create agent opens the creation wizard. On the live tenant the agents come from KAP. */
export default function AgentsPage() {
  const c = useAgents();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs([]);
  return (
    <>
      <AgentsLiveBanner live={c.liveState} />
      <ScreenView model={agentsScreen(c, f, setF)} />
    </>
  );
}

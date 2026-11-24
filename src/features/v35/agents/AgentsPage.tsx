import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { agentsScreen, type ListFilters } from './build';
import { useAgents } from './useAgents';

/** AI Agent Factory · Agents (route /agents). Create agent opens the creation wizard. */
export default function AgentsPage() {
  const c = useAgents();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs([]);
  return <ScreenView model={agentsScreen(c, f, setF)} />;
}

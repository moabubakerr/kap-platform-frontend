import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
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
  // ?create=1&collection=<name>: opened from a records dataset ("Create an agent that searches …")
  const [params, setParams] = useSearchParams();
  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current || params.get('create') !== '1') return;
    started.current = true;
    const coll = params.get('collection');
    setParams({}, { replace: true });
    c.a.create(coll ? { colls: [coll] } : undefined);
  }, [params, setParams, c.a]);
  return (
    <>
      <AgentsLiveBanner live={c.liveState} />
      <ScreenView model={agentsScreen(c, f, setF)} />
    </>
  );
}

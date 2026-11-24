import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { AGENT_TABS, agentScreen } from './build';
import { useAgents } from './useAgents';

/** Agent detail (route /agents/:agentId/:tab?): Overview · Configuration · Knowledge & Tools · Testing · Evaluation · Versions · Metrics. */
export default function AgentPage() {
  const { agentId = '', tab } = useParams();
  const c = useAgents();
  const model = agentScreen(c, agentId, tab, (v) => c.go.agent(agentId, v));
  useCrumbs([agentId, model.head.tabs ? AGENT_TABS.find((x) => x.value === model.head.tab)?.label : undefined]);
  return <ScreenView model={model} />;
}

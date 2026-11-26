import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { agentEvalSections } from '@/features/v35/evals/evalBuild';
import { useEvals } from '@/features/v35/evals/useEvals';
import { AGENT_TABS, agentScreen } from './build';
import { kapOf } from './fromKap';
import { AgentsLiveBanner } from './LiveStrip';
import { useAgents } from './useAgents';

/** Agent detail (route /agents/:agentId/:tab?): Overview · Configuration · Knowledge & Tools · Testing · Evaluation · Versions · Metrics.
 * Live tenant: the Evaluation tab shows the platform's evaluation runs of this KAP agent. */
export default function AgentPage() {
  const { agentId = '', tab } = useParams();
  const c = useAgents();
  const e = useEvals(c);
  let model = agentScreen(c, agentId, tab, (v) => c.go.agent(agentId, v));
  const kap = kapOf(c.D.agents.find((a) => a.id === agentId));
  if (c.liveState.on && kap && model.head.tab === 'eval') model = { ...model, sections: agentEvalSections(e, kap.agent.id) };
  useCrumbs([agentId, model.head.tabs ? AGENT_TABS.find((x) => x.value === model.head.tab)?.label : undefined]);
  return (
    <>
      <AgentsLiveBanner live={c.liveState} what="agent configuration and jobs" />
      <ScreenView model={model} />
    </>
  );
}

import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { EvalSetsLive } from '@/features/v35/evals/EvalPages';
import { evalSetsScreen } from './build';
import { useAgents } from './useAgents';

/** Evaluation Datasets (route /agents/evaluation). Live tenant: test sets and runs from the platform API. */
export default function EvalSetsPage() {
  const c = useAgents();
  if (c.liveState.on) return <EvalSetsLive c={c} />;
  return <SampleEvalSets c={c} />;
}

function SampleEvalSets({ c }: { c: ReturnType<typeof useAgents> }) {
  useCrumbs(['Evaluation Datasets']);
  return <ScreenView model={evalSetsScreen(c)} />;
}

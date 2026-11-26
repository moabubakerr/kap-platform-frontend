import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { EvalSetLive } from '@/features/v35/evals/EvalPages';
import { evalSetScreen } from './build';
import { useAgents } from './useAgents';

/** Evaluation dataset (route /agents/evaluation/:setId): description, usage and test cases. Live tenant: a platform test set. */
export default function EvalSetPage() {
  const { setId = '' } = useParams();
  const c = useAgents();
  if (c.liveState.on) return <EvalSetLive c={c} setId={setId} />;
  return <SampleEvalSet c={c} setId={setId} />;
}

function SampleEvalSet({ c, setId }: { c: ReturnType<typeof useAgents>; setId: string }) {
  useCrumbs(['Evaluation Datasets', setId]);
  return <ScreenView model={evalSetScreen(c, setId)} />;
}

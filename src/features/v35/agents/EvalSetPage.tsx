import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { evalSetScreen } from './build';
import { useAgents } from './useAgents';

/** Evaluation dataset (route /agents/evaluation/:setId): description, usage and test cases. */
export default function EvalSetPage() {
  const { setId = '' } = useParams();
  const c = useAgents();
  useCrumbs(['Evaluation Datasets', setId]);
  return <ScreenView model={evalSetScreen(c, setId)} />;
}

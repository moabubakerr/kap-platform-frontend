import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { evalSetsScreen } from './build';
import { useAgents } from './useAgents';

/** Evaluation Datasets (route /agents/evaluation). */
export default function EvalSetsPage() {
  const c = useAgents();
  useCrumbs(['Evaluation Datasets']);
  return <ScreenView model={evalSetsScreen(c)} />;
}

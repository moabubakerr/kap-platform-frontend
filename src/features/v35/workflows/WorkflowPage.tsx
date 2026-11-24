import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { WF_TABS, wfTabOf, workflowScreen } from './build';
import { Designer } from './Designer';
import { useWorkflows } from './useWorkflows';

/** Workflow details (route /workflows/:workflowId/:tab?): Overview · Designer · Evaluation · Versions · Metrics. */
export default function WorkflowPage() {
  const { workflowId = '', tab } = useParams();
  const c = useWorkflows();
  const model = workflowScreen(c, workflowId, tab, (v) => c.go.wf(workflowId, v), (w, vsel) => <Designer hub={c} w={w} vsel={vsel} />);
  const w = c.D.workflows.find((x) => x.id === workflowId);
  useCrumbs([w ? w.n : workflowId, WF_TABS.find((x) => x.value === wfTabOf(tab))?.label]);
  return <ScreenView model={model} />;
}

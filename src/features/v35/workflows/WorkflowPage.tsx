import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { useAgents } from '@/features/v35/agents/useAgents';
import { workflowEvalSections } from '@/features/v35/evals/evalBuild';
import { useEvals } from '@/features/v35/evals/useEvals';
import { WF_TABS, wfTabOf, workflowScreen } from './build';
import { Designer } from './Designer';
import { draftOf } from './logic';
import { useWorkflows } from './useWorkflows';
import { WfLiveBanner } from './WfLiveBanner';

/** Workflow details (route /workflows/:workflowId/:tab?): Overview · Designer · Evaluation · Versions · Metrics.
 * Live tenant: the Evaluation tab shows the platform's evaluations of this workflow and the draft's publish gate. */
export default function WorkflowPage() {
  const { workflowId = '', tab } = useParams();
  const c = useWorkflows();
  const e = useEvals(useAgents());
  let model = workflowScreen(c, workflowId, tab, (v) => c.go.wf(workflowId, v), (w, vsel) => <Designer hub={c} w={w} vsel={vsel} />);
  const w = c.D.workflows.find((x) => x.id === workflowId);
  if (c.liveRuns && w && model.head.tab === 'eval') {
    const dv = draftOf(w);
    model = { ...model, sections: workflowEvalSections(e, w.id, dv && dv.cfg ? { v: dv.v, cfg: dv.cfg } : null) };
  }
  useCrumbs([w ? w.n : workflowId, WF_TABS.find((x) => x.value === wfTabOf(tab))?.label]);
  return (
    <>
      <WfLiveBanner c={c} />
      <ScreenView model={model} />
    </>
  );
}

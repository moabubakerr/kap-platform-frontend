import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { EvalRunLive } from '@/features/v35/evals/EvalPages';
import { useAgents } from './useAgents';

/** Evaluation run (route /agents/evaluation/runs/:runId?vs=<baseline run>): live tenant only. */
export default function EvalRunPage() {
  const { runId = '' } = useParams();
  const [q] = useSearchParams();
  const c = useAgents();
  if (!c.liveState.on) return <Navigate to=".." relative="path" replace />;
  return <EvalRunLive c={c} runId={runId} vsId={q.get('vs')} />;
}

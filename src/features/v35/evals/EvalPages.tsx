/**
 * Evaluation pages on the live tenant (platform API): test sets, one test set,
 * one run. The sample tenants keep the design's session-only evaluation screens.
 */
import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { useLiveLoad } from '@/v35/live';
import { AgentsLiveBanner } from '@/features/v35/agents/LiveStrip';
import type { useAgents } from '@/features/v35/agents/useAgents';
import { runScreen, setScreen, setsScreen } from './evalBuild';
import { EVAL_ACTIVE_REFRESH_MS, evalStore, loadEvalRun, loadEvalSet } from './evalLive';
import { isActiveRun } from './evalView';
import { useEvals } from './useEvals';

type AgentsC = ReturnType<typeof useAgents>;

function Banner({ e }: { e: ReturnType<typeof useEvals> }) {
  if (!e.error || e.st?.missing) return null;
  return (
    <div className="max-w-[1440px] px-8 pt-3">
      <div className="rounded-sm bg-danger-bg px-3 py-2 text-[13px] text-danger-fg">Could not refresh evaluations from the platform API: {e.error}</div>
    </div>
  );
}

export function EvalSetsLive({ c }: { c: AgentsC }) {
  const e = useEvals(c);
  useCrumbs(['Evaluation']);
  return (
    <>
      <AgentsLiveBanner live={c.liveState} what="agents" />
      <Banner e={e} />
      <ScreenView model={setsScreen(e)} />
    </>
  );
}

export function EvalSetLive({ c, setId }: { c: AgentsC; setId: string }) {
  const one = useLiveLoad(`eval-set:${setId}`, c.tenant, (tid) => loadEvalSet(tid, setId));
  const e = useEvals(c, one.reload);
  const name = e.st?.set[setId]?.name ?? e.st?.sets.find((s) => s.id === setId)?.name;
  useCrumbs(['Evaluation', name ?? 'Test set']);
  return (
    <>
      <Banner e={e} />
      <ScreenView model={setScreen(e, setId)} />
    </>
  );
}

export function EvalRunLive({ c, runId, vsId }: { c: AgentsC; runId: string; vsId: string | null }) {
  const all = evalStore.use();
  const tidGuess = Object.values(all).find((s) => s.run[runId] || s.runs.some((r) => r.id === runId));
  const active = isActiveRun(tidGuess?.run[runId] ?? tidGuess?.runs.find((r) => r.id === runId));
  const one = useLiveLoad(`eval-run:${runId}`, c.tenant, (tid) => loadEvalRun(tid, runId), active ? EVAL_ACTIVE_REFRESH_MS : 0);
  const other = useLiveLoad(`eval-run:${vsId ?? '-'}`, vsId ? c.tenant : null, (tid) => loadEvalRun(tid, vsId!), 0);
  const reload = React.useCallback(async () => {
    await one.reload();
    if (vsId) await other.reload();
  }, [one, other, vsId]);
  const e = useEvals(c, reload);
  const r = e.st?.run[runId];
  useCrumbs(['Evaluation', r ? `${r.set_name} · ${r.agent_name ?? 'run'}` : 'Run']);
  return (
    <>
      <Banner e={e} />
      <ScreenView model={runScreen(e, runId, vsId)} />
    </>
  );
}

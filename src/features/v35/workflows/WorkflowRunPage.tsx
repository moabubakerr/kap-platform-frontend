import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { useDialogs } from '@/engine/dialogs';
import { ScreenView } from '@/engine/ScreenView';
import { cancelWfRun, reviewWfStep, type WfRunStep } from '@/api/platformWf';
import { useBase } from '@/app/shell/AppShell';
import { useNavigate } from 'react-router-dom';
import { useLiveLoad } from '@/v35/live';
import type { WfTenantKey } from './types';
import { useWorkflows } from './useWorkflows';
import { isActiveWfRun, loadWfRun, wfLiveStore } from './wfLive';
import { wfRunScreen } from './wfRunBuild';

/** One workflow run (route /workflows/:workflowId/runs/:runId): live tenant, platform API. */
export default function WorkflowRunPage() {
  const { workflowId = '', runId = '' } = useParams();
  const c = useWorkflows();
  const d = useDialogs();
  const base = useBase();
  const nav = useNavigate();
  const t = c.t as WfTenantKey;
  const all = wfLiveStore.use();
  const run = t ? all[t]?.run[runId] : undefined;
  const one = useLiveLoad(`wf-run:${runId}`, c.live ? t : null, (tid) => loadWfRun(tid, t, runId).then(() => undefined), isActiveWfRun(run) ? 2000 : 0);
  const w = c.D.workflows.find((x) => x.id === workflowId);
  useCrumbs([w?.n ?? workflowId, 'Run ' + runId.slice(0, 8)]);
  const tid = one.tenantId;
  const decide = (s: WfRunStep, approve: boolean) =>
    d.form(
      (approve ? 'Approve · ' : 'Reject · ') + s.label,
      approve
        ? [
            { type: 'textarea', k: 'answer', label: s.kind === 'fallback' ? 'Answer to return' : 'Answer (edit if needed)', val: s.input ?? '', rows: 8 },
            { type: 'text', k: 'comment', label: 'Comment (optional)', val: '' },
          ]
        : [
            { type: 'note', tone: 'warn', text: 'The step fails: the workflow follows its failure path, or stops if it has none.' },
            { type: 'text', k: 'comment', label: 'Reason', val: '' },
          ],
      approve ? 'Approve' : 'Reject',
      async (v) => {
        if (!tid) return 'This tenant is not live.';
        if (approve && !String(v.answer ?? '').trim()) return 'Write the answer to return.';
        try {
          await reviewWfStep(tid, runId, s.node_id, { approve, answer: approve ? String(v.answer) : undefined, comment: String(v.comment ?? '').trim() || undefined });
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
        await one.reload();
        return '';
      },
    );
  const model = wfRunScreen(
    {
      run,
      loading: one.loading,
      error: one.error,
      missing: !!(t && all[t]?.missing),
      now: Date.now(),
      canExec: c.canExec,
      go: {
        workflow: () => c.go.wf(workflowId),
        trace: (jobId) => nav(`${base}/monitoring/runs/${encodeURIComponent(jobId)}/trace`),
        replay: () => run && w && c.a.replay(w, runId, run.version),
      },
      a: {
        approve: (s) => decide(s, true),
        reject: (s) => decide(s, false),
        cancel: () =>
          d.confirm('Cancel run', 'Stop this run? Steps not finished are skipped; KAP jobs already running finish on their own.', [], 'Cancel run', async () => {
            if (!tid) return;
            try {
              await cancelWfRun(tid, runId);
            } catch (e) {
              return e instanceof Error ? e.message : String(e);
            }
            await one.reload();
          }),
      },
    },
    w ? `${w.n} · run` : 'Workflow run',
  );
  return <ScreenView model={model} />;
}

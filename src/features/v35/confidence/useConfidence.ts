/**
 * Wires the AI Confidence Hub builders to the agent factory store, router and
 * "view as" permissions. Trace links go to Monitoring & Insights, sessions to
 * the conversation page.
 */
import * as React from 'react';
import { useAfBase } from '@/features/v35/tools/useTools';
import type { ConfCtx } from './build';

export function useConfidence() {
  const b = useAfBase();
  const ctx = React.useMemo<ConfCtx | null>(() => {
    if (!b.c || !b.t) return null;
    const go: ConfCtx['go'] = {
      evidence: () => b.nav(`${b.base}/evidence`),
      feedback: () => b.nav(`${b.base}/feedback`),
      agent: (id, tab) => b.nav(`${b.base}/agents/${encodeURIComponent(id)}${tab ? `/${tab}` : ''}`),
      trace: (id) => b.nav(`${b.base}/monitoring/runs/${encodeURIComponent(id)}/trace`),
      session: (id) => b.nav(`${b.base}/conversations/${encodeURIComponent(id)}`),
    };
    return { t: b.t, tn: b.tn, D: b.c.D, actor: b.c.actor, can: b.c.can, go };
  }, [b.c, b.t, b.tn, b.nav, b.base]);
  return { ctx, tn: b.tn, isDefault: b.key === 'default' };
}

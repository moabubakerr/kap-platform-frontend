/**
 * Agents hub on the live tenant (sandbox): load KAP agents (+ recent jobs,
 * collections, chat models, agent schemas) into `agentFactoryStore`, and keep
 * the picker options and live test submissions in a small hub store.
 *
 * Only the agents part of the tenant's slice is replaced (plus that tenant's
 * tool grants, which mirror `allowed_tools`); workflows, evaluation datasets
 * and the rest keep the design's sample data.
 */
import { kapAll, kapGet, type KapPage } from '@/api/kap';
import { createStore } from '@/engine/store';
import { agentFactoryStore, isAfTenant } from '@/v35/data/agentFactory';
import { useLiveLoad } from '@/v35/live';
import { collectionSearch, emptyCache, GROUP_FILES, kindOf, type KapCollection as KapDataCollection, type KapFile, type KapPipeline as KapDataPipeline } from '../data/fromKap';
import { grantsOf, liveOpts, mergeAgents, toAgent, type KapAgent, type KapAgentSchema, type KapJob, type KapModelProvider, type LiveOpts, type LiveTest } from './fromKap';
import type { CollSearchInfo, EntityIdChoice } from './searchBlock';

export const agentsLiveStore = createStore<{ opts: LiveOpts; tests: Record<string, LiveTest>; choices: Record<string, EntityIdChoice> }>(() => ({ opts: { collections: [], models: [], schemas: [], tools: [], search: {} }, tests: {}, choices: {} }));

/** Search info per collection name (kind, searchable status, derived group ids), from KAP collections, pipelines and file paths. */
export function searchInfo(colls: KapDataCollection[], pipes: KapDataPipeline[] | null, paths: Record<string, { paths: string[]; total: number }>): Record<string, CollSearchInfo> {
  const cache = { ...emptyCache(), loaded: true, collections: colls, pipelines: pipes, groupPaths: paths };
  return Object.fromEntries(
    colls.map((c) => {
      const kind = kindOf(c, pipes);
      const { status, groups } = collectionSearch(cache, c);
      return [c.name, { id: c.id, kind, ok: status.ok, missing: status.missing, groups: groups.ids }];
    }),
  );
}

export const LIVE_KEY = 'af-agents';

/** Newest jobs and the 7-day count; null when KAP refuses the call. */
async function recentJobs(tenantId: string, agentId: string, now: number): Promise<{ jobs: KapJob[]; n7: number | null }> {
  const from = new Date(now - 7 * 86_400_000).toISOString();
  const to = new Date(now + 60_000).toISOString();
  try {
    const p = await kapGet<KapPage<KapJob>>(tenantId, `agents/${agentId}/jobs`, { limit: 100, created_at__between: [from, to] });
    return { jobs: p.items, n7: p.total };
  } catch {
    // filter not accepted: newest page only, counted client-side
    const p = await kapGet<KapPage<KapJob>>(tenantId, `agents/${agentId}/jobs`, { limit: 100 }).catch(() => null);
    return { jobs: p?.items ?? [], n7: null };
  }
}

export async function loadAgents(tenantId: string, tenantKey: string) {
  if (!isAfTenant(tenantKey)) return;
  const opt = <T,>(p: Promise<T[]>) => p.catch(() => null);
  const [agents, colls, models, schemas] = await Promise.all([
    kapAll<KapAgent>(tenantId, 'agents'),
    opt(kapAll<KapDataCollection>(tenantId, 'collections')),
    opt(kapAll<KapModelProvider>(tenantId, 'model-providers')),
    opt(kapAll<KapAgentSchema>(tenantId, 'agent-schemas')),
  ]);
  const pipes = await opt(kapAll<KapDataPipeline>(tenantId, 'pipelines'));
  // file paths of document collections, for their document group ids (search instructions)
  const paths: Record<string, { paths: string[]; total: number }> = {};
  await Promise.all(
    (colls || []).filter((c) => kindOf(c, pipes) === 'document').map(async (c) => {
      const fs = await opt(kapAll<KapFile>(tenantId, `collections/${c.id}/files`, { sort: 'name' }, GROUP_FILES));
      if (fs) paths[c.id] = { paths: fs.map((x) => x.source_path), total: fs.length };
    }),
  );
  const now = Date.now();
  const jobs = await Promise.all(agents.map((a) => recentJobs(tenantId, a.id, now)));
  const mapped = agents.map((a, i) => toAgent(a, jobs[i].jobs, jobs[i].n7, now));
  agentFactoryStore.update((af) => {
    const D = af.tenants[tenantKey];
    D.agents = mergeAgents(D.agents, mapped);
    af.mcp.grants[tenantKey] = grantsOf(agents);
  });
  agentsLiveStore.update((s) => {
    s.opts = liveOpts(agents, colls, models, schemas);
    s.opts.search = colls ? searchInfo(colls, pipes, paths) : {};
  });
}

/** Live state of the agents hub for a tenant (off for sample tenants). */
export const useAgentsLive = (tenantKey: string | null) => useLiveLoad(LIVE_KEY, tenantKey, (tid) => loadAgents(tid, tenantKey ?? ''));

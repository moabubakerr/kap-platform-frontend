/**
 * Agents hub screens for the live tenant (sandbox): KAP agents. Same layout as
 * the design's screens, but what KAP has is shown and edited directly (one
 * configuration per agent), and what it does not have is said plainly.
 * Pure: context in, sections out. `build.ts` calls these when `c.live` is set.
 */
import { act, cell, fr } from '@/engine/build';
import type { Action, Filters, Row, ScreenModel, Section } from '@/engine/types';
import { wfUsing, type Agent } from '@/v35/data/agentFactory';
import type { AgentsCtx, ListFilters } from './build';
import { fmtSecs, JOB_ST, KAP_LIMITS, kapOf, relTime, TYPE_L, TYPE_SHORT, type KapEdit, type KapJob, type LiveOpts, type LiveTest } from './fromKap';
import { stP } from './logic';

export interface AgentsLiveCtx {
  opts: LiveOpts;
  tests: Record<string, LiveTest>;
  /** first load from KAP in progress */
  loading: boolean;
  now: number;
  a: {
    edit: (a: Agent, what: KapEdit) => void;
    remove: (a: Agent) => void;
    test: (a: Agent) => void;
  };
}

export const SESSION_VERSIONS =
  'Session only. KAP keeps one configuration per agent and no version history: v1 stands for the configuration in KAP. Drafts, publishing and roll-back here stay in this browser session and are not sent to KAP. Change the live configuration on the Configuration tab.';
export const SESSION_EVAL =
  'Session only. KAP has no evaluation or evaluation gate. Evaluation runs here are simulated in this browser session; they do not change KAP and do not block changes. To run the agent for real, use the Testing tab.';

const row = (key: string, cells: Row['cells'], acts: Action[] = []): Row => ({ key, cells, acts });
const canUpd = (c: AgentsCtx, a: string) => c.can('agent:update', 'agent', a);
const canDel = (c: AgentsCtx, a: string) => c.can('agent:delete', 'agent', a) || canUpd(c, a);
const canExec = (c: AgentsCtx, a: string) => c.can('agent:execute', 'agent', a) || canUpd(c, a);
const jobDur = (j: KapJob, now: number) => (j.running_at ? fmtSecs(Math.max(0, ((j.finished_at ? Date.parse(j.finished_at) : now) - Date.parse(j.running_at)) / 1000)) : '—');
const jobQ = (j: KapJob) => j.user_prompt || (j.payload ? JSON.stringify(j.payload).slice(0, 120) : '(no request)');

export const LIVE_STATUS: ['approved', string] = ['approved', 'Active in KAP'];

// ================================================================ list
export function liveAgentsScreen(c: AgentsCtx, F: ListFilters, setF: (f: ListFilters) => void): ScreenModel {
  const L = c.live!;
  const all = c.D.agents.filter((a) => c.can('agent:read', 'agent', a.id));
  const ty = F.ty || 'Any type';
  const rows = all.filter((a) => (!F.q || (a.id + ' ' + a.purpose).toLowerCase().includes(F.q.toLowerCase())) && (ty === 'Any type' || TYPE_SHORT[kapOf(a)?.agent.type ?? ''] === ty));
  const filters: Filters = {
    q: F.q ?? '',
    qLabel: 'Search',
    qPlaceholder: 'Agent name or purpose',
    setQ: (q) => setF({ ...F, q }),
    main: [{ label: 'Type', value: ty, options: ['Any type', TYPE_SHORT.workflow, TYPE_SHORT.planner_and_executor], onChange: (v) => setF({ ...F, ty: v }) }],
    chips: ty !== 'Any type' ? [{ l: ty, x: () => setF({ ...F, ty: 'Any type' }) }] : [],
    clear: () => setF({}),
    count: rows.length + ' of ' + all.length + ' agents',
  };
  return {
    head: { title: 'Agents', acts: [act('Evaluation datasets', c.go.evalsets)], add: c.can('agent:create', 'agent', '*') ? act('Create agent', c.a.create, 'primary') : undefined },
    filters,
    sections: [
      {
        empty: L.loading ? 'Loading agents from KAP…' : all.length ? 'No agents match the filters.' : 'No agents in KAP for this tenant yet.',
        cols: ['Agent', 'Type', 'Model', 'Collections', 'Tools', 'Jobs (7 days)', 'Last job'],
        mode: 'inline',
        rows: rows.map((a) => {
          const k = kapOf(a)!;
          const last = k.jobs[0];
          const ws = wfUsing(c.D, a.id);
          return {
            key: 'a:' + a.id,
            cells: [
              cell(a.id, { m: true, sub: a.purpose }),
              cell(TYPE_SHORT[k.agent.type] ?? k.agent.type),
              cell(k.agent.model_ref, { m: true }),
              cell(k.agent.collections.join(', ') || '—'),
              cell(String(k.agent.allowed_tools.length), { sub: k.agent.allowed_tools.slice(0, 3).join(', ') + (k.agent.allowed_tools.length > 3 ? ' …' : '') }),
              cell(String(a.m[0]), { sub: a.m[1] ? a.m[1] + '% succeeded' : '' }),
              last ? cell('', { p: stP(JOB_ST[last.status]), sub: relTime(last.created_at, L.now) }) : cell('—'),
            ],
            acts: [act('Open', () => c.go.agent(a.id))].concat(ws.length ? [act('Workflows', () => c.go.workflow(ws[0].id, 'designer'))] : []),
            onClick: () => c.go.agent(a.id),
          };
        }),
      },
    ],
  };
}

// ================================================================ agent tabs
/** Sections of a live agent's tab, or null to use the session builders (evaluation, versions). */
export function liveAgentSections(c: AgentsCtx, a: Agent, tab: string, setTab: (v: string) => void): Section[] | null {
  const L = c.live!;
  const k = kapOf(a);
  if (!k) return [{ callout: 'This agent is not in KAP.' }];
  const K = k.agent;
  const upd = canUpd(c, a.id);
  const ed = (what: KapEdit, l = 'Edit'): Action[] => (upd ? [act(l, () => L.a.edit(a, what))] : []);

  if (tab === 'overview') {
    const ws = wfUsing(c.D, a.id);
    return [
      {
        form: true,
        sacts: (upd ? [act('Edit configuration', () => setTab('config'))] : []).concat(canDel(c, a.id) ? [act('Delete', () => L.a.remove(a), 'ghost')] : []),
        rows: [
          fr('Purpose', K.description || '—', '', ed('description')),
          fr('Type', TYPE_L[K.type] ?? K.type, 'Set when the agent is created'),
          fr('Status', 'Active in KAP', 'Created ' + relTime(K.created_at, L.now) + ' · updated ' + relTime(K.updated_at, L.now)),
          fr('Operational state', 'Accepts jobs', 'KAP has no emergency disable. Deleting the agent stops new jobs; its job history is kept.'),
          fr('Model', K.model_ref, 'Model provider in KAP', ed('model_ref', 'Change')),
          fr('Last 7 days', a.m[0] + ' jobs', a.m[1] ? a.m[1] + '% of finished jobs succeeded · p95 ' + a.m[2] : 'No finished jobs', [act('Metrics', () => setTab('metrics'))]),
          fr('Workflows', ws.map((w) => w.n).join(', ') || 'Not used in a workflow', 'Workflows are sample data in this console; KAP has no workflow orchestration', ws.length ? [act('Open', () => c.go.workflow(ws[0].id, 'map'))] : []),
          fr('KAP identifier', K.id, 'Used by the API to submit jobs'),
        ],
      },
    ];
  }

  if (tab === 'config') {
    const lim = (key: (typeof KAP_LIMITS)[number][0]) => (K[key] != null ? String(K[key]) : 'KAP default');
    const cfg = K.config || {};
    return [
      { callout: 'Live configuration in KAP. Each change is saved to KAP at once and applies to the next job. KAP keeps one configuration per agent: no drafts, versions or approvals.' },
      {
        form: true,
        title: 'Identity',
        rows: [fr('Name', K.name, 'Renaming keeps the job history', ed('name', 'Rename')), fr('Purpose', K.description || '—', '', ed('description')), fr('Type', TYPE_L[K.type] ?? K.type, 'Cannot be changed')],
      },
      {
        form: true,
        title: 'Instructions and model',
        rows: [
          fr('System prompt', K.system_prompt_is_set ? 'Set' : 'Not set', 'KAP stores the prompt but never returns it; editing replaces it', ed('system_prompt', K.system_prompt_is_set ? 'Replace' : 'Set')),
          fr('Model', K.model_ref, '', ed('model_ref', 'Change')),
        ],
      },
      ...(K.type === 'workflow'
        ? [
            {
              form: true,
              title: 'Input and output',
              sacts: ed('io'),
              rows: [
                fr('Input schema', cfg.input_schema_ref || 'None', cfg.input_schema_ref ? 'Every job needs a payload matching it' : 'Jobs take a free-text request'),
                fr('Output schema', cfg.output_schema_ref || 'None', cfg.output_schema_ref ? 'The answer is structured to this schema' : 'Free-text answer'),
                fr('Prompt template', cfg.user_prompt || '—', 'Added to each job’s request'),
              ],
            } as Section,
          ]
        : []),
      {
        form: true,
        title: 'Execution limits',
        sacts: ed('limits'),
        rows: KAP_LIMITS.map(([key, l]) => fr(l, lim(key))).concat([
          fr('Task priority', K.task_priority != null ? String(K.task_priority) : 'System default', 'Not editable here'),
          fr('Max tasks in flight', K.max_in_flight_tasks != null ? String(K.max_in_flight_tasks) : 'Shared default', 'Not editable here'),
        ]),
      },
      {
        form: true,
        title: 'Not in KAP',
        rows: [fr('Fallback model, multi-model routing, guardrails, governance tier', 'Not configurable', 'KAP agents have none of these settings. They exist only in the sample tenants of this console. Platform policies in the Policy Library still describe the target design.', [act('Policy Library', c.go.policies, 'ghost')])],
      },
    ];
  }

  if (tab === 'knowledge') {
    const inv = new Map((c.af.mcp.servers || []).flatMap((s) => s.tools.map((t) => [t.n, s.n] as [string, string])));
    return [
      {
        title: 'Collections',
        sacts: ed('collections'),
        note: 'At most two collections per agent in KAP.',
        empty: 'No collections assigned. The agent can still use tools.',
        cols: ['Collection'],
        mode: 'inline',
        rows: K.collections.map((n) => row('kc:' + n, [cell(n, { m: true })], [act('Collections', c.go.collections)])),
      },
      {
        title: 'Allowed tools',
        sacts: ed('allowed_tools'),
        note: 'Names of tools in the tenant configuration (built-in or MCP). The agent can call only these.',
        empty: 'No tools allowed.',
        cols: ['Tool', 'Source'],
        mode: 'inline',
        rows: K.allowed_tools.map((n) => row('kt:' + n, [cell(n, { m: true }), cell(inv.has(n) ? 'MCP · ' + inv.get(n) : 'Tenant configuration')], [act('Tool Catalog', c.go.tools)])),
      },
      { form: true, title: 'Business Entities', rows: [fr('Entity context', 'Not in KAP', 'KAP agents have no Business Entities context.')] },
      { form: true, rows: [fr('How callers get data', "Their own access, not the agent's", 'Assigning a collection or tool to this agent does not give callers access. Manage access on the resource itself.')] },
    ];
  }

  if (tab === 'testing') {
    const t0 = L.tests[a.id];
    return [
      {
        form: true,
        title: 'Test run',
        sacts: (canExec(c, a.id) ? [act('Run test', () => L.a.test(a))] : []).concat([act('Open Playground', c.go.playground, 'ghost')]),
        rows: t0
          ? [
              fr('Job', t0.id, 'Submitted ' + relTime(new Date(t0.at).toISOString(), L.now) + ' · runs in KAP with the current configuration', [act('Open trace', () => c.go.run(t0.id))]),
              fr('Request', t0.q),
              fr('Result', 'See the trace', 'The job runs asynchronously; Monitoring shows its status, tools and answer.'),
            ]
          : [fr('No test run yet', 'Run a real job in KAP', 'Tests here are real KAP jobs and appear in Monitoring.')],
      },
      jobsSec(c, a, 'Recent jobs'),
    ];
  }

  if (tab === 'metrics') {
    const fails = k.jobs.filter((j) => j.status === 'failed');
    return [
      {
        form: true,
        title: 'Last 7 days',
        sacts: [act('Open Monitoring', c.go.monitoring, 'ghost')],
        rows: [
          fr('Jobs', String(a.m[0]), k.jobs7d == null ? 'Counted from the newest jobs KAP returned' : 'All jobs created in the last 7 days'),
          fr('Success rate', a.m[1] ? a.m[1] + '%' : '—', 'Succeeded of finished jobs (newest 100)'),
          fr('Latency p95', a.m[2], 'From start to finish of each job'),
          fr('Tool error rate', '—', 'Not in KAP’s job list · see traces in Monitoring'),
          fr('Model tokens', '—', 'Not in KAP’s job list · see traces in Monitoring'),
          fr('Recent failures', String(fails.length), [...new Set(fails.map((j) => j.error || 'No error message'))].join('; ')),
        ],
      },
      jobsSec(c, a, 'Recent jobs'),
    ];
  }
  return null;
}

function jobsSec(c: AgentsCtx, a: Agent, title: string): Section {
  const L = c.live!;
  const k = kapOf(a)!;
  return {
    title,
    empty: 'No jobs yet.',
    cols: ['Job', 'Request', 'Status', 'Created', 'Duration'],
    mode: 'inline',
    rows: k.jobs.map((j) => ({
      ...row('rj:' + j.id, [cell(j.id.slice(0, 8), { m: true }), cell(jobQ(j), { sub: j.error || '' }), cell('', { p: stP(JOB_ST[j.status]) }), cell(relTime(j.created_at, L.now)), cell(jobDur(j, L.now))], [act('Open trace', () => c.go.run(j.id))]),
      onClick: () => c.go.run(j.id),
    })),
  };
}

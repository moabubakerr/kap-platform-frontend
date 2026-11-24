/**
 * Wires the AI Agent Tools and Schedules & Events builders to the agent
 * factory store, dialogs, router, "view as" permissions and the audit trail.
 * Actions mutate `agentFactoryStore` the way the prototype's `setA` / `setR` do.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs, type FormField, type FormValues } from '@/engine/dialogs';
import { createStore } from '@/engine/store';
import { kap, kapAll, kapError } from '@/api/kap';
import { useAccess } from '@/v35/access';
import { liveSave, liveTenantId, useLiveLoad, type Live } from '@/v35/live';
import { recordAudit } from '@/v35/data/audit';
import { businessStore } from '@/v35/data/businessData';
import { ingestStore } from '@/v35/data/ingest';
import { AF_TENANT_NAME, agentFactoryStore, cfgOf, isAfTenant, resolveModel, wfUsing, type AfTenant, type AfTenantKey, type AgentFactoryData, type Schedule } from '@/v35/data/agentFactory';
import type { TenantKey } from '@/v35/iam';
import {
  assignInDraft, canUpd, discover, eventsOf, grantAvail, grantCandidates, grantKind, grantLabel, kapServerFields, nameOf, newServerValues, objOf, pubTools, SCHED_STEPS, schedFields, schedRecord,
  schedValues, serverFields, serverValues, simCheck, SERVER_SECRETS, toolImpact, usersOfServer, validateSched, validateServer, workTools,
  type AfBase, type ConnTest, type LiveTools, type McpCtx, type McpRow, type SchedCtx, type ToolItem, type ToolsCtx,
} from './build';
import {
  agentGrants, applyLiveMcp, checkHealth, checkMessage, kapServerValues, knownTools, newKapServerValues, toKapCreate, toKapPatch, toKapRestore, toMcpServer, toolNames, toSrvInfo, validateKapServer,
  type KapAgentTools, type KapMcpCheck, type KapMcpServer,
} from './fromKap';

/** Connection test results (prototype `mcpTest`), keyed `tenant:server`. */
export const connTestStore = createStore<Record<string, ConnTest>>(() => ({}));

// ============================================================ live tenant (KAP)

interface LiveMcpState {
  servers: KapMcpServer[];
  agents: KapAgentTools[];
  /** store agent id → KAP agent id */
  ids: Record<string, string>;
}
/** Raw KAP records of the live tenant's MCP slice, by tenant. */
export const liveMcpStore = createStore<Record<string, LiveMcpState>>(() => ({}));
/** Last KAP check per server (session only; KAP stores no check state), keyed `tenant:server`. */
export const kapCheckStore = createStore<Record<string, KapMcpCheck>>(() => ({}));

const checksOf = (t: string) => Object.fromEntries(Object.entries(kapCheckStore.get()).filter(([k]) => k.startsWith(`${t}:`)).map(([k, v]) => [k.slice(t.length + 1), v]));

/** (Re)write tenant t's MCP slice of the agent factory store from the raw KAP records and the session's checks. */
function applyLive(t: AfTenantKey) {
  const L = liveMcpStore.get()[t];
  if (!L) return;
  const checks = checksOf(t);
  const storeIds = agentFactoryStore.get().tenants[t].agents.map((a) => a.id);
  const { grants, ids } = agentGrants(L.agents, storeIds, checks);
  agentFactoryStore.update((all) => applyLiveMcp(all.mcp, t, L.servers.map((s) => toMcpServer(s, t, checks[s.name])), grants));
  liveMcpStore.update((x) => { x[t].ids = ids; });
}

/** Loads the live tenant's MCP servers and agents' allowed_tools (key 'af-mcp'). */
function useMcpLive(key: TenantKey | null): Live {
  const live = useLiveLoad('af-mcp', key, async (tenantId) => {
    if (!isAfTenant(key)) return;
    const [servers, agents] = await Promise.all([kapAll<KapMcpServer>(tenantId, 'mcp-servers'), kapAll<KapAgentTools>(tenantId, 'agents')]);
    liveMcpStore.update((x) => { x[key] = { servers, agents, ids: {} }; });
    applyLive(key);
  });
  // the agents hub (key 'af-agents') may replace the store's agents: re-key the grants to its agent ids
  const agentIds = agentFactoryStore.use().tenants[isAfTenant(key) ? key : 'sandbox'].agents.map((a) => a.id).join('\n');
  React.useEffect(() => {
    if (live.on && isAfTenant(key) && liveMcpStore.get()[key]) applyLive(key);
  }, [agentIds, live.on, key]);
  return live;
}

const TENANT_LABEL: Record<string, string> = { ...AF_TENANT_NAME, default: 'Default' };

/** Shared wiring: tenant, permissions, navigation, store updates, audit. */
export function useAfBase() {
  const scope = useScope();
  const base = useBase();
  const nav = useNavigate();
  const d = useDialogs();
  const key = scope.kind === 'project' ? (scope.project.key as TenantKey) : null;
  const access = useAccess(key);
  const af = agentFactoryStore.use();
  const lm = liveMcpStore.use();
  const t = isAfTenant(key) ? key : null;
  const tn = TENANT_LABEL[key ?? ''] ?? key ?? '';
  const L = t && liveTenantId(t) ? lm[t] : undefined;
  const liveTools: LiveTools | undefined = t && liveTenantId(t) ? { info: Object.fromEntries((L?.servers || []).map((s) => [s.name, toSrvInfo(s)])), known: knownTools(L?.agents || []) } : undefined;
  const c: AfBase | null = t ? { t, tn, af, D: af.tenants[t], actor: access.uid, can: access.can, ...(liveTools ? { liveTools } : {}) } : null;
  return { key, t, tn, c, base, nav, d, access, af };
}

type Base = ReturnType<typeof useAfBase>;

function helpers(b: Base, t: AfTenantKey) {
  const setA = (fn: (D: AfTenant, all: AgentFactoryData) => void) => agentFactoryStore.update((all) => fn(all.tenants[t], all));
  const audit = (action: string, res: string, area: string) => recordAudit({ who: b.access.uid, action, res, tenants: [t], lvl: 'tenant', area });
  const fresh = (): AfBase => ({ t, tn: b.tn, af: agentFactoryStore.get(), D: agentFactoryStore.get().tenants[t], actor: b.access.uid, can: b.access.can });
  const go = {
    agent: (id: string, tab?: string) => b.nav(`${b.base}/agents/${encodeURIComponent(id)}${tab && tab !== 'overview' ? `/${tab}` : ''}`),
    workflow: (id: string, tab?: string) => b.nav(`${b.base}/workflows/${encodeURIComponent(id)}${tab && tab !== 'overview' ? `/${tab}` : ''}`),
    run: (id: string, tab?: string) => b.nav(`${b.base}/monitoring/runs/${encodeURIComponent(id)}${tab ? `/${tab}` : ''}`),
    audit: () => b.nav(`${b.base}/audit`),
    tools: (open?: string) => b.nav(`${b.base}/tools${open ? `?open=${encodeURIComponent(open)}` : ''}`),
    mcp: (server?: string) => b.nav(`${b.base}/tools/mcp${server ? `/${encodeURIComponent(server)}` : ''}`),
    schedules: () => b.nav(`${b.base}/schedules`),
    reports: () => b.nav(`${b.base}/schedules/reports`),
  };
  return { setA, audit, fresh, go };
}

// ============================================================ tools

/** KAP write of an agent's allowed_tools; reloads this hub and the agents hub. */
function patchAllowedTools(live: Live, qc: ReturnType<typeof useQueryClient>, t: AfTenantKey, agent: string, keys: string[], after: () => void): Promise<string> {
  const kid = liveMcpStore.get()[t]?.ids[agent];
  if (!kid || !live.tenantId) return Promise.resolve(`${agent} is not an agent in KAP. Refresh, then try again.`);
  const tid = live.tenantId;
  return liveSave(live, () => kap(tid, 'PATCH', `agents/${encodeURIComponent(kid)}`, { allowed_tools: toolNames(keys) }), () => {
    after();
    void qc.invalidateQueries({ queryKey: ['live', 'af-agents'] });
  });
}

export function useToolsCtx(): ((ToolsCtx & { ok: true }) | (Base & { ok: false })) & { live: Live } {
  const b = useAfBase();
  const live = useMcpLive(b.key);
  const qc = useQueryClient();
  return React.useMemo(() => {
    if (!b.c || !b.t) return { ...b, ok: false as const, live };
    const t = b.t;
    const { setA, audit, fresh, go } = helpers(b, t);
    const { d } = b;
    const actor = b.access.uid;

    /** live: KAP has no drafts or versions; the tool is added to the agent's allowed_tools at once */
    const assignLive = (tool: ToolItem) => {
      const c = fresh();
      const ids = liveMcpStore.get()[t]?.ids || {};
      const cand = c.D.agents.filter((a) => ids[a.id] && !pubTools(c, a.id).map((k) => k.split(':').pop()).includes(tool.n) && canUpd(c, a.id)).map((a) => a.id);
      if (!cand.length) {
        d.toast(`Every KAP agent you can edit already has ${tool.n}.`);
        return;
      }
      d.form(`Assign ${tool.n} to an agent`, [
        { type: 'select', k: 'a', label: 'Agent', opts: cand, val: cand[0] },
        { type: 'note', text: 'KAP has no agent drafts: the tool is added to the agent’s allowed_tools in KAP and applies to its next jobs.' },
      ], 'Add to allowed tools', (v) => patchAllowedTools(live, qc, t, v.a, pubTools(fresh(), v.a).concat(tool.key), () => {
        d.toast(`${tool.n} added to ${v.a} in KAP.`);
        audit('Granted tools to agent', `${v.a} · ${tool.n} · KAP allowed_tools`, 'AI Agent Tools');
      }));
    };

    const assign = (tool: ToolItem) => {
      if (live.on) return assignLive(tool);
      const c = fresh();
      const cand = c.D.agents.filter((a) => a.st !== 'Archived' && !workTools(c, a.id).includes(tool.key) && canUpd(c, a.id)).map((a) => a.id);
      if (!cand.length) {
        d.toast(`Every agent you can edit already has ${tool.n}.`);
        return;
      }
      d.form(`Assign ${tool.n} to an agent`, [
        { type: 'select', k: 'a', label: 'Agent', opts: cand, val: cand[0] },
        { type: 'note', text: "The tool is added to the agent's draft configuration. A draft is created if the agent has none. Test and publish the draft to put the change into effect." },
      ], 'Add to draft', (v) => {
        let r: ReturnType<typeof assignInDraft> = null;
        const published = pubTools(fresh(), v.a);
        setA((D) => { r = assignInDraft(D, published, v.a, tool.key, true, actor); });
        if (!r) return 'Choose an agent.';
        const res = r as { v: string; created: boolean };
        d.toast(`${tool.n} added to ${v.a} · draft ${res.v}${res.created ? ' created' : ''}. It takes effect when the draft is published.`);
        audit('Assigned tool in draft', `${v.a} ${res.v} · ${tool.key}`, 'AI Agent Factory');
        return '';
      });
    };

    const disable = (tool: ToolItem) => {
      const aff = toolImpact(fresh(), tool);
      const fields: FormField[] = [
        live.on
          ? { type: 'note', tone: 'warn', label: 'This console session only', text: 'KAP has no emergency disable for a tool: this marks the tool disabled here only, and KAP agents keep calling it. To stop them, remove it from their allowed tools (MCP Connections · Agent tool assignments) or deactivate its MCP server.' }
          : { type: 'note', tone: 'bad', label: 'Takes effect immediately', text: 'Emergency disablement takes effect at once, without a new version. Agents stop calling it at once and answer without it or report the limitation.' },
        ...(aff.length ? [{ type: 'kv', label: 'Potentially affected', rows: aff } as FormField] : []),
        { type: 'text', k: 'reason', label: 'Reason', ph: 'e.g. Unsafe answers observed in job b1c94f08' },
        { type: 'select', k: 'ack', label: 'Confirmation', opts: ['Select', `Disable ${tool.n} now`], val: 'Select' },
      ];
      d.form(`Emergency disable · ${tool.n}`, fields, 'Disable now', (v) => {
        const reason = String(v.reason || '').trim();
        if (reason.length < 8) return 'Enter the reason (at least 8 characters).';
        if (v.ack === 'Select') return 'Confirm the disablement.';
        const ref = `AUD-${String(Date.now()).slice(-6)}`;
        setA((D) => { D.toolDis[tool.key] = { by: actor, at: 'just now', reason, ref }; });
        d.toast(live.on ? `${tool.n} marked disabled in this console session only · KAP is unchanged.` : `${tool.n} disabled immediately · audit ${ref}.`);
        audit('Emergency disabled tool', `${tool.key} · ${reason} · ${ref} · affects ${tool.pub.join(', ') || 'no agents'}`, 'AI Governance');
        return '';
      });
    };

    const reenable = (tool: ToolItem) =>
      d.form(`Re-enable ${tool.n}`, [{ type: 'text', k: 'reason', label: 'Reason' }], 'Re-enable', (v) => {
        const reason = String(v.reason || '').trim();
        if (reason.length < 8) return 'Enter the reason (at least 8 characters).';
        setA((D) => { delete D.toolDis[tool.key]; });
        d.toast(`${tool.n} re-enabled.`);
        audit('Re-enabled tool after emergency disable', `${tool.key} · ${reason}`, 'AI Governance');
        return '';
      });

    const ctx: ToolsCtx = {
      ...b.c,
      go: { tab: (v) => (v === 'mcpconn' ? go.mcp() : go.tools()), agent: go.agent, workflow: go.workflow, mcp: go.mcp, audit: go.audit },
      a: { assign, disable, reenable },
    };
    return { ...ctx, ok: true as const, live };
  }, [b.c, b.t, b.d, b.nav, b.base, b.access, live, qc]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ============================================================ MCP connections

export function useMcpCtx(): ((McpCtx & { ok: true }) | (Base & { ok: false })) & { live: Live } {
  const b = useAfBase();
  const tests = connTestStore.use();
  const live = useMcpLive(b.key);
  const qc = useQueryClient();
  return React.useMemo(() => {
    if (!b.c || !b.t) return { ...b, ok: false as const, live };
    const t = b.t;
    const { audit, fresh, go } = helpers(b, t);
    const { d } = b;
    const actor = b.access.uid;
    const srv =(n: string) => agentFactoryStore.get().mcp.servers.find((s) => s.n === n);
    const setTest = (n: string, v: ConnTest) => connTestStore.update((x) => { x[`${t}:${n}`] = v; });

    // ---------------- live tenant: KAP writes
    const tid = live.tenantId;
    const raw = (n: string) => liveMcpStore.get()[t]?.servers.find((s) => s.name === n);

    /** POST …/check; the result is kept for the session and drives health. Returns the message. */
    const runCheck = async (id: string, n: string): Promise<{ ok: boolean; m: string }> => {
      const ck = await kap<KapMcpCheck>(tid!, 'POST', `mcp-servers/${encodeURIComponent(id)}/check`);
      kapCheckStore.update((x) => { x[`${t}:${n}`] = ck; });
      applyLive(t);
      return { ok: checkHealth(ck) !== 'Failing', m: checkMessage(ck) };
    };

    const testLive = async (n: string) => {
      const k = raw(n);
      if (!k || !tid) return;
      setTest(n, { s: 'busy', m: '' });
      try {
        const r = await runCheck(k.id, n);
        setTest(n, { s: r.ok ? 'ok' : 'fail', m: r.m });
        d.toast(`${n}: ${r.m}`);
        audit('Checked MCP server', `${n} · ${r.m}`, 'AI Agent Tools');
      } catch (e) {
        const m = `KAP check failed: ${kapError(e)}`;
        setTest(n, { s: 'fail', m });
        d.toast(`${n}: ${m}`);
      }
    };

    const wizardLive = (prevName: string | null) => {
      const prev = prevName ? srv(prevName) ?? null : null;
      const k = prevName ? raw(prevName) : undefined;
      const isEdit = !!prev && !!k;
      const info = k ? toSrvInfo(k) : null;
      const names = (liveMcpStore.get()[t]?.servers || []).map((s) => s.name);
      d.wizard({
        title: isEdit ? `Configure · ${prev!.n}` : 'Register MCP Server',
        steps: ['Connection', 'Limits and TLS', 'Review'],
        finishL: isEdit ? 'Save' : 'Register',
        initial: isEdit ? kapServerValues(prev!, info!) : newKapServerValues(),
        fields: (step, v) => kapServerFields(step, v, isEdit, info?.headers || []),
        validate: (step, v) => (step < 2 ? validateKapServer(v, names, isEdit, step) : ''),
        finish: async (v) => {
          const e = validateKapServer(v, names, isEdit);
          if (e) return e;
          if (!tid) return 'The tenant is not live.';
          if (isEdit) {
            const body = toKapPatch(v, prev!, info!);
            if (!Object.keys(body).length) return '';
            return liveSave(live, async () => {
              await kap(tid, 'PATCH', `mcp-servers/${encodeURIComponent(k!.id)}`, body);
              setTest(prev!.n, { s: 'busy', m: '' });
              runCheck(k!.id, prev!.n).then((r) => setTest(prev!.n, { s: r.ok ? 'ok' : 'fail', m: r.m }), (er) => setTest(prev!.n, { s: 'fail', m: `KAP check failed: ${kapError(er)}` }));
            }, () => {
              d.toast(`${prev!.n} saved in KAP.`);
              audit('Updated tenant MCP server', `${prev!.n} · ${Object.keys(body).join(', ')}`, 'AI Agent Tools');
            });
          }
          const name = String(v.n).trim();
          return liveSave(live, async () => {
            const created = await kap<KapMcpServer>(tid, 'POST', 'mcp-servers', toKapCreate(v));
            setTest(name, { s: 'busy', m: '' });
            runCheck(created.id, name).then((r) => setTest(name, { s: r.ok ? 'ok' : 'fail', m: r.m }), (er) => setTest(name, { s: 'fail', m: `KAP check failed: ${kapError(er)}` }));
          }, () => {
            d.toast(`${name} registered in KAP. Checking the connection…`);
            audit('Registered tenant MCP server', `${name} · KAP`, 'AI Agent Tools');
            window.setTimeout(() => go.mcp(name), 0);
          });
        },
      });
    };

    const toggleLive = (r: McpRow) => {
      const k = raw(r.n);
      if (!k || !tid) return;
      if (k.is_active) {
        d.confirm(`Deactivate ${r.n}?`, 'KAP keeps the server deactivated with its identifier; registering the same name again brings it back. KAP refuses (409) while a tool in the tenant configuration still references it.', [], 'Deactivate', () =>
          liveSave(live, () => kap(tid, 'DELETE', `mcp-servers/${encodeURIComponent(k.id)}`), () => {
            d.toast(`${r.n} deactivated in KAP.`);
            audit('Disabled MCP connection', `${r.n} · KAP deactivate`, 'AI Agent Tools');
          }),
        );
        return;
      }
      const info = toSrvInfo(k);
      d.confirm(`Reactivate ${r.n}?`, `KAP brings the server back by registering its name again with the stored URL and settings.${info.headers.length ? ` Header values are write-only and are not sent again: set ${info.headers.join(', ')} with Configure afterwards.` : ''}`, [], 'Reactivate', () =>
        liveSave(live, () => kap(tid, 'POST', 'mcp-servers', toKapRestore(r.s, info)), () => {
          d.toast(`${r.n} reactivated in KAP.`);
          audit('Enabled tenant MCP server', `${r.n} · KAP`, 'AI Agent Tools');
        }),
      );
    };

    const grantLive = (a: string) => {
      const cur = (agentFactoryStore.get().mcp.grants[t] || {})[a] || [];
      const curNames = toolNames(cur);
      const L = liveMcpStore.get()[t];
      const opts = [...new Set(knownTools(L?.agents || []).concat(curNames))].sort();
      const missing = cur.filter((g) => !g.startsWith('kap:'));
      const fields: FormField[] = [
        { type: 'chips', k: 'on', label: 'Allowed tools', opts, val: curNames },
        { type: 'text', k: 'more', label: 'Other tool names', ph: 'comma-separated', hint: 'Each name must be a tool of the tenant configuration; KAP rejects unknown names.' },
        ...(missing.length ? [{ type: 'note', tone: 'warn', text: `Reported missing on their MCP server by the last check: ${missing.map(grantLabel).join(', ')}.` } as FormField] : []),
        { type: 'note', text: 'Saved to the agent’s allowed_tools in KAP; applies to its next jobs. Tools are listed from KAP’s built-in hybrid_search and every agent’s allowed tools.' },
      ];
      d.form(`Tools · ${a}`, fields, 'Save', (v: FormValues) => {
        const more = String(v.more || '').split(',').map((x) => x.trim()).filter(Boolean);
        const bad = more.find((x) => !/^[A-Za-z0-9_.-]+$/.test(x));
        if (bad) return `"${bad}" is not a tool name.`;
        const next = toolNames(((v.on as string[]) || []).concat(more));
        const add = next.filter((x) => !curNames.includes(x));
        const rem = curNames.filter((x) => !next.includes(x));
        if (!add.length && !rem.length) return '';
        return patchAllowedTools(live, qc, t, a, next, () => {
          d.toast(`Tools for ${a} updated in KAP.`);
          if (add.length) audit('Granted tools to agent', `${a} · ${add.join(', ')} · KAP allowed_tools`, 'AI Agent Tools');
          if (rem.length) audit('Removed tools from agent', `${a} · ${rem.join(', ')} · KAP allowed_tools`, 'AI Agent Tools');
        });
      });
    };

    const test = (n: string) => {
      if (live.on) return void testLive(n);
      const s = srv(n);
      if (!s) return;
      const r = simCheck(s);
      if (s.status !== 'Enabled' || s.susp) {
        setTest(n, { s: 'fail', m: r.m });
        d.toast(`${n}: ${r.m}`);
        return;
      }
      setTest(n, { s: 'busy', m: '' });
      window.setTimeout(() => {
        agentFactoryStore.update((all) => {
          const x = all.mcp.servers.find((y) => y.n === n);
          if (x) {
            x.health = r.ok ? r.h! : 'Failing';
            if (r.ok) x.lastOk = 'just now';
          }
        });
        setTest(n, { s: r.ok ? 'ok' : 'fail', m: r.m });
        d.toast(`${n}: ${r.m}`);
      }, 900);
    };

    const enableTools = (n: string) => {
      if (live.on) {
        d.info(`Permitted tools · ${n}`, 'KAP has no per-tenant tool enablement and does not list a server’s tools: tools are defined in the tenant configuration, and agents get them through their allowed tools.');
        return;
      }
      const s = srv(n);
      if (!s) return;
      const af = agentFactoryStore.get();
      const cur = (af.mcp.tenTools[t] || {})[n] || [];
      const users = s.tools.map((x) => [x.n, usersOfServer(af, t, n, x.n)] as const).filter(([, u]) => u.length);
      d.form(`Permitted tools · ${n}`, [
        { type: 'kv', label: 'Server', rows: [['Classification ceiling', s.cls], ['Personal data', s.pii.toLowerCase()], ['Side effects', s.fx.toLowerCase()]] },
        { type: 'chips', k: 'on', label: 'Tools enabled in this tenant', opts: s.tools.map((x) => x.n), val: cur.slice() },
        ...(users.length ? [{ type: 'note', tone: 'warn', text: `Disabling a tool removes it from the agents granted it: ${users.map(([tl, u]) => `${tl} → ${u.join(', ')}`).join('; ')}.` } as FormField] : []),
      ], 'Save', (v) => {
        const on: string[] = v.on || [];
        const off = cur.filter((x) => !on.includes(x));
        const add = on.filter((x) => !cur.includes(x));
        agentFactoryStore.update((all) => {
          all.mcp.tenTools[t] = all.mcp.tenTools[t] || {};
          all.mcp.tenTools[t][n] = on.slice();
          const g = all.mcp.grants[t] || {};
          Object.keys(g).forEach((a) => { g[a] = g[a].filter((k) => !off.map((x) => `${n}:${x}`).includes(k)); });
        });
        d.toast(`Permitted tools for ${n} saved.`);
        audit('Changed permitted tools', `${n}${add.length ? ` · +${add.join(', ')}` : ''}${off.length ? ` · −${off.join(', ')}` : ''}`, 'AI Agent Tools');
        return '';
      });
    };

    const serverWizard = (prevName: string | null) => {
      if (live.on) return wizardLive(prevName);
      const prev = prevName ? srv(prevName) ?? null : null;
      const isEdit = !!prev;
      d.wizard({
        title: isEdit ? `Configure · ${prev!.n}` : 'Register MCP Server',
        steps: ['Connection', 'Data and limits', 'Test and discover'],
        finishL: isEdit ? 'Save' : 'Register',
        initial: prev ? serverValues(prev) : newServerValues(t),
        fields: (step, v) => serverFields(t, step, v, isEdit, prev),
        validate: (step, v) => (step < 2 ? validateServer(v, agentFactoryStore.get().mcp.servers, isEdit, step) : ''),
        finish: (v) => {
          const e = validateServer(v, agentFactoryStore.get().mcp.servers, isEdit);
          if (e) return e;
          const r = discover(v, prev);
          if (!r.ok) return `Test Connection & Discover Tools failed: ${r.m}`;
          const secret = v.auth === 'None' ? '' : (SERVER_SECRETS[t] || []).find((x) => x.split('/').pop() === v.secret) || '';
          const rec = {
            n: String(v.n), own: t, vendor: String(v.vendor || ''), up: String(v.up).trim(), dest: String(v.dest || ''), auth: String(v.auth), secret,
            cls: String(v.cls), pii: String(v.pii), fx: String(v.fx), timeout: String(v.timeout), rate: String(v.rate), retries: String(v.retries), disc: String(v.disc),
          };
          if (isEdit) {
            const changed = (['up', 'auth', 'secret', 'dest', 'cls', 'pii', 'fx'] as const).filter((k) => (prev as unknown as Record<string, string>)[k] !== rec[k]);
            agentFactoryStore.update((all) => {
              const x = all.mcp.servers.find((y) => y.n === prev!.n);
              if (!x) return;
              Object.assign(x, rec, { by: `${actor} · just now`, tools: r.tools, health: 'Healthy', lastOk: 'just now' });
              const tt = (all.mcp.tenTools[t] = all.mcp.tenTools[t] || {});
              tt[x.n] = (tt[x.n] || []).filter((n) => r.tools.some((y) => y.n === n));
            });
            d.toast(`${rec.n} saved.`);
            audit('Updated tenant MCP server', `${rec.n}${changed.length ? ` · ${changed.join(', ')}` : ''}`, 'AI Agent Tools');
          } else {
            agentFactoryStore.update((all) => {
              all.mcp.servers.push({ ...rec, status: 'Enabled', susp: false, health: 'Healthy', lastOk: 'just now', p95: '—', by: `${actor} · just now`, tools: r.tools });
              all.mcp.tenTools[t] = all.mcp.tenTools[t] || {};
              all.mcp.tenTools[t][rec.n] = [];
            });
            d.toast(`${rec.n} registered. Enable its tools to make them available to agents.`);
            audit('Registered tenant MCP server', rec.n, 'AI Agent Tools');
            window.setTimeout(() => go.mcp(rec.n), 0);
          }
          return '';
        },
      });
    };

    const toggle = (r: McpRow) => {
      if (live.on) return toggleLive(r);
      if (r.s.status === 'Disabled') {
        agentFactoryStore.update((all) => {
          const x = all.mcp.servers.find((y) => y.n === r.n);
          if (x) { x.status = 'Enabled'; x.health = 'Not checked'; }
        });
        d.toast(`${r.n} enabled.`);
        audit('Enabled tenant MCP server', r.n, 'AI Agent Tools');
        return;
      }
      const items = [
        ...r.users.map((a) => ({ a: 'Agent', b: a, c: '' })),
        ...r.wfs.map((w) => ({ a: 'Workflow', b: w.n, c: `through ${r.users.filter((a) => wfUsing(fresh().D, a).some((x) => x.id === w.id)).join(', ')}` })),
        ...(r.users.length ? [] : [{ a: 'Agents', b: 'None use it', c: '' }]),
      ];
      d.confirm(`Disable ${r.n}?`, 'Its tools become unavailable until the connection is enabled again.', items, 'Disable', () => {
        agentFactoryStore.update((all) => {
          const x = all.mcp.servers.find((y) => y.n === r.n);
          if (x) x.status = 'Disabled';
        });
        d.toast(`${r.n} disabled.`);
        audit('Disabled MCP connection', `${r.n} · affects ${r.users.join(', ') || 'no agents'}`, 'AI Agent Tools');
      });
    };

    const remove = (r: McpRow) => {
      // KAP has no delete: DELETE deactivates
      if (live.on) return toggleLive(r);
      const plat = r.isPlatS;
      const items = r.users.map((a) => ({ a: b.tn, b: 'Agent', c: a }));
      const title = `${plat ? `Remove ${r.n} from ${b.tn}` : `Delete ${r.n}`}?`;
      if (items.length) {
        d.info(title, 'Still granted to agents. Remove it from these agents first:', items);
        return;
      }
      d.confirm(title, plat ? `Agents in ${b.tn} can no longer use its tools.` : 'The server and its tool settings are removed.', [], plat ? 'Remove' : 'Delete', () => {
        agentFactoryStore.update((all) => {
          if (plat) {
            all.mcp.optOut[t] = all.mcp.optOut[t] || {};
            all.mcp.optOut[t][r.n] = true;
          } else {
            all.mcp.servers = all.mcp.servers.filter((x) => x.n !== r.n);
            delete (all.mcp.tenTools[t] || {})[r.n];
          }
        });
        d.toast(`${r.n}${plat ? ` removed from ${b.tn}.` : ' deleted.'}`);
        audit(plat ? 'Removed shared MCP server from tenant' : 'Deleted tenant MCP server', r.n, 'AI Agent Tools');
        go.mcp();
      });
    };

    /** Edit an agent's published tool grants (prototype mcpAsg). */
    const grantFor = (a: string) => {
      if (live.on) return grantLive(a);
      const af = agentFactoryStore.get();
      const cur = (af.mcp.grants[t] || {})[a] || [];
      const all = [...new Set(grantCandidates(af, t).concat(cur))];
      const lab = (g: string) => grantLabel(g) + (grantAvail(af, t, g) ? '' : ' · unavailable');
      const byKind = (k: 'nat' | 'sh' | 'tn') => all.filter((g) => grantKind(af, g) === k);
      const fields: FormField[] = (
        [['nat', 'Native tools'], ['sh', 'Shared MCP'], ['tn', `Tenant MCP servers · ${b.tn}`]] as const
      ).flatMap(([k, label]) => {
        const gs = byKind(k);
        return gs.length ? [{ type: 'chips', k, label, opts: gs.map(lab), val: gs.filter((g) => cur.includes(g)).map(lab) } as FormField] : [{ type: 'note', label, text: 'None available in this tenant.' } as FormField];
      });
      d.form(`Tools · ${a}`, fields, 'Save', (v: FormValues) => {
        const picked = (['nat', 'sh', 'tn'] as const).flatMap((k) => byKind(k).filter((g) => (v[k] || []).includes(lab(g))));
        const add = picked.filter((g) => !cur.includes(g));
        const rem = cur.filter((g) => !picked.includes(g));
        if (!add.length && !rem.length) return '';
        agentFactoryStore.update((x) => {
          x.mcp.grants[t] = x.mcp.grants[t] || {};
          x.mcp.grants[t][a] = picked;
        });
        d.toast(`Tools for ${a} updated.`);
        if (add.length) audit('Granted tools to agent', `${a} · ${add.map(grantLabel).join(', ')}`, 'AI Agent Tools');
        if (rem.length) audit('Removed tools from agent', `${a} · ${rem.map(grantLabel).join(', ')}`, 'AI Agent Tools');
        return '';
      });
    };
    const grant = (a?: string) => {
      if (a) return grantFor(a);
      const agents = fresh().D.agents.filter((x) => x.st !== 'Archived').map((x) => x.id);
      d.form('Grant tools', [{ type: 'select', k: 'a', label: 'Agent', opts: agents }], 'Next', (v) => {
        window.setTimeout(() => grantFor(v.a), 0);
        return '';
      });
    };

    const ctx: McpCtx = {
      ...b.c,
      tests: Object.fromEntries(Object.entries(tests).filter(([k]) => k.startsWith(`${t}:`)).map(([k, v]) => [k.slice(t.length + 1), v])),
      go: { tab: (v) => (v === 'mcpconn' ? go.mcp() : go.tools()), agent: go.agent, workflow: go.workflow, mcp: go.mcp, audit: go.audit, tool: (k) => go.tools(`tl:${k}`) },
      a: { register: () => serverWizard(null), test, enableTools, configure: (n) => serverWizard(n), toggle, remove, grant },
    };
    return { ...ctx, ok: true as const, live };
  }, [b.c, b.t, b.d, b.nav, b.base, b.access, tests, live, qc]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ============================================================ schedules

export function useSchedCtx(): (SchedCtx & { ok: true }) | (Base & { ok: false }) {
  const b = useAfBase();
  return React.useMemo(() => {
    if (!b.c || !b.t) return { ...b, ok: false as const };
    const t = b.t;
    const { setA, audit, fresh, go } = helpers(b, t);
    const { d } = b;
    const actor = b.access.uid;
    const evs = (D: AfTenant) => eventsOf(D, (ingestStore.get()[t]?.pipelines || []).map((p) => p.id), (businessStore.get().tenants[t]?.collections || []).map((c) => c.id));

    const wizard = (s0: Schedule | null, kind0?: 'Time-based trigger' | 'Event-driven trigger') => {
      const D0 = fresh().D;
      const EVS = evs(D0);
      d.wizard({
        title: s0 ? `Edit ${s0.n}` : kind0 === 'Event-driven trigger' ? 'Create event-driven trigger' : 'Create time-based trigger',
        steps: SCHED_STEPS,
        finishL: s0 ? 'Save' : 'Create',
        initial: schedValues(D0, EVS, s0, kind0),
        fields: (step, v) => schedFields(fresh().D, b.tn, EVS, step, v),
        validate: (step, v, set) => validateSched(fresh().D, step, v, set, EVS),
        finish: (v) => {
          const D = fresh().D;
          const rec = schedRecord(D, v);
          const isE = rec.kind === 'Event';
          if (s0) {
            setA((X) => { const x = X.scheds.find((y) => y.id === s0.id); if (x) Object.assign(x, rec); });
            d.toast(`${rec.n} saved.`);
            audit(`Changed ${isE ? 'event trigger' : 'schedule'}`, `${s0.id} · ${rec.trig} → ${nameOf(D, rec.target)}`, 'Schedules & Events');
          } else {
            const pre = isE ? 'EVT-' : 'SCH-';
            let i = D.scheds.length + 1;
            while (D.scheds.some((x) => x.id === pre + String(i).padStart(2, '0'))) i++;
            const id = pre + String(i).padStart(2, '0');
            setA((X) => { X.scheds.push({ id, ...rec, on: true, by: actor, hist: [] }); });
            d.toast(`${rec.n} created.`);
            audit(`Created ${isE ? 'event trigger' : 'schedule'}`, `${id} · ${rec.trig} → ${nameOf(D, rec.target)} · ${rec.ver}`, 'Schedules & Events');
          }
          return '';
        },
      });
    };

    const runNow = (s: Schedule) => {
      const af = agentFactoryStore.get();
      const D = af.tenants[t];
      const o = objOf(D, s.target);
      if (!o) return;
      if (o.dis) {
        d.toast(`${nameOf(D, s.target)} is disabled; the run was skipped.`);
        return;
      }
      const isW = s.target.startsWith('workflow:');
      const id = (isW ? 'w-' : '') + Math.random().toString(16).slice(2, 10);
      const pv = (o.vers as { v: string; st: string }[]).find((x) => x.st === 'Published') || o.vers[0];
      const ver = s.ver.startsWith('Pinned') ? s.ver.split(' ')[1] : pv.v;
      const q = s.inputs || s.n;
      setA((X) => {
        const base = { id, v: ver, caller: `Schedule · ${s.id}`, q, st: 'Succeeded', at: 'just now', lang: 'English' };
        if (isW) {
          const w = X.workflows.find((x) => x.id === s.target.split(':')[1])!;
          const cfg = cfgOf(w, ver);
          X.wfruns.unshift({ ...base, wf: w.id, dur: '41 s', path: Object.fromEntries((cfg?.nodes || []).filter((n) => n[1] !== 'fallback').map((n) => [n[0], 'ok' as const])) });
        } else {
          X.runs.unshift({ ...base, agent: o.id, dur: '6.0 s', reason: '', model: resolveModel(af.models, t, s.target.split(':')[1]).id, tools: [['hybrid_search', 'Succeeded', '240 ms']], evid: [], guards: [['Prompt injection', 'Passed']], answer: 'Scheduled output delivered.' });
        }
        X.scheds.find((x) => x.id === s.id)?.hist.unshift([id, 'just now', 'Succeeded']);
      });
      d.toast(`${s.n} ran now · job ${id}.`);
      audit('Ran schedule now', `${s.id} · ${nameOf(D, s.target)} · job ${id}`, 'Schedules & Events');
    };

    const toggle = (s: Schedule) => {
      setA((X) => { const x = X.scheds.find((y) => y.id === s.id); if (x) x.on = !x.on; });
      d.toast(s.n + (s.on ? ' disabled.' : ' enabled.'));
      audit(s.on ? 'Disabled schedule' : 'Enabled schedule', `${s.id} · ${s.n}`, 'Schedules & Events');
    };

    const remove = (s: Schedule) =>
      d.confirm(`Delete ${s.n}?`, 'Future runs stop. Past jobs are kept.', [], 'Delete', () => {
        setA((X) => { X.scheds = X.scheds.filter((x) => x.id !== s.id); });
        d.toast(`${s.n} deleted.`);
        audit('Deleted schedule', `${s.id} · ${s.n}`, 'Schedules & Events');
      });

    const ctx: SchedCtx = {
      ...b.c,
      go: { tab: (v) => (v === 'reports' ? go.reports() : go.schedules()), agent: go.agent, workflow: go.workflow, run: (id) => go.run(id) },
      a: { create: (k) => wizard(null, k), edit: (s) => wizard(s), runNow, toggle, remove },
    };
    return { ...ctx, ok: true as const };
  }, [b.c, b.t, b.d, b.nav, b.base, b.access]); // eslint-disable-line react-hooks/exhaustive-deps
}

export { helpers as afHelpers };

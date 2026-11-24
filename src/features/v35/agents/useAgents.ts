/**
 * Wires the AI Agent Factory builders to the session stores, the dialogs, the
 * router and the "view as" permissions. Actions mutate `agentFactoryStore`
 * the way the prototype's `setA` does and record every change in the shared
 * audit trail. Tests and evaluation runs are simulated (running → result).
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs, type FormField } from '@/engine/dialogs';
import { createStore } from '@/engine/store';
import { useAccess } from '@/v35/access';
import { recordAudit } from '@/v35/data/audit';
import { agentFactoryStore, AF_TENANT_NAME, cfgOf, draftOf, isAfTenant, pubOf, wfUsing, type AfTenant, type AfTenantKey, type Agent, type AgentCfg, type AgentFactoryData, type EvalCase } from '@/v35/data/agentFactory';
import { businessStore } from '@/v35/data/businessData';
import { ingestStore } from '@/v35/data/ingest';
import { iamStore } from '@/v35/iam';
import type { AgentsCtx, AgentsNav, CaseSeed, Focus } from './build';
import {
  activateVersion, addDraft, diffOf, fresh, gateOf, hashC, idOfKey, kindL, lastRun, MET, nameOf, nextV, objOf, pct, SAMPLES, simAgent, simEval, tenantModels, toolInv, toolKey, whyOf, wizardTools, workTools,
  type TestResult,
} from './logic';
import { addToolWizard, agentRecord, agentWizard } from './wizards';

/** View state that survives navigation between tabs (prototype afTest / afFocus / afLastCase). */
export const agentUiStore = createStore<{ tests: Record<string, TestResult>; focus: Focus | null; lastCase: AgentsCtx['lastCase'] }>(() => ({ tests: {}, focus: null, lastCase: null }));

const EMPTY: AfTenant = { thr: { acc: 0.9, cit: 0.95, ref: 0.95, uns: 0.02, num: 1, reg: -0.02, parity: 0.05 }, agents: [], workflows: [], evalsets: [], evalruns: [], runs: [], wfruns: [], scheds: [], preserved: {}, repro: [], toolDis: {} };
const ESC = ['None', 'Escalate if external figures conflict', 'Escalate to agent owner when grounding is low', 'Escalate to policy owner', 'Escalate to account owner'];

export function useAgents(): AgentsCtx & { tenant: AfTenantKey | null } {
  const scope = useScope();
  const base = useBase();
  const nav = useNavigate();
  const d = useDialogs();
  const key0 = scope.kind === 'project' ? scope.project.key : null;
  const access = useAccess(key0);
  const af = agentFactoryStore.use();
  const biz = businessStore.use();
  const ih = ingestStore.use();
  const iam = iamStore.use();
  const ui = agentUiStore.use();
  const t = isAfTenant(key0) ? key0 : null;
  const actor = access.uid;

  return React.useMemo(() => {
    const T = (t ?? 'sceai') as AfTenantKey;
    const D = t ? af.tenants[t] : EMPTY;
    const TN = t ? AF_TENANT_NAME[t] : '';
    const AF = () => agentFactoryStore.get();
    const DD = () => (t ? AF().tenants[t] : EMPTY);
    const bt = t ? biz.tenants[t] : null;
    const enc = encodeURIComponent;

    const go: AgentsNav = {
      agents: () => nav(`${base}/agents`),
      agent: (id, tab) => nav(`${base}/agents/${enc(id)}${tab && tab !== 'overview' ? `/${tab}` : ''}`),
      evalsets: () => nav(`${base}/agents/evaluation`),
      evalset: (id) => nav(`${base}/agents/evaluation/${enc(id)}`),
      workflow: (id, tab) => nav(`${base}/workflows/${enc(id)}${tab ? `/${tab}` : ''}`),
      collections: () => nav(`${base}/collections`),
      collection: (id, tab) => nav(`${base}/collections/${enc(id)}${tab ? `/${tab}` : ''}`),
      dataset: (id, tab) => nav(`${base}/structured/${enc(id)}${tab ? `/${tab}` : ''}`),
      document: (id) => nav(`${base}/unstructured/${enc(id)}`),
      entities: () => nav(`${base}/entities`),
      tools: () => nav(`${base}/tools`),
      policies: () => nav(`${base}/policies`),
      audit: () => nav(`${base}/audit`),
      run: (id) => nav(`${base}/monitoring/runs/${enc(id)}`),
      monitoring: () => nav(`${base}/monitoring`),
      playground: () => nav(`${base}/playground`),
    };
    const goKey = (key: string, tab: string) => (kindL(key) === 'agent' ? go.agent(idOfKey(key), tab) : go.workflow(idOfKey(key), tab));

    const audit = (action: string, res: string, area = 'AI Agent Factory') => recordAudit({ who: actor, action, res, tenants: [T], lvl: 'tenant', area });
    /** mutate this tenant's data (prototype setA) */
    const setA = (fn: (D: AfTenant, all: AgentFactoryData) => void, msg?: string) => {
      if (!t) return;
      agentFactoryStore.update((all) => fn(all.tenants[t], all));
      if (msg) d.toast(msg);
    };
    const updO = (key: string, fn: (o: Agent, D: AfTenant, all: AgentFactoryData) => void) => (D0: AfTenant, all: AgentFactoryData) => {
      const o = objOf(D0, key) as Agent | undefined;
      if (o) fn(o, D0, all);
    };
    const can = (perm: string, type: Parameters<typeof access.can>[1], id?: string) => access.can(perm, type, id);
    const nm = (key: string) => nameOf(DD(), key);
    const agentById = (id: string) => DD().agents.find((x) => x.id === id);

    // ---------------------------------------------------------------- lifecycle
    const createDraft = (key: string, note = '', thenTab?: string) => {
      const o = objOf(DD(), key);
      if (!o) return;
      if (draftOf(o as Agent)) {
        if (thenTab) goKey(key, thenTab);
        return;
      }
      let nv = '';
      setA(updO(key, (x) => (nv = addDraft(x, actor, note))));
      d.toast('Draft ' + nv + ' of ' + nm(key) + ' created.');
      audit('Created draft version', nm(key) + ' · ' + nv + (note ? ' · ' + note : ''));
      if (thenTab) goKey(key, thenTab);
    };
    /** publish version v; agent tool assignments follow the published version (prototype syncGrants) */
    const activate = (key: string, v: string, how: string, extra?: [string, string]) => {
      setA((D0, all) => {
        const o = objOf(D0, key) as Agent | undefined;
        if (!o) return;
        const c = o.vers.find((y) => y.v === v)?.cfg;
        if (kindL(key) === 'agent' && c?.tset) {
          all.mcp.grants[T] = all.mcp.grants[T] || {};
          all.mcp.grants[T][o.id] = c.tset.slice();
        }
        activateVersion(o, v);
      });
      d.toast(nm(key) + ' ' + v + ' is now the published version.');
      audit(how, nm(key) + ' · ' + v);
      if (extra) audit(extra[0], extra[1]);
    };
    const compare = (key: string, v1: string, v2: string) => {
      const o = objOf(DD(), key) as Agent;
      const it = diffOf(cfgOf(o, v1), cfgOf(o, v2));
      d.info('Compare ' + v1 + ' → ' + v2, it.length ? 'Configuration differences:' : 'No configuration differences.', it);
    };

    // ---------------------------------------------------------------- evaluation
    const runEval = (key: string, v: string, setId: string) => {
      const D0 = DD();
      const o = objOf(D0, key) as Agent;
      const id = 'EV-' + String(500 + D0.evalruns.length + Math.floor(Math.random() * 40)).padStart(4, '0');
      const sim = simEval(D0, key, v, setId);
      setA((D1) => {
        D1.evalruns.unshift({ id, t: key, v, set: setId, at: 'just now', by: actor, m: sim.m, failed: sim.failed, running: true, h: hashC(cfgOf(o, v)) });
      }, 'Evaluation ' + id + ' started on ' + v + '.');
      audit('Started evaluation', nm(key) + ' · ' + v + ' · ' + setId + ' · ' + id, 'Agent Evaluation');
      window.setTimeout(() => {
        let ok = false;
        let found = false;
        setA((D1) => {
          const r = D1.evalruns.find((x) => x.id === id);
          if (!r) return;
          found = true;
          delete r.running;
          ok = gateOf(D1, key, r).ok;
        });
        if (!found) return;
        d.toast(id + ' finished · gate ' + (ok ? 'passed' : 'failed') + '.');
        audit('Completed evaluation', nm(key) + ' · ' + v + ' · ' + id + ' · gate ' + (ok ? 'passed' : 'failed'), 'Agent Evaluation');
      }, 1500);
    };
    const publish = (key: string) => {
      const D0 = DD();
      const o = objOf(D0, key) as Agent;
      const dv = draftOf(o);
      if (!dv) return;
      const r = lastRun(D0, key, dv.v);
      if (!r || r.running) {
        toast('Run the evaluation on ' + dv.v + ' first.');
        return;
      }
      if (!fresh(D0, key, r)) {
        d.confirm('Evaluate the changed draft', 'The configuration of ' + dv.v + ' changed after ' + r.id + '. Evaluate the draft again before publishing.', [], 'Run evaluation', () => runEval(key, dv.v, r.set));
        return;
      }
      const g = gateOf(D0, key, r);
      const rl = (k: string, x: number) => (k === 'reg' || k === 'parity' ? String(x) : pct(x));
      if (!g.ok) {
        d.info('Evaluation gate failed for ' + dv.v, 'The draft cannot be published until every metric meets its threshold:', g.res.filter((x) => !x[4]).map((x) => ({ a: x[1], b: 'Result ' + rl(x[0], x[2]), c: 'Threshold ' + rl(x[0], x[3]) })));
        return;
      }
      const pv = pubOf(o);
      const dif = pv ? diffOf(cfgOf(o, pv.v), dv.cfg) : [];
      d.confirm(
        'Publish ' + nm(key) + ' ' + dv.v + '?',
        'Evaluation ' + r.id + ' passed the gate. ' + (pv ? pv.v + ' becomes superseded and stays available for rollback.' : 'This is the first published version.') + (dif.length ? ' Changes:' : ''),
        dif.slice(0, 8),
        'Publish',
        () => activate(key, dv.v, 'Published version', ['Published version', nm(key) + ' ' + dv.v + ' · ' + r.id]),
      );
    };

    // ---------------------------------------------------------------- tools
    const assignTool = (aId: string, tkey: string, add: boolean) => {
      const o = agentById(aId);
      if (!o) return;
      const had = !!draftOf(o);
      const nv = had ? draftOf(o)!.v : nextV(o);
      setA(
        updO('agent:' + aId, (x, _D, all) => {
          let dv = x.vers.find((v) => v.st === 'Draft');
          if (!dv) {
            const b0 = pubOf(x) || x.vers[0];
            dv = { v: nv, st: 'Draft', at: 'just now', by: actor, note: (add ? 'Add tool ' : 'Remove tool ') + tkey.split(':').pop(), cfg: structuredClone(b0.cfg || cfgOf(x)) };
            x.vers.unshift(dv);
          }
          const cur = (dv.cfg!.tset || (all.mcp.grants[T] || {})[aId] || []).map(toolKey);
          dv.cfg!.tset = add ? [...new Set(cur.concat([tkey]))] : cur.filter((y) => y !== tkey);
        }),
        tkey.split(':').pop() + (add ? ' added to ' : ' removed from ') + aId + ' · draft ' + nv + (had ? '' : ' created') + '. It takes effect when the draft is published.',
      );
      audit(add ? 'Assigned tool in draft' : 'Removed tool in draft', aId + ' ' + nv + ' · ' + tkey);
    };

    // ---------------------------------------------------------------- test cases
    const caseFromRun = (p: CaseSeed) => {
      const D0 = DD();
      const key = p.key;
      const o = key ? objOf(D0, key) : null;
      const sets = D0.evalsets.filter((s0) => !o || (o.evSets || []).includes(s0.id));
      const opts = (sets.length ? sets : D0.evalsets).map((s0) => s0.id + ' · ' + s0.n);
      const nf = /not found|no official/i.test(p.cat || '');
      d.form(
        'Create evaluation test case',
        [
          { type: 'kv', label: 'From execution', rows: [['Run', p.run || '—'], ['Agent or workflow', key ? nm(key) : '—']] },
          { k: 'q', label: 'Input request', type: 'text', val: p.q },
          { k: 'tgt', label: 'Affected agent or workflow', type: 'select', opts: D0.agents.map((a) => 'agent:' + a.id).concat(D0.workflows.map((w) => 'workflow:' + w.id)), val: key },
          { k: 'kind', label: 'Expected behaviour', type: 'select', opts: ['Correct answer', 'Refusal'], val: nf ? 'Refusal' : 'Correct answer' },
          { k: 'exp', label: 'Expected answer or refusal reason', type: 'text', val: p.exp || (nf ? 'States that no official data is available and names the closest indicator' : 'Answers from official sources with citations'), ph: 'e.g. Says no official data is available and names the closest indicator' },
          { k: 'evid', label: 'Expected evidence', type: 'text', val: p.evid || '', ph: 'Dataset, document or "None"' },
          { k: 'lang', label: 'Language', type: 'select', opts: ['English', 'Arabic'], val: p.lang || 'English' },
          { k: 'cat', label: 'Failure category', type: 'text', val: p.cat || '' },
          { k: 'set', label: 'Evaluation dataset', type: 'select', opts, val: opts[0] },
        ],
        'Save test case',
        (v) => {
          if (!(v.q || '').trim()) return 'Enter the input request.';
          if (!(v.exp || '').trim()) return 'Describe the expected answer or refusal.';
          if (!v.set) return 'Create an evaluation dataset first.';
          const sid = v.set.split(' · ')[0];
          const cid = 'TC-' + (700 + DD().evalsets.reduce((n0, s0) => n0 + s0.cases.length, 0) + Math.floor(Math.random() * 50));
          const tk: string = v.tgt;
          setA((D1) => {
            D1.evalsets.find((s0) => s0.id === sid)!.cases.push({ id: cid, q: v.q.trim(), exp: v.exp.trim(), refuse: v.kind === 'Refusal', evid: (v.evid || '').trim() || 'None', lang: v.lang, cat: (v.cat || '').trim(), src: p.run || '' });
            const o2 = objOf(D1, tk);
            if (o2 && !(o2.evSets || []).includes(sid)) o2.evSets = (o2.evSets || []).concat([sid]);
          }, 'Test case ' + cid + ' added to ' + sid + '.');
          audit('Created evaluation test case', cid + ' · ' + sid + ' · from ' + (p.run || 'test') + ' · ' + nm(tk), 'Agent Evaluation');
          agentUiStore.update((s) => {
            s.lastCase = { cid, sid, tk };
          });
          goKey(tk, 'eval');
          return '';
        },
      );
    };
    const editCase = (setId: string, c0: EvalCase | null) =>
      d.form(
        c0 ? 'Edit ' + c0.id : 'Add test case',
        [
          { k: 'q', label: 'Input question', type: 'text', val: c0 ? c0.q : '' },
          { k: 'kind', label: 'Expected behaviour', type: 'select', opts: ['Correct answer', 'Refusal'], val: c0 && c0.refuse ? 'Refusal' : 'Correct answer' },
          { k: 'exp', label: 'Expected answer or refusal reason', type: 'text', val: c0 ? c0.exp : '' },
          { k: 'evid', label: 'Expected evidence', type: 'text', val: c0 ? c0.evid : '' },
          { k: 'lang', label: 'Language', type: 'select', opts: ['English', 'Arabic'], val: c0 ? c0.lang : 'English' },
          { k: 'cat', label: 'Category', type: 'text', val: c0 ? c0.cat : '' },
        ],
        'Save',
        (v) => {
          if (!(v.q || '').trim()) return 'Enter the question.';
          if (v.kind === 'Correct answer' && !(v.exp || '').trim()) return 'Describe the expected answer.';
          const rec = { q: v.q.trim(), exp: (v.exp || '').trim(), refuse: v.kind === 'Refusal', evid: (v.evid || '').trim() || 'None', lang: v.lang, cat: (v.cat || '').trim() };
          if (c0) {
            setA((D1) => {
              Object.assign(D1.evalsets.find((x) => x.id === setId)!.cases.find((x) => x.id === c0.id)!, rec);
            }, c0.id + ' saved.');
            audit('Changed evaluation test case', setId + ' · ' + c0.id, 'Agent Evaluation');
          } else {
            const s0 = DD().evalsets.find((x) => x.id === setId)!;
            const id = 'TC-' + (800 + s0.cases.length + Math.floor(Math.random() * 90));
            setA((D1) => {
              D1.evalsets.find((x) => x.id === setId)!.cases.push({ id, ...rec, src: '' });
            }, id + ' added.');
            audit('Added evaluation test case', setId + ' · ' + id, 'Agent Evaluation');
          }
          return '';
        },
      );

    // ---------------------------------------------------------------- tests
    const startTest = (key: string, ver: string, q: string) => {
      const id = idOfKey(key);
      const r = simAgent(AF(), DD(), T, id, ver, q, biz.agColl[id] || []);
      agentUiStore.update((s) => {
        s.tests[key] = { ...r, running: true };
      });
      audit('Ran test', nm(key) + ' · ' + ver + ' · ' + r.id);
      window.setTimeout(() => {
        agentUiStore.update((s) => {
          const cur = s.tests[key];
          if (cur && cur.id === r.id) cur.running = false;
        });
      }, 900);
    };

    const a: AgentsCtx['a'] = {
      create: () => {
        const A0 = AF();
        d.wizard(
          agentWizard(
            { models: tenantModels(A0, T, true), colls: (bt?.collections || []).map((c) => c.id), ontoTypes: (bt?.onto.types || []).map((x) => x.n), tools: wizardTools(A0, T), ids: DD().agents.map((x) => x.id) },
            (v) => {
              const rec = agentRecord(v, actor);
              setA((D1, all) => {
                D1.agents.push(rec);
                all.mcp.grants[T] = all.mcp.grants[T] || {};
                all.mcp.grants[T][rec.id] = (v.tools || []).slice();
              });
              businessStore.update((b) => {
                b.agColl[rec.id] = v.colls || [];
              });
              d.toast('Agent ' + rec.id + ' created as draft v1.');
              audit('Created agent', rec.id + ' · draft v1 · ' + rec.vers[0].cfg!.model + ' · tools ' + (v.tools || []).length + ' · collections ' + ((v.colls || []).join(', ') || 'none'));
              go.agent(rec.id, 'testing');
              return '';
            },
          ),
        );
      },
      createDraft,
      archive: (ag) => {
        const ws = wfUsing(DD(), ag.id);
        if (ws.length) {
          d.info('Archive ' + ag.id + '?', 'Remove it from these workflows first:', ws.map((w) => ({ a: w.n, b: 'Workflow', c: '' })));
          return;
        }
        d.confirm('Archive ' + ag.id + '?', 'Archived agents cannot run and are hidden from new workflows. Versions stay available.', [], 'Archive', () => {
          setA(updO('agent:' + ag.id, (x) => (x.st = 'Archived')), ag.id + ' archived.');
          audit('Archived agent', ag.id);
        });
      },
      disable: (key) => {
        const D0 = DD();
        const label = nm(key);
        const ws = wfUsing(D0, idOfKey(key));
        const impact = 'All executions of this agent stop, including inside workflows: ' + (ws.map((w) => w.n).join(', ') || 'none') + '. Schedules targeting it are skipped.';
        const aff: [string, string][] = ws.map((w) => ['Workflow', w.n] as [string, string]).concat(D0.scheds.filter((x) => x.on && x.target === key).map((x) => ['Schedule', x.n + ' · ' + x.trig] as [string, string])).concat([['Callers', 'Chat and API requests to ' + label]]);
        d.form(
          'Emergency disable · ' + label,
          ([{ type: 'note', tone: 'bad', label: 'Takes effect immediately', text: 'Emergency disablement takes effect at once, without a new version. ' + impact }] as FormField[])
            .concat(aff.length ? [{ type: 'kv', label: 'Potentially affected', rows: aff }] : [])
            .concat([
              { k: 'reason', label: 'Reason', type: 'text', ph: 'e.g. Unsafe answers observed in job b1c94f08' },
              { k: 'ack', label: 'Confirmation', type: 'select', opts: ['Select', 'Disable ' + label + ' now'], val: 'Select' },
            ]),
          'Disable now',
          (v) => {
            if ((v.reason || '').trim().length < 8) return 'Enter the reason (at least 8 characters).';
            if (v.ack === 'Select') return 'Confirm the disablement.';
            const ref = 'AUD-' + String(Date.now()).slice(-6);
            const dis = { by: actor, at: 'just now', reason: v.reason.trim(), ref };
            setA(updO(key, (x) => (x.dis = dis)), label + ' disabled immediately · audit ' + ref + '.');
            audit('Emergency disabled', label + ' · ' + dis.reason + ' · ' + ref, 'AI Governance');
            return '';
          },
        );
      },
      reenable: (key) =>
        d.form('Re-enable ' + nm(key), [{ k: 'reason', label: 'Reason', type: 'text', ph: 'e.g. Fix verified in EV-0512' }], 'Re-enable', (v) => {
          if ((v.reason || '').trim().length < 8) return 'Enter the reason (at least 8 characters).';
          setA(updO(key, (x) => (x.dis = null)), nm(key) + ' re-enabled.');
          audit('Re-enabled after emergency disable', nm(key) + ' · ' + v.reason.trim(), 'AI Governance');
          return '';
        }),
      editCfg: (key, ver, lbl, k, typ, opts) => {
        const o = objOf(DD(), key) as Agent;
        const cfg = o.vers.find((y) => y.v === ver)!.cfg! as unknown as Record<string, unknown>;
        const cur = cfg[k];
        const f: FormField =
          typ === 'chips' ? { k: 'v', label: lbl, type: 'chips', opts: opts || [], val: Array.isArray(cur) ? (cur as string[]).slice() : [] }
          : typ === 'select' ? { k: 'v', label: lbl, type: 'select', opts: opts || [], val: String(cur) }
          : typ === 'textarea' ? { k: 'v', label: lbl, type: 'textarea', val: String(cur ?? ''), rows: 5 }
          : { k: 'v', label: lbl, type: 'text', val: String(cur ?? '') };
        d.form(lbl + ' · ' + ver, [f], 'Save', (v) => {
          const val = typ === 'chips' ? v.v : k === 'tools' ? +v.v : v.v;
          if (JSON.stringify(val) === JSON.stringify(cur)) return 'No change.';
          setA(updO(key, (x) => ((x.vers.find((y) => y.v === ver)!.cfg as unknown as Record<string, unknown>)[k] = val)), lbl + ' saved in ' + ver + '.');
          audit('Changed draft configuration', idOfKey(key) + ' ' + ver + ' · ' + lbl);
          return '';
        });
      },
      editGov: (key, ver) => {
        const o = objOf(DD(), key) as Agent;
        const gv = o.vers.find((y) => y.v === ver)!.cfg!.gov || { tier: 'Informational', esc: 'None' };
        d.form(
          'Governance & oversight · ' + ver,
          [
            { k: 'tier', label: 'Impact tier', type: 'select', opts: ['Informational', 'Decision support', 'High impact'], val: gv.tier, hint: 'High impact: consequential business decisions must be reviewed by a person in the consuming application.' },
            { k: 'esc', label: 'Escalation policy', type: 'select', opts: ESC, val: gv.esc },
          ],
          'Save',
          (v) => {
            if (v.tier === gv.tier && v.esc === gv.esc) return 'No change.';
            setA(updO(key, (x) => (x.vers.find((y) => y.v === ver)!.cfg!.gov = { tier: v.tier, esc: v.esc })), 'Governance & oversight saved in ' + ver + '.');
            audit('Changed draft configuration', idOfKey(key) + ' ' + ver + ' · impact tier ' + v.tier + ' · ' + v.esc);
            return '';
          },
        );
      },
      editEnt: (ag) => {
        const o = agentById(ag.id)!;
        const dv = draftOf(o);
        const pv = pubOf(o);
        const ae = (dv || pv || o.vers[0]).cfg?.ent || { mode: 'Off', hops: '—', types: [] };
        const tyN = (bt?.onto.types || []).map((x) => x.n);
        d.form(
          'Business Entities · ' + (dv ? dv.v : nextV(o)),
          [
            { k: 'mode', label: 'Entity context', type: 'select', opts: ['Off', 'Entities only', 'Entities and relationships'], val: ae.mode },
            { k: 'types', label: 'Allowed entity types', type: 'chips', opts: tyN, val: (ae.types || []).slice(), hint: 'Defines the business meaning available to the agent. Data access still depends on the caller and on the tools assigned below.' },
            { k: 'hops', label: 'Relationship depth', type: 'select', opts: ['1 hop', '2 hops'], val: ae.hops === '2 hops' ? '2 hops' : '1 hop', hint: 'Used only with Entities and relationships.' },
          ],
          'Save',
          (v) => {
            if (v.mode !== 'Off' && !(v.types || []).length) return 'Select at least one entity type.';
            const nv = { mode: v.mode, hops: v.mode === 'Entities and relationships' ? v.hops : '—', types: v.mode === 'Off' ? [] : tyN.filter((x) => (v.types || []).includes(x)) };
            if (JSON.stringify(nv) === JSON.stringify(ae)) return 'No change.';
            const had = !!dv;
            const nvV = had ? dv!.v : nextV(o);
            setA(
              updO('agent:' + ag.id, (x) => {
                let d0 = x.vers.find((y) => y.st === 'Draft');
                if (!d0) {
                  const b0 = pubOf(x) || x.vers[0];
                  d0 = { v: nvV, st: 'Draft', at: 'just now', by: actor, note: 'Business Entities context', cfg: structuredClone(b0.cfg as AgentCfg) };
                  x.vers.unshift(d0);
                }
                d0.cfg!.ent = nv;
              }),
              'Business Entities context saved in ' + nvV + (had ? '' : ' (draft created)') + '.',
            );
            audit('Changed draft configuration', ag.id + ' ' + nvV + ' · entity context ' + nv.mode + (nv.types.length ? ' · ' + nv.types.join(', ') : ''));
            return '';
          },
        );
      },
      addTool: (ag) => {
        const A0 = AF();
        const inv = toolInv(A0, DD(), T, TN).filter((x) => !workTools(A0, DD(), T, ag.id).includes(x.key));
        d.wizard(addToolWizard(ag.id, inv, (x) => assignTool(ag.id, x.key, true)));
      },
      assignTool,
      runTest: (key) => {
        const o = objOf(DD(), key) as Agent;
        const dv = draftOf(o);
        const pv = pubOf(o);
        const cur = dv || pv || o.vers[0];
        const S = SAMPLES[T];
        d.form(
          'Run test · ' + nm(key),
          [
            { k: 'ver', label: 'Version', type: 'select', opts: o.vers.filter((v) => v.st === 'Draft' || v.st === 'Published').map((v) => v.v + ' · ' + v.st), val: cur.v + ' · ' + cur.st },
            { k: 'sample', label: 'Sample request', type: 'select', opts: ['Write my own'].concat(S), val: S[0] },
            { k: 'q', label: 'Or your own request', type: 'text', ph: 'Type a request to test' },
          ],
          'Run test',
          (v) => {
            const q = (v.q || '').trim() || (v.sample !== 'Write my own' ? v.sample : '');
            if (!q) return 'Enter a request or choose a sample.';
            if (!v.ver) return 'This agent has no draft or published version to test.';
            startTest(key, v.ver.split(' · ')[0], q);
            return '';
          },
        );
      },
      caseFromRun,
      runEvalForm: (key) => {
        const D0 = DD();
        const o = objOf(D0, key) as Agent;
        const cur = draftOf(o) || pubOf(o) || o.vers[0];
        const sets = D0.evalsets.filter((s0) => (o.evSets || []).includes(s0.id));
        const so = (sets.length ? sets : D0.evalsets).map((s0) => s0.id + ' · ' + s0.n);
        d.form(
          'Run evaluation · ' + nm(key),
          [
            { k: 'v', label: 'Version', type: 'select', opts: o.vers.filter((v) => v.st !== 'Archived').map((v) => v.v + ' · ' + v.st), val: cur.v + ' · ' + cur.st },
            { k: 's', label: 'Evaluation dataset', type: 'select', opts: so, val: so[0] },
          ],
          'Run',
          (v) => {
            if (!v.s) return 'Create an evaluation dataset first.';
            runEval(key, v.v.split(' · ')[0], v.s.split(' · ')[0]);
            return '';
          },
        );
      },
      runEval,
      thresholds: (key) => {
        const D0 = DD();
        const o = objOf(D0, key) as Agent;
        const th = { ...D0.thr, ...(o.thr || {}) };
        d.form(
          'Thresholds · ' + nm(key),
          MET.map(([k, l, d0]) => ({ k, label: l + (d0 === 'max' ? ' (maximum)' : ' (minimum)'), type: 'text' as const, val: String(th[k]), hint: k === 'reg' ? 'Change in accuracy against the active version, e.g. -0.02' : k === 'parity' ? 'Largest allowed accuracy gap between languages' : 'Between 0 and 1' })),
          'Save',
          (v) => {
            const n0: Record<string, number> = {};
            for (const [k] of MET) {
              const x = parseFloat(v[k]);
              if (isNaN(x) || x < -1 || x > 1) return 'Enter numbers between -1 and 1.';
              if (x !== D0.thr[k]) n0[k] = x;
            }
            setA(updO(key, (x) => (x.thr = n0)), 'Thresholds for ' + nm(key) + ' saved.');
            audit('Changed evaluation thresholds', nm(key) + ' · ' + (Object.entries(n0).map(([k, x]) => k + ' ' + x).join(', ') || 'tenant defaults'), 'Agent Evaluation');
            return '';
          },
        );
      },
      datasets: (key) => {
        const D0 = DD();
        const o = objOf(D0, key) as Agent;
        d.form('Evaluation datasets · ' + nm(key), [{ k: 'v', label: 'Datasets', type: 'chips', opts: D0.evalsets.map((s0) => s0.id), val: (o.evSets || []).slice() }], 'Save', (v) => {
          setA(updO(key, (x) => (x.evSets = v.v || [])), 'Evaluation datasets saved.');
          audit('Changed evaluation datasets', nm(key) + ' · ' + ((v.v || []).join(', ') || 'none'), 'Agent Evaluation');
          return '';
        });
      },
      publish,
      rollback: (key, v) => {
        const pv = pubOf(objOf(DD(), key) as Agent);
        d.confirm('Roll back ' + nm(key) + ' to ' + v + '?', 'Restores a previously published version immediately. ' + (pv ? pv.v + ' becomes superseded and stays available.' : ''), [], 'Roll back', () => activate(key, v, 'Rolled back to version'));
      },
      compare,
      compareForm: (key) => {
        const o = objOf(DD(), key) as Agent;
        const pv = pubOf(o);
        const dv = draftOf(o);
        const vs = o.vers.map((v) => v.v);
        d.form(
          'Compare versions',
          [
            { k: 'a', label: 'From', type: 'select', opts: vs, val: (pv || o.vers[1] || o.vers[0]).v },
            { k: 'b', label: 'To', type: 'select', opts: vs, val: (dv || o.vers[0]).v },
          ],
          'Compare',
          (v) => {
            if (v.a === v.b) return 'Choose two different versions.';
            window.setTimeout(() => compare(key, v.a, v.b), 0);
            return '';
          },
        );
      },
      openSetting: (key, cid) => {
        agentUiStore.update((s) => {
          s.focus = { key, k: whyOf(key, cid)[2], cid };
        });
        goKey(key, 'config');
      },
      backToEval: (key) => {
        agentUiStore.update((s) => {
          s.focus = null;
        });
        goKey(key, 'eval');
      },
      dismissFocus: () =>
        agentUiStore.update((s) => {
          s.focus = null;
        }),
      createSet: () =>
        d.form('Create evaluation dataset', [{ k: 'n', label: 'Name', type: 'text' }, { k: 'd', label: 'Description', type: 'text' }], 'Create', (v) => {
          if (!(v.n || '').trim()) return 'Enter a name.';
          const id = 'ES-' + v.n.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6);
          if (DD().evalsets.some((s0) => s0.id === id)) return 'A dataset with a similar name exists.';
          setA((D1) => {
            D1.evalsets.push({ id, n: v.n.trim(), d: (v.d || '').trim(), by: actor, cases: [] });
          }, 'Dataset ' + id + ' created.');
          audit('Created evaluation dataset', id + ' · ' + v.n.trim(), 'Agent Evaluation');
          return '';
        }),
      editCase,
      removeCase: (setId, c0) =>
        d.confirm('Remove ' + c0.id + '?', 'Future evaluations no longer use it. Past results keep it.', [], 'Remove', () => {
          setA((D1) => {
            const x = D1.evalsets.find((y) => y.id === setId)!;
            x.cases = x.cases.filter((y) => y.id !== c0.id);
          }, c0.id + ' removed.');
          audit('Removed evaluation test case', setId + ' · ' + c0.id, 'Agent Evaluation');
        }),
    };

    return {
      tenant: t,
      t: T,
      TN,
      af,
      D,
      agColl: biz.agColl,
      biz: {
        collections: bt?.collections || [],
        ontoTypes: (bt?.onto.types || []).map((x) => x.n),
        inst: bt?.inst || [],
        documents: bt?.documents || [],
        policies: iam.policies,
        pipelines: (t ? ih[t].pipelines : []).map((p) => ({ id: p.id, entTypes: p.v.entTypes || [] })),
      },
      can,
      tests: ui.tests,
      focus: ui.focus,
      lastCase: ui.lastCase,
      go,
      a,
    };
  }, [t, af, biz, ih, iam, ui, access, actor, base, nav, d]);
}

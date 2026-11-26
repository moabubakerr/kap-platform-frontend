/**
 * Wires the Agent Workflows builders to the session store, dialogs, router,
 * audit trail and "view as" permissions. Workflows, evaluation datasets and
 * runs live in the AI Agent Factory store (`agentFactory.ts`); actions mutate it
 * the way the prototype's `setA` does. Evaluations and test runs are simulated.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs, type FormField } from '@/engine/dialogs';
import { useAccess } from '@/v35/access';
import { AF_TENANT_NAME, agentFactoryStore, isAfTenant, type AfTenant } from '@/v35/data/agentFactory';
import { recordAudit } from '@/v35/data/audit';
import { businessStore } from '@/v35/data/businessData';
import { EMPTY_TENANT, wfView, type WfTenant, type WfTenantKey, type Workflow } from './types';
import { blankG, clone, diffOf, fromTemplate, PATS, simWf, wfCheck, wfDerive, type WfCfg } from './model';
import { previewDgm } from './canvas';
import type { CaseSeed, WfCtx } from './build';
import {
  agentOf, agentOk, cfgOf, draftOf, fresh, gateOf, hashC, lastRun, MET, nextV, pct, pubOf, simAgent, simEval, wfKey,
} from './logic';
import { uiKey, uiStore, type Wd } from './state';
import { useLiveLoad, type Live } from '@/v35/live';
import { useAgentsLive } from '@/features/v35/agents/live';
import { loadWorkflows, startLiveTest, startWfSync, wfLiveStore } from './wfLive';

const EMPTY = EMPTY_TENANT;

export type WfHub = WfCtx & {
  /** save the designer's working copy into the draft version */
  saveDesign: (w: Workflow, v: string, cfg: WfCfg, errors: number) => void;
  /** start a simulated test run of a version (or of the unsaved working copy) */
  startTest: (w: Workflow, v: string, q: string, cfgO?: WfCfg | null) => void;
  /** select the version open in the designer */
  setVer: (w: Workflow, v: string) => void;
  /** change the designer's working copy */
  putWd: (w: Workflow, x: Wd | null) => void;
  /** the working copy of version `v` (created from the stored version when needed) */
  wdOf: (w: Workflow, v: string) => Wd;
  /** live tenant: workflows and runs from the platform API (null for sample tenants) */
  live: (Live & { missing: boolean }) | null;
};

export function useWorkflows(): WfHub {
  const scope = useScope();
  const base = useBase();
  const nav = useNavigate();
  const d = useDialogs();
  const key0 = scope.kind === 'project' ? scope.project.key : null;
  const access = useAccess(key0);
  const af = agentFactoryStore.use();
  const agColl = businessStore.use().agColl;
  const ui = uiStore.use();
  const t: WfTenantKey | null = isAfTenant(key0) ? key0 : null;
  const D = React.useMemo(() => (t ? wfView(af, agColl, t) : EMPTY), [af, agColl, t]);
  const actor = access.uid;
  // live tenant: KAP agents (for the agent steps) and the platform's workflows and runs
  useAgentsLive(key0);
  const wfLoad = useLiveLoad('workflows', key0, (tid) => loadWorkflows(tid, t as WfTenantKey));
  const wfAll = wfLiveStore.use();
  const wfMissing = !!(t && wfAll[t]?.missing);
  const liveTid = wfLoad.on && t ? wfLoad.tenantId : null;
  React.useEffect(() => {
    if (liveTid && t) startWfSync(liveTid, t);
  }, [liveTid, t]);

  const canUpd = access.can('agent:update', 'agent', '*');
  const canAppr = access.can('agent:oversee', 'agent', '*');
  const canOps = canAppr || access.can('tenant:configure', 'tenant', '*');
  const canCreate = access.can('agent:create', 'agent', '*');
  const canExec = access.can('agent:execute', 'agent', '*') || canUpd;
  const can = access.can;

  return React.useMemo(() => {
    const tn = t ? AF_TENANT_NAME[t] : '';
    const fresh0 = (): WfTenant => (t ? wfView(agentFactoryStore.get(), businessStore.get().agColl, t) : EMPTY);
    const setD = (fn: (h: AfTenant) => void) => { if (t) agentFactoryStore.update((s) => fn(s.tenants[t])); };
    const updW = (id: string, fn: (w: Workflow, h: AfTenant) => void) => setD((h) => { const w = h.workflows.find((x) => x.id === id); if (w) fn(w, h); });
    const ev = (action: string, res: string, area = 'AI Agent Factory') => { if (t) recordAudit({ who: actor, action, res, tenants: [t], lvl: 'tenant', area }); };
    const k = (id: string) => uiKey(t || '', id);
    const wOf = (id: string) => fresh0().workflows.find((x) => x.id === id);

    const go: WfCtx['go'] = {
      list: () => nav(`${base}/workflows`),
      wf: (id, tab) => nav(`${base}/workflows/${encodeURIComponent(id)}${tab && tab !== 'overview' ? `/${tab}` : ''}`),
      map: () => nav(`${base}/workflows/map`),
      pipeline: () => nav(`${base}/workflows/ask-ai-pipeline`),
      agent: (id) => nav(`${base}/agents/${encodeURIComponent(id)}`),
      evalset: (id) => nav(`${base}/agents/evaluation/${encodeURIComponent(id)}`),
      evalsets: () => nav(`${base}/agents/evaluation`),
      run: (id) => {
        const wr = liveTid ? fresh0().wfruns.find((r) => r.id === id) : undefined;
        nav(wr ? `${base}/workflows/${encodeURIComponent(wr.wf)}/runs/${encodeURIComponent(id)}` : `${base}/monitoring/runs/${encodeURIComponent(id)}`);
      },
      audit: () => nav(`${base}/audit`),
    };

    // ---------------------------------------------------------------- designer working copy
    const wdOf = (w: Workflow, v: string): Wd => {
      const x = uiStore.get().wd[k(w.id)];
      return x && x.v === v ? x : { v, cfg: clone(cfgOf(w, v)), hist: [], fut: [], dirty: false, sel: null, mode: x ? x.mode : 'design', zoom: x ? x.zoom : 0, conn: null, showI: false, rp: null, tools: x?.tools };
    };
    const putWd = (w: Workflow, x: Wd | null) => uiStore.update((s) => { s.wd[k(w.id)] = x; });
    const setVer = (w: Workflow, v: string) => uiStore.update((s) => { s.ver[k(w.id)] = v; });

    // ---------------------------------------------------------------- lifecycle
    const nameV = (w: Workflow, v: string) => w.n + ' · ' + v;
    const createDraft = (w: Workflow, note = '', open = false) => {
      const cur = wOf(w.id) || w;
      const dv = draftOf(cur);
      if (dv) { if (open) setVer(w, dv.v); return; }
      const nv = nextV(cur);
      const b0 = pubOf(cur) || cur.vers[0];
      updW(w.id, (x) => {
        x.vers.unshift({ v: nv, st: 'Draft', at: 'just now', by: actor, note, cfg: clone(b0.cfg || cfgOf(x)) });
      });
      if (open) setVer(w, nv);
      d.toast('Draft ' + nv + ' of ' + w.n + ' created.');
      ev('Created draft version', nameV(w, nv) + (note ? ' · ' + note : ''));
    };
    const activate = (w: Workflow, v: string, how: string, res?: string) => {
      updW(w.id, (o) => {
        o.vers.forEach((x) => { if (x.st === 'Published') x.st = 'Superseded'; });
        const x = o.vers.find((y) => y.v === v);
        if (x) { x.st = 'Published'; x.at = 'just now'; }
      });
      d.toast(w.n + ' ' + v + ' is now the published version.');
      ev(how, res || nameV(w, v));
    };

    const runEval = (w: Workflow, v: string, setId: string) => {
      const D0 = fresh0();
      const o = D0.workflows.find((x) => x.id === w.id) || w;
      const id = 'EV-' + String(500 + D0.evalruns.length + Math.floor(Math.random() * 40)).padStart(4, '0');
      const sim = simEval(D0, o, v, setId);
      setD((h) => { h.evalruns.unshift({ id, t: wfKey(w.id), v, set: setId, at: 'just now', by: actor, m: sim.m, failed: sim.failed, running: true, h: hashC(cfgOf(o, v)) }); });
      d.toast('Evaluation ' + id + ' started on ' + v + '.');
      ev('Started evaluation', nameV(w, v) + ' · ' + setId + ' · ' + id, 'Agent Evaluation');
      window.setTimeout(() => {
        setD((h) => { const r = h.evalruns.find((x) => x.id === id); if (r) delete r.running; });
        const D1 = fresh0();
        const r = D1.evalruns.find((x) => x.id === id);
        const o1 = D1.workflows.find((x) => x.id === w.id);
        if (!r || !o1) return;
        const ok = gateOf(D1, o1, r).ok;
        d.toast(id + ' finished · gate ' + (ok ? 'passed' : 'failed') + '.');
        ev('Completed evaluation', nameV(w, v) + ' · ' + id + ' · gate ' + (ok ? 'passed' : 'failed'), 'Agent Evaluation');
      }, 1500);
    };

    const openDesigner = (w: Workflow, v: string, extra?: Partial<Wd>) => {
      setVer(w, v);
      const x = wdOf(wOf(w.id) || w, v);
      putWd(w, { ...x, ...extra });
      go.wf(w.id, 'designer');
    };

    const publish = (w0: Workflow) => {
      const D0 = fresh0();
      const w = D0.workflows.find((x) => x.id === w0.id) || w0;
      const dv = draftOf(w);
      if (!dv) return;
      if (dv.cfg && dv.cfg.nodes) {
        const iss = wfCheck(dv.cfg, agentOk(D0, tn)).filter((q) => q.sev === 'error');
        if (iss.length) {
          d.confirm('Resolve the issues in draft ' + dv.v, 'These must be fixed in the designer before the draft can be submitted:', iss.map((q) => ({ a: q.m, b: '', c: '' })), 'Open designer', () => openDesigner(w, dv.v, { showI: true, mode: 'design' }));
          return;
        }
      }
      if (liveTid) {
        // live: no evaluation gate for workflows yet; the platform runs whatever version is published
        const pv0 = pubOf(w);
        const dif0 = pv0 ? diffOf(cfgOf(w, pv0.v), dv.cfg) : [];
        d.confirm('Publish ' + w.n + ' ' + dv.v + '?', 'Calls to the workflow will run ' + dv.v + ' from now on. ' + (pv0 ? pv0.v + ' becomes superseded and stays available for rollback. ' : '') + 'Test it in the designer first: evaluations of workflows are not available yet.' + (dif0.length ? ' Changes:' : ''), dif0.slice(0, 8), 'Publish', () => activate(w, dv.v, 'Published version'));
        return;
      }
      const r = lastRun(D0, wfKey(w.id), dv.v);
      if (!r || r.running) { toast('Run the evaluation on ' + dv.v + ' first.'); return; }
      if (!fresh(w, r)) { d.confirm('Evaluate the changed draft', 'The configuration of ' + dv.v + ' changed after ' + r.id + '. Evaluate the draft again before publishing.', [], 'Run evaluation', () => runEval(w, dv.v, r.set)); return; }
      const g = gateOf(D0, w, r);
      if (!g.ok) {
        d.info('Evaluation gate failed for ' + dv.v, 'The draft cannot be published until every metric meets its threshold:', g.res.filter((x) => !x[4]).map((x) => ({ a: x[1], b: 'Result ' + (x[0] === 'reg' || x[0] === 'parity' ? x[2] : pct(x[2])), c: 'Threshold ' + (x[0] === 'reg' || x[0] === 'parity' ? x[3] : pct(x[3])) })));
        return;
      }
      const pv = pubOf(w);
      const dif = pv ? diffOf(cfgOf(w, pv.v), dv.cfg) : [];
      d.confirm('Publish ' + w.n + ' ' + dv.v + '?', 'Evaluation ' + r.id + ' passed the gate. ' + (pv ? pv.v + ' becomes superseded and stays available for rollback.' : 'This is the first published version.') + (dif.length ? ' Changes:' : ''), dif.slice(0, 8), 'Publish', () => activate(w, dv.v, 'Published version', w.n + ' ' + dv.v + ' · ' + r.id));
    };

    const compare = (w0: Workflow, v1: string, v2: string) => {
      const w = wOf(w0.id) || w0;
      const it = diffOf(cfgOf(w, v1), cfgOf(w, v2));
      d.info('Compare ' + v1 + ' → ' + v2, it.length ? 'Configuration differences:' : 'No configuration differences.', it);
    };

    const killForm = (w: Workflow) => {
      const aff: [string, string][] = fresh0().scheds.filter((x) => x.on && x.target === wfKey(w.id)).map((x): [string, string] => ['Schedule', x.n + ' · ' + x.trig]).concat([['Callers', 'Chat and API requests to ' + w.n]]);
      const ackL = 'Disable ' + w.n + ' now';
      d.form('Emergency disable · ' + w.n, [
        { type: 'note', tone: 'bad', label: 'Takes effect immediately', text: 'Emergency disablement takes effect at once, without a new version. All executions of this workflow stop. Its agents keep working on their own and in other workflows.' },
        { type: 'kv', label: 'Potentially affected', rows: aff },
        { k: 'reason', label: 'Reason', type: 'text', ph: 'e.g. Unsafe answers observed in job b1c94f08' },
        { k: 'ack', label: 'Confirmation', type: 'select', opts: ['Select', ackL], val: 'Select' },
      ], 'Disable now', (v) => {
        if ((v.reason || '').trim().length < 8) return 'Enter the reason (at least 8 characters).';
        if (v.ack === 'Select') return 'Confirm the disablement.';
        const ref = 'AUD-' + String(Date.now()).slice(-6);
        const dis = { by: actor, at: 'just now', reason: v.reason.trim(), ref };
        updW(w.id, (x) => { x.dis = dis; });
        d.toast(w.n + ' disabled immediately · audit ' + ref + '.');
        ev('Emergency disabled', w.n + ' · ' + dis.reason + ' · ' + ref, 'AI Governance');
        return '';
      });
    };

    const caseForm = (w: Workflow, p: CaseSeed) => {
      const D0 = fresh0();
      const key = wfKey(w.id);
      const sets = D0.evalsets.filter((s0) => (w.evSets || []).includes(s0.id));
      const opts = (sets.length ? sets : D0.evalsets).map((s0) => s0.id + ' · ' + s0.n);
      const refuse = /not found|no official/i.test(p.cat || '');
      d.form('Create evaluation test case', [
        { type: 'kv', label: 'From execution', rows: [['Run', p.run || '—'], ['Agent or workflow', w.n]] },
        { k: 'q', label: 'Input request', type: 'text', val: p.q },
        { k: 'tgt', label: 'Affected agent or workflow', type: 'select', opts: D0.agents.map((a) => 'agent:' + a.id).concat(D0.workflows.map((x) => 'workflow:' + x.id)), val: key },
        { k: 'kind', label: 'Expected behaviour', type: 'select', opts: ['Correct answer', 'Refusal'], val: refuse ? 'Refusal' : 'Correct answer' },
        { k: 'exp', label: 'Expected answer or refusal reason', type: 'text', val: p.exp || (refuse ? 'States that no official data is available and names the closest indicator' : 'Answers from official sources with citations'), ph: 'e.g. Says no official data is available and names the closest indicator' },
        { k: 'evid', label: 'Expected evidence', type: 'text', val: p.evid || '', ph: 'Dataset, document or "None"' },
        { k: 'lang', label: 'Language', type: 'select', opts: ['English', 'Arabic'], val: p.lang || 'English' },
        { k: 'cat', label: 'Failure category', type: 'text', val: p.cat || '' },
        { k: 'set', label: 'Evaluation dataset', type: 'select', opts, val: opts[0] },
      ], 'Save test case', (v) => {
        if (!(v.q || '').trim()) return 'Enter the input request.';
        if (!(v.exp || '').trim()) return 'Describe the expected answer or refusal.';
        if (!v.set) return 'Create an evaluation dataset first.';
        const sid = String(v.set).split(' · ')[0];
        const cid = 'TC-' + (700 + fresh0().evalsets.reduce((n0, s0) => n0 + s0.cases.length, 0) + Math.floor(Math.random() * 50));
        const tk = String(v.tgt);
        const [kind, tid] = [tk.slice(0, tk.indexOf(':')), tk.slice(tk.indexOf(':') + 1)];
        setD((h) => {
          h.evalsets.find((s0) => s0.id === sid)?.cases.push({ id: cid, q: v.q.trim(), exp: v.exp.trim(), refuse: v.kind === 'Refusal', evid: (v.evid || '').trim() || 'None', lang: v.lang, cat: (v.cat || '').trim(), src: p.run || '' });
          if (kind === 'workflow') { const o2 = h.workflows.find((x) => x.id === tid); if (o2 && !o2.evSets.includes(sid)) o2.evSets.push(sid); }
        });
        uiStore.update((s) => { s.lastCase = { cid, sid, key: tk }; });
        d.toast('Test case ' + cid + ' added to ' + sid + '.');
        ev('Created evaluation test case', cid + ' · ' + sid + ' · from ' + (p.run || 'test') + ' · ' + (kind === 'workflow' ? (fresh0().workflows.find((x) => x.id === tid)?.n || tid) : tid), 'Agent Evaluation');
        if (kind === 'agent') go.agent(tid);
        else go.wf(tid, 'eval');
        return '';
      });
    };

    // ---------------------------------------------------------------- create workflow wizard
    const create = () => {
      const AGL = fresh0().agents.filter((a) => a.st !== 'Archived').map((a) => a.id);
      d.wizard({
        title: 'Create workflow',
        steps: ['Basics', 'Starting structure'],
        finishL: 'Create and open designer',
        initial: { entry: 'Chat', start: 'Blank canvas', agents: [], router: 'Rule-based conditions', agg: '—' },
        fields: (step, v): FormField[] => {
          if (step === 0) return [
            { k: 'id', label: 'Workflow ID', type: 'text', ph: 'e.g. contract_review', hint: 'Lower-case letters, digits and underscores.' },
            { k: 'n', label: 'Name', type: 'text' },
            { k: 'purpose', label: 'Purpose', type: 'text' },
            { k: 'entry', label: 'Entry point', type: 'select', opts: ['Chat', 'API', 'Chat and API', 'Schedule', 'Event'] },
          ];
          const ag: string[] = v.agents || [];
          const F: FormField[] = [{ k: 'start', label: 'Start from', type: 'select', opts: ['Blank canvas', ...PATS.map((p) => p[0] + ' template')] }];
          if (!v.start || v.start === 'Blank canvas') return F.concat([{ type: 'note', text: 'The designer opens with the entry point and the output. Drag agents and components onto the canvas and connect them.' }]);
          const pat = String(v.start).replace(' template', '');
          F.push({ type: 'note', text: (PATS.find((p) => p[0] === pat) || PATS[0])[1] }, { k: 'agents', label: pat === 'Sequential' ? 'Agents, in the order they run' : 'Participating agents', type: 'chips', opts: AGL });
          if (pat === 'Conditional routing') F.push({ k: 'router', label: 'Who decides the path', type: 'select', opts: ['Rule-based conditions', ...ag] });
          if (pat === 'Parallel then aggregate') F.push({ k: 'agg', label: 'Agent that combines the results', type: 'select', opts: ag.length ? ag.slice().reverse() : ['—'] });
          if (ag.length >= 2) F.push({ type: 'dgm', label: 'Starting structure', dgm: previewDgm(fromTemplate(v.entry || 'Chat', pat, ag, { router: v.router, agg: v.agg })) });
          return F;
        },
        validate: (step, v) => {
          if (step === 0) {
            const id = (v.id || '').trim();
            if (!/^[a-z][a-z0-9_]{2,40}$/.test(id)) return 'Workflow ID: lower-case letters, digits and underscores.';
            if (fresh0().workflows.some((x) => x.id === id) || id === 'map') return 'A workflow with this ID exists.';
            if (!(v.n || '').trim()) return 'Enter a name.';
          }
          if (step === 1 && v.start && v.start !== 'Blank canvas' && (v.agents || []).length < 2) return 'Select at least two agents, or start from a blank canvas.';
          return '';
        },
        finish: (v) => {
          const id = v.id.trim();
          const start = v.start || 'Blank canvas';
          const pat = start.replace(' template', '');
          const c = start === 'Blank canvas' ? blankG(v.entry) : fromTemplate(v.entry, pat, v.agents, { router: v.router, agg: v.agg });
          setD((h) => { h.workflows.push({ id, n: v.n.trim(), purpose: (v.purpose || '').trim(), entry: v.entry, evSets: [], dis: null, m: [0, 0, '—', '—', 0], thr: {}, vers: [{ v: 'v1', st: 'Draft', at: 'just now', by: actor, note: 'First version', cfg: c }] }); });
          d.toast('Workflow ' + v.n.trim() + ' created as draft v1.');
          ev('Created workflow', id + ' · ' + start);
          uiStore.update((s) => { s.ver[k(id)] = 'v1'; s.wd[k(id)] = null; });
          go.wf(id, 'designer');
          return '';
        },
      });
    };

    // ---------------------------------------------------------------- test runs
    const startTest = (w0: Workflow, v: string, q: string, cfgO?: WfCfg | null) => {
      if (liveTid && t) {
        // live: a real run on the platform; the designer follows it
        void startLiveTest(liveTid, t, w0, v, q, cfgO ?? null, actor).then((err) => {
          if (err) d.info('The test could not start', err);
          else ev('Ran test', nameV(w0, v));
        });
        return;
      }
      const D0 = fresh0();
      const w = D0.workflows.find((x) => x.id === w0.id) || w0;
      const cfg = cfgO || cfgOf(w, v);
      const r = simWf(cfg, w.id, v, q, (a, q0) => simAgent(agentOf(D0, a), q0), !!w.dis);
      const order = Object.keys(r.path).filter((n) => r.path[n] !== 'skip');
      const kk = k(w.id);
      uiStore.update((s) => { s.test[kk] = { ...r, running: true, stepI: 0 }; });
      ev('Ran test', nameV(w, v) + ' · ' + r.id);
      const tick = (i: number) => window.setTimeout(() => {
        const cur = uiStore.get().test[kk];
        if (!cur || cur.id !== r.id) return;
        const done = i >= order.length;
        uiStore.update((s) => { s.test[kk] = { ...s.test[kk], running: !done, stepI: i }; });
        if (!done) tick(i + 1);
      }, 450);
      tick(1);
    };

    const a: WfCtx['a'] = {
      create,
      createDraft,
      publish,
      rollback: (w, v) => d.confirm('Roll back ' + w.n + ' to ' + v + '?', 'Restores a previously published version immediately. ' + ((pubOf(w) && pubOf(w)!.v + ' becomes superseded and stays available.') || ''), [], 'Roll back', () => activate(w, v, 'Rolled back to version')),
      compare,
      compareF: (w) => {
        const pv = pubOf(w), dv = draftOf(w);
        d.form('Compare versions', [
          { k: 'a', label: 'From', type: 'select', opts: w.vers.map((x) => x.v), val: (pv || w.vers[1] || w.vers[0]).v },
          { k: 'b', label: 'To', type: 'select', opts: w.vers.map((x) => x.v), val: (dv || w.vers[0]).v },
        ], 'Compare', (v) => {
          if (v.a === v.b) return 'Choose two different versions.';
          window.setTimeout(() => compare(w, v.a, v.b), 0);
          return '';
        });
      },
      runEval,
      runEvalF: (w) => {
        const D0 = fresh0();
        const pv = pubOf(w), dv = draftOf(w);
        const sets = D0.evalsets.filter((s0) => (w.evSets || []).includes(s0.id));
        const so = (sets.length ? sets : D0.evalsets).map((s0) => s0.id + ' · ' + s0.n);
        const cur = dv || pv || w.vers[0];
        d.form('Run evaluation · ' + w.n, [
          { k: 'v', label: 'Version', type: 'select', opts: w.vers.filter((x) => x.st !== 'Archived').map((x) => x.v + ' · ' + x.st), val: cur.v + ' · ' + cur.st },
          { k: 's', label: 'Evaluation dataset', type: 'select', opts: so, val: so[0] },
        ], 'Run', (v) => {
          if (!v.s) return 'Select evaluation datasets first.';
          runEval(w, String(v.v).split(' · ')[0], String(v.s).split(' · ')[0]);
          return '';
        });
      },
      thresholdsF: (w) => {
        const D0 = fresh0();
        const th = { ...D0.thr, ...(w.thr || {}) };
        d.form('Thresholds · ' + w.n, MET.map(([kk, l, d0]): FormField => ({ k: kk, label: l + (d0 === 'max' ? ' (maximum)' : ' (minimum)'), type: 'text', val: String(th[kk]), hint: kk === 'reg' ? 'Change in accuracy against the active version, e.g. -0.02' : kk === 'parity' ? 'Largest allowed accuracy gap between languages' : 'Between 0 and 1' })), 'Save', (v) => {
          const n0: Record<string, number> = {};
          for (const [kk] of MET) {
            const x = parseFloat(v[kk]);
            if (isNaN(x) || x < -1 || x > 1) return 'Enter numbers between -1 and 1.';
            if (x !== D0.thr[kk]) n0[kk] = x;
          }
          updW(w.id, (x) => { x.thr = n0; });
          d.toast('Thresholds for ' + w.n + ' saved.');
          ev('Changed evaluation thresholds', w.n + ' · ' + (Object.entries(n0).map(([kk, x]) => kk + ' ' + x).join(', ') || 'tenant defaults'), 'Agent Evaluation');
          return '';
        });
      },
      datasetsF: (w) => d.form('Evaluation datasets · ' + w.n, [{ k: 'v', label: 'Datasets', type: 'chips', opts: fresh0().evalsets.map((s0) => s0.id), val: (w.evSets || []).slice() }], 'Save', (v) => {
        updW(w.id, (x) => { x.evSets = v.v || []; });
        d.toast('Evaluation datasets saved.');
        ev('Changed evaluation datasets', w.n + ' · ' + ((v.v || []).join(', ') || 'none'), 'Agent Evaluation');
        return '';
      }),
      disable: killForm,
      reenable: (w) => d.form('Re-enable ' + w.n, [{ k: 'reason', label: 'Reason', type: 'text', ph: 'e.g. Fix verified in EV-0512' }], 'Re-enable', (v) => {
        if ((v.reason || '').trim().length < 8) return 'Enter the reason (at least 8 characters).';
        updW(w.id, (x) => { x.dis = null; });
        d.toast(w.n + ' re-enabled.');
        ev('Re-enabled after emergency disable', w.n + ' · ' + v.reason.trim(), 'AI Governance');
        return '';
      }),
      caseForm,
      openSetting: (w) => {
        const dv = draftOf(wOf(w.id) || w);
        if (dv) setVer(w, dv.v);
        go.wf(w.id, 'designer');
      },
      replay: (w, runId, v) => {
        const cur = wOf(w.id) || w;
        const vv = cur.vers.some((x) => x.v === v && x.cfg) ? v : (draftOf(cur) || pubOf(cur) || cur.vers[0]).v;
        openDesigner(cur, vv, { mode: 'replay', rp: { run: runId, i: 99 }, sel: null, conn: null });
      },
      showStep: (w, nodeId) => {
        const x = uiStore.get().wd[k(w.id)];
        if (!x) return;
        let rp = x.rp;
        if (x.mode === 'replay' && rp) {
          const D0 = fresh0();
          const T0 = uiStore.get().test[k(w.id)];
          const rr = D0.wfruns.find((r) => r.id === rp!.run) || (T0 && T0.id === rp.run ? T0 : null);
          const order = rr ? Object.keys(rr.path).filter((n) => rr.path[n] !== 'skip') : [];
          rp = { run: rp.run, i: Math.max(Math.min(rp.i, order.length), order.indexOf(nodeId) + 1) };
        }
        putWd(w, { ...x, sel: 'n:' + nodeId, rp });
      },
    };

    const saveDesign = (w: Workflow, v: string, cfg: WfCfg, errors: number) => {
      const c2 = wfDerive(clone(cfg));
      updW(w.id, (o) => { const v0 = o.vers.find((y) => y.v === v); if (v0) { v0.cfg = c2; v0.at = 'just now'; } });
      const x = uiStore.get().wd[k(w.id)];
      if (x) putWd(w, { ...x, cfg: c2, dirty: false });
      d.toast('Draft ' + v + ' saved' + (errors ? ' · ' + errors + ' issue' + (errors > 1 ? 's' : '') + ' to resolve before submission.' : '.'));
      ev('Saved workflow draft', w.n + ' ' + v + ' · ' + c2.mode + ' · ' + (c2.nodes.length - 2) + ' steps');
    };

    return {
      t, tn, D, ui, actor,
      canRead: (ag: string) => can('agent:read', 'agent', ag),
      canUpd, canAppr, canOps, canCreate, canExec,
      go, a, saveDesign, startTest, setVer, putWd, wdOf,
      live: wfLoad.on ? { ...wfLoad, missing: wfMissing } : null,
      liveRuns: !!liveTid,
    };
  }, [t, D, ui, actor, can, canUpd, canAppr, canOps, canCreate, canExec, base, nav, d, liveTid, wfLoad, wfMissing]);
}

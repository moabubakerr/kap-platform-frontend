/**
 * Workflow designer (port of the prototype's `designerSec` and the `sec.isDsg`
 * block of design-ref-v35/screens/_engine_screen.pretty.html): toolbar with
 * version, modes (Design · Test · Replay), undo/redo, zoom, auto layout, tools,
 * validate, save and publish; a status bar with the issues; a left panel
 * (palette, test request, or replay of recorded executions); an interactive
 * canvas (drag from the palette, move steps, connect ports, select connections)
 * and a properties panel; the legend at the bottom.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/engine/dialogs';
import { SAMPLES, type Workflow } from './types';
import { EDGE_C, edgeGeom, TONE, wfMap, type CanvasNode, type RunOverlay } from './canvas';
import {
  addNode, agentsInG, canConnect, CHECKS, CHKL, clone, COMP, connectNodes, dupNode, ETY, FBA, KL, NH, nodeL, NW, removeSel, runOrder, setEdgeKind, snap,
  wfCheck, wfDerive, wfLayout, type WfCfg,
} from './model';
import { agentOf, agentOk, draftOf, modelL, toolName, wfUsing } from './logic';
import { uiKey, type DsgMode, type Wd } from './state';
import type { WfHub } from './useWorkflows';

type Fld = { label: string; val: string; on: ((v: string) => void) | null; opts?: string[]; ph?: string; area?: boolean };
type KV = { k: string; v: string };
type PAct = { l: string; f: () => void; v?: 'primary' | 'outline' | 'ghost' };
type Iss = { m: string; fg: string; f?: () => void };

const inp: React.CSSProperties = { height: 32, padding: '0 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--r-sm)', background: 'var(--surface-card)', font: 'inherit', fontSize: 12.5, color: 'var(--text-body)', minWidth: 0, width: '100%', boxSizing: 'border-box' };

function Field({ f }: { f: Fld }) {
  const ro = !f.on;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
      <span>{f.label}</span>
      {ro ? (
        <span style={{ fontSize: 13, color: 'var(--text-body)', overflowWrap: 'anywhere' }}>{f.val || '—'}</span>
      ) : f.opts ? (
        <select aria-label={f.label} value={f.opts.includes(f.val) ? f.val : f.opts[0]} onChange={(e) => f.on!(e.target.value)} style={{ ...inp, padding: '0 6px' }}>
          {f.opts.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : f.area ? (
        <textarea aria-label={f.label} rows={4} placeholder={f.ph} value={f.val} onChange={(e) => f.on!(e.target.value)} style={{ ...inp, height: 'auto', padding: '6px 8px', fontSize: 13, resize: 'vertical' }} />
      ) : (
        <input type="text" aria-label={f.label} placeholder={f.ph} value={f.val} onChange={(e) => f.on!(e.target.value)} style={inp} />
      )}
    </label>
  );
}

function TbBtn({ l, t, f, off, pri, ic }: { l: string; t?: string; f: () => void; off?: boolean; pri?: boolean; ic?: boolean }) {
  return (
    <button
      type="button"
      title={t || l}
      aria-label={t || l}
      disabled={off}
      onClick={f}
      style={{
        height: 30, minWidth: 30, width: ic ? 30 : 'auto', padding: ic ? 0 : '0 10px', border: '1px solid ' + (pri ? 'var(--brand)' : 'var(--border-default)'), borderRadius: 'var(--r-sm)',
        background: pri ? 'var(--brand)' : 'var(--surface-card)', color: pri ? '#fff' : 'var(--text-body)', font: 'inherit', fontSize: 12.5, fontWeight: 500, cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1, whiteSpace: 'nowrap',
      }}
    >
      {l}
    </button>
  );
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function Designer({ hub, w, vsel }: { hub: WfHub; w: Workflow; vsel: string }) {
  const d = useDialogs();
  const { D, tn } = hub;
  const key = uiKey(hub.t || '', w.id);
  const stored = hub.ui.wd[key];
  const x: Wd = stored && stored.v === vsel ? stored : hub.wdOf(w, vsel);
  const c = x.cfg;
  const vx = w.vers.find((v) => v.v === vsel) || w.vers[0];
  const isDraft = vx.st === 'Draft';
  const upd = hub.canUpd;
  const mode: DsgMode = x.mode || 'design';
  const editable = isDraft && upd && mode === 'design';
  const dv = draftOf(w);
  const okA = agentOk(D, tn);
  const iss = wfCheck(c, okA);
  const errs = iss.filter((i) => i.sev === 'error'), warns = iss.filter((i) => i.sev === 'warn');
  const AGL = D.agents.filter((a) => a.st !== 'Archived').map((a) => a.id);

  // ---------------------------------------------------------------- working-copy helpers
  const xRef = React.useRef(x);
  xRef.current = x;
  const put = (nx: Wd) => hub.putWd(w, nx);
  const edit = (fn: (cc: WfCfg, n: Wd) => void, keep?: boolean) => {
    const x0 = xRef.current;
    const n: Wd = { ...x0, cfg: clone(x0.cfg), hist: x0.hist.concat([JSON.stringify(x0.cfg)]).slice(-40), fut: [], dirty: true };
    fn(n.cfg, n);
    wfDerive(n.cfg);
    if (!keep) n.conn = null;
    put(n);
  };
  /** an edit of one field: consecutive typing in the same field is one undo step */
  const editF = (fk: string, fn: (cc: WfCfg) => void) =>
    edit((cc, n) => {
      const x0 = xRef.current;
      fn(cc);
      if (x0.lastF === fk && Date.now() - (x0.lastT || 0) < 1500) n.hist = x0.hist;
      n.lastF = fk;
      n.lastT = Date.now();
    }, true);
  const undo = () => {
    const x0 = xRef.current;
    if (!x0.hist.length) return;
    const prev = JSON.parse(x0.hist[x0.hist.length - 1]) as WfCfg;
    put({ ...x0, cfg: prev, hist: x0.hist.slice(0, -1), fut: [JSON.stringify(x0.cfg)].concat(x0.fut), dirty: true, sel: null, lastF: undefined });
  };
  const redo = () => {
    const x0 = xRef.current;
    if (!x0.fut.length) return;
    const nx = JSON.parse(x0.fut[0]) as WfCfg;
    put({ ...x0, cfg: nx, fut: x0.fut.slice(1), hist: x0.hist.concat([JSON.stringify(x0.cfg)]), dirty: true, sel: null, lastF: undefined });
  };
  const connect = (a: string, b: string) => {
    const r = canConnect(xRef.current.cfg, a, b);
    if ('err' in r) { toast(r.err); return; }
    if ('existing' in r) { put({ ...xRef.current, sel: 'e:' + r.existing, conn: null }); return; }
    if ('none' in r) return;
    edit((cc, n) => { const r2 = connectNodes(cc, a, b); if ('added' in r2) n.sel = 'e:' + r2.added; });
  };
  const remove = () => {
    const sel = xRef.current.sel;
    if (!sel || !editable) return;
    const err = removeSel(clone(xRef.current.cfg), sel);
    if (err) { toast(err); return; }
    edit((cc, n) => { removeSel(cc, sel); n.sel = null; });
  };
  const dup = () => {
    const sel = xRef.current.sel;
    if (!sel || !sel.startsWith('n:')) return;
    edit((cc, n) => { const nid = dupNode(cc, sel.slice(2)); if (nid) n.sel = 'n:' + nid; });
  };
  const add = (k: string, at?: [number, number]) => { if (editable) edit((cc, n) => { n.sel = 'n:' + addNode(cc, k, at); }); };

  // ---------------------------------------------------------------- test and replay overlays
  const T0 = hub.ui.test[key];
  const testOv = mode === 'test' && T0 && T0.ver === vsel ? T0 : null;
  type RunL = { id: string; v: string; st: string; path: Record<string, 'ok' | 'bad' | 'skip'>; q: string; at: string; lbl: string; steps?: [string, string, string, string, string?][]; err?: string };
  const runsW: RunL[] = [
    ...D.wfruns.filter((r) => r.wf === w.id).map((r): RunL => ({ id: r.id, v: r.v, st: r.st, path: r.path, q: r.q, at: r.at, err: r.reason, lbl: r.id + ' · ' + r.v + ' · ' + r.st + ' · ' + r.at })),
    ...(T0 && !T0.running ? [{ id: T0.id, v: T0.ver, st: T0.st, path: T0.path, steps: T0.steps, q: T0.q, at: 'test', err: T0.err, lbl: T0.id + ' · test · ' + T0.st }] : []),
  ];
  const rr = mode === 'replay' ? runsW.find((r) => x.rp && r.id === x.rp.run) || runsW[0] || null : null;
  const rOrder = rr ? runOrder(rr.path) : [];
  const rI = rr ? Math.min(x.rp && x.rp.run === rr.id ? x.rp.i : rOrder.length, rOrder.length) : 0;
  const rpOv: RunOverlay | null = rr ? { path: rr.path, running: rI < rOrder.length, stepI: rI } : null;
  const ov: RunOverlay | null = testOv ? { path: testOv.path, running: testOv.running, stepI: testOv.stepI } : rpOv;
  const showIds = new Set(x.showI && mode === 'design' ? iss.map((i) => i.id) : []);

  // ---------------------------------------------------------------- canvas geometry (with a step being dragged)
  const [drag, setDrag] = React.useState<{ id: string; dx: number; dy: number } | null>(null);
  const [wire, setWire] = React.useState<{ from: string; x: number; y: number } | null>(null);
  const noClick = React.useRef(0);
  const shown: WfCfg = drag ? { ...c, pos: { ...c.pos, [drag.id]: [(c.pos[drag.id] || [0, 0])[0] + drag.dx, (c.pos[drag.id] || [0, 0])[1] + drag.dy] } } : c;
  const spec = wfMap(shown, { sel: x.sel, test: ov, tools: x.tools ? (a) => agentOf(D, a)?.tset || [] : null, iss: showIds, disabled: (a) => !!agentOf(D, a)?.dis, toolOff: (t0) => !!D.toolDis[t0.includes(':') ? t0 : 'kap:' + t0] });
  const maxX = Math.max(0, ...c.nodes.map((n) => (c.pos[n[0]] || [0, 0])[0]));
  const maxY = Math.max(0, ...spec.nodes.map((n) => n.y));
  const W = Math.max(800, maxX + NW + 120, ...spec.nodes.map((n) => n.x + n.w + 16));
  const H = Math.max(400, maxY + NH + 110, ...spec.nodes.map((n) => n.y + n.h + 16));
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  const showLeft = (mode === 'design' && editable) || mode !== 'design';
  const zoom = x.zoom || Math.max(0.8, Math.min(1, +((showLeft ? 640 : 860) / W).toFixed(2)));
  const setZoom = (z: number) => put({ ...x, zoom: Math.max(0.4, Math.min(1.6, +z.toFixed(2))) });
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const planeRef = React.useRef<HTMLDivElement>(null);
  const toCanvas = (cx: number, cy: number): [number, number] => {
    const r = planeRef.current?.getBoundingClientRect();
    return r ? [(cx - r.left) / zoom, (cy - r.top) / zoom] : [0, 0];
  };

  // keyboard: delete, undo/redo, escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.closest('input,textarea,select,[contenteditable="true"]') || tg.closest('[role="dialog"]'))) return;
      const x0 = xRef.current;
      const ed = isDraft && upd && (x0.mode || 'design') === 'design';
      if (!ed) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && x0.sel) { e.preventDefault(); remove(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (e.key === 'Escape' && (x0.sel || x0.conn)) put({ ...x0, sel: null, conn: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const click = (id: string) => {
    if (Date.now() - noClick.current < 350) return;
    const x0 = xRef.current;
    if (x0.conn && id.startsWith('n:') && editable) { connect(x0.conn, id.slice(2)); return; }
    put({ ...x0, sel: id, conn: null });
  };

  // node drag (move)
  const onNodeDown = (e: React.PointerEvent, n: CanvasNode) => {
    if (!editable || !n.id.startsWith('n:') || e.button !== 0) return;
    const id = n.id.slice(2);
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      setDrag({ id, dx, dy });
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
      setDrag(null);
      if (!moved) return;
      noClick.current = Date.now();
      const dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;
      edit((cc, nn) => { const p = cc.pos[id] || [0, 0]; cc.pos[id] = [snap(p[0] + dx), snap(p[1] + dy)]; nn.sel = 'n:' + id; }, true);
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
  };

  // port drag (connect), or click to start connect mode
  const onPortDown = (e: React.PointerEvent, from: string) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const mv = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      moved = true;
      const [px, py] = toCanvas(ev.clientX, ev.clientY);
      setWire({ from, x: px, y: py });
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
      setWire(null);
      noClick.current = Date.now();
      if (!moved) {
        const x0 = xRef.current;
        put({ ...x0, conn: x0.conn === from ? null : from, sel: 'n:' + from });
        return;
      }
      const tgt = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-node]')?.getAttribute('data-node');
      if (tgt && tgt.startsWith('n:')) connect(from, tgt.slice(2));
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
  };

  const bgClick = (e: React.MouseEvent) => {
    const t0 = e.target as HTMLElement;
    if (t0.closest('[data-node],[data-edge],[data-port]')) return;
    if (Date.now() - noClick.current < 350) return;
    if (x.sel || x.conn) put({ ...x, sel: null, conn: null });
  };
  const onDrop = (e: React.DragEvent) => {
    if (!editable) return;
    const k = e.dataTransfer.getData('text/plain');
    if (!/^(agent|comp):/.test(k)) return;
    e.preventDefault();
    add(k, toCanvas(e.clientX, e.clientY));
  };

  // ---------------------------------------------------------------- toolbar, status
  const setMode = (m: DsgMode) => put({ ...x, mode: m, sel: null, conn: null, rp: m === 'replay' ? x.rp || (runsW[0] ? { run: runsW[0].id, i: 0 } : null) : x.rp });
  const validate = () => {
    put({ ...x, showI: true });
    toast(errs.length ? errs.length + ' issue' + (errs.length > 1 ? 's' : '') + ' found' + (warns.length ? ' · ' + warns.length + ' warning' + (warns.length > 1 ? 's' : '') : '') + '.' : 'Validation passed' + (warns.length ? ' with ' + warns.length + ' warning' + (warns.length > 1 ? 's' : '') : '') + '.');
  };
  const fit = () => { const wd0 = wrapRef.current ? wrapRef.current.clientWidth - 32 : 900; setZoom(wd0 / W); };
  const status = (isDraft ? 'Draft ' + vsel + (x.dirty ? ' · unsaved changes' : ' · saved') : vx.st + ' ' + vsel + ' · read-only') + ' · ' + c.mode;
  const issL = !iss.length ? 'Valid' : (errs.length ? errs.length + ' issue' + (errs.length > 1 ? 's' : '') : '') + (errs.length && warns.length ? ' · ' : '') + (warns.length ? warns.length + ' warning' + (warns.length > 1 ? 's' : '') : '');
  const vers = w.vers.filter((v) => v.cfg || v.st === 'Published' || v.st === 'Draft');
  const setVer = (v: string) => {
    if (v === vsel) return;
    if (x.dirty) d.confirm('Discard unsaved changes?', 'Changes to draft ' + vsel + ' have not been saved.', [], 'Discard', () => { hub.putWd(w, null); hub.setVer(w, v); });
    else hub.setVer(w, v);
  };

  // ---------------------------------------------------------------- left panel
  let left: React.ReactNode = null;
  if (mode === 'design' && editable) {
    const q = (x.palQ || '').toLowerCase();
    const ok = (s0: string) => !q || s0.toLowerCase().includes(q);
    const groups = [
      { g: 'Agents', items: D.agents.filter((a) => a.st !== 'Archived' && ok(a.id + ' ' + a.purpose)).map((a) => ({ k: 'agent:' + a.id, l: a.id, s: a.dis ? 'Disabled' : a.st === 'Published' ? 'Published ' + a.v : 'Draft only' })) },
      { g: 'Orchestration', items: COMP.filter((cp) => ok(cp[1] + ' ' + cp[2])).map(([k, l, s0]) => ({ k: 'comp:' + k, l, s: s0 })) },
    ];
    left = (
      <>
        <input type="search" aria-label="Search agents and components" placeholder="Search agents and components" value={x.palQ || ''} onChange={(e) => put({ ...x, palQ: e.target.value })} style={{ ...inp, fontSize: 13 }} />
        {groups.map((g) => (
          <div key={g.g} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{g.g}</div>
            {g.items.map((it) => (
              <div
                key={it.k}
                data-pal={it.k}
                draggable
                role="button"
                tabIndex={0}
                title="Drag onto the canvas, or select to add"
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', it.k); e.dataTransfer.effectAllowed = 'copy'; }}
                onClick={() => add(it.k)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(it.k); } }}
                className="hover:!border-brand"
                style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '7px 9px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--surface-card)', cursor: 'grab', userSelect: 'none' }}
              >
                <span className="ellipsis" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)' }}>{it.l}</span>
                <span className="ellipsis" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{it.s}</span>
              </div>
            ))}
            {!g.items.length && <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No matches</div>}
          </div>
        ))}
      </>
    );
  }
  if (mode === 'test') {
    const sets = D.evalsets.filter((s0) => (w.evSets || []).includes(s0.id)).concat(D.evalsets.filter((s0) => !(w.evSets || []).includes(s0.id)));
    const cases = sets.flatMap((s0) => s0.cases.map((cs) => s0.id + ' · ' + cs.id + ' · ' + cs.q.slice(0, 60)));
    const tq = x.tq || '';
    const samples = hub.t ? SAMPLES[hub.t] : [];
    const runT = () => {
      const q = tq.trim();
      if (!q) { toast('Enter a request, or choose a sample or a test case.'); return; }
      hub.startTest(w, vsel, q, x.dirty ? clone(c) : null);
      put({ ...x, sel: null });
    };
    const tf: Fld[] = [
      { label: 'Version', val: vsel + ' · ' + vx.st + (x.dirty ? ' · unsaved changes included' : ''), on: null },
      { label: 'Sample request', val: 'Choose', on: (v) => put({ ...x, tq: v === 'Choose' ? tq : v }), opts: ['Choose', ...samples] },
      { label: 'Test case from a dataset', val: 'Choose', on: (v) => { if (v === 'Choose') return; const [sid, cid] = v.split(' · '); const cs = (D.evalsets.find((s0) => s0.id === sid) || { cases: [] }).cases.find((y) => y.id === cid); put({ ...x, tq: cs ? cs.q : tq }); }, opts: ['Choose', ...cases] },
      { label: 'Request', val: tq, on: (v) => put({ ...x, tq: v }), ph: 'Type a request to test', area: true },
    ];
    const running = !!(T0 && T0.running);
    left = (
      <>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-strong)' }}>Test request</div>
        {hub.canExec ? tf.map((f) => <Field key={f.label} f={f} />) : <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>You need permission to execute agents to run tests.</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hub.canExec && <Button size="xs" onClick={running ? undefined : runT} disabled={running}>{running ? 'Running…' : 'Run test'}</Button>}
          {testOv && !testOv.running && <Button size="xs" variant="outline" onClick={() => put({ ...x, mode: 'replay', rp: { run: testOv.id, i: 0 } })}>Replay this test</Button>}
        </div>
      </>
    );
  }
  if (mode === 'replay') {
    const rl = rr ? 'Step ' + rI + ' of ' + rOrder.length + (rI > 0 ? ' · ' + nodeL(c, rOrder[rI - 1]) : '') : 'No executions to replay yet';
    const setI = (i: number) => rr && put({ ...x, rp: { run: rr.id, i } });
    left = (
      <>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-strong)' }}>Executions</div>
        {runsW.map((r) => {
          const on = !!rr && rr.id === r.id;
          return (
            <button key={r.id} type="button" data-replay-run="1" onClick={() => put({ ...x, rp: { run: r.id, i: 0 }, sel: null })} style={{ textAlign: 'left', border: '1px solid ' + (on ? 'var(--brand)' : 'var(--border-subtle)'), background: on ? 'var(--brand-tint)' : 'transparent', borderRadius: 8, padding: '7px 9px', font: 'inherit', fontSize: 12, color: 'var(--text-body)', cursor: 'pointer' }}>
              {r.lbl}
            </button>
          );
        })}
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }} data-replay-pos="1">{rl}</div>
        {rr && (
          <div style={{ display: 'flex', gap: 6 }}>
            {([['⏮', 'First step', 0], ['◀', 'Previous step', Math.max(0, rI - 1)], ['▶', 'Next step', Math.min(rOrder.length, rI + 1)], ['⏭', 'Last step', rOrder.length]] as [string, string, number][]).map(([l, t, i]) => (
              <button key={t} type="button" title={t} aria-label={t} onClick={() => setI(i)} style={{ height: 30, width: 38, border: '1px solid var(--border-default)', borderRadius: 'var(--r-sm)', background: 'var(--surface-card)', font: 'inherit', fontSize: 13, cursor: 'pointer', color: 'var(--text-body)' }}>
                {l}
              </button>
            ))}
          </div>
        )}
        {rr &&
          [{ k: 'Request', v: rr.q || '—' }, { k: 'Result', v: rr.st }].map((q) => (
            <div key={q.k} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-muted)' }}>{q.k}</span>
              <span>{q.v}</span>
            </div>
          ))}
      </>
    );
  }

  // ---------------------------------------------------------------- right panel (properties, or step results)
  let pt = 'Workflow', ps = w.n + ' · ' + vsel;
  let pf: Fld[] = [], pkv: KV[] = [], pacts: PAct[] = [], piss: Iss[] = [];
  const stepOf = (id: string): KV[] => {
    if (!ov) return [];
    const p = ov.path[id];
    const order = runOrder(ov.path);
    const i = order.indexOf(id);
    const st0 = !p || p === 'skip' ? 'Skipped' : ov.running && i >= ov.stepI ? 'Pending' : p === 'bad' ? 'Failed' : 'Completed';
    const s1 = ((testOv && testOv.steps) || (rr && rr.steps) || []).find((y) => y[4] === id);
    const n = c.nodes.find((y) => y[0] === id);
    const outE = c.edges.filter((e) => e[0] === id && ov.path[e[1]] && ov.path[e[1]] !== 'skip');
    const kind = n ? n[1] : '';
    const outp = st0 !== 'Completed' && st0 !== 'Failed' ? '—'
      : kind === 'entry' ? (testOv || rr)?.q || 'Request received'
      : kind === 'router' ? 'Routed to ' + outE.map((e) => nodeL(c, e[1]) + (e[3] ? ' (' + e[3] + ')' : '')).join(', ')
      : kind === 'output' ? (testOv && testOv.answer) || 'Answer returned'
      : kind === 'fallback' ? 'Fallback answer returned'
      : kind === 'review' ? (st0 === 'Failed' ? 'Check failed' : 'Check passed')
      : st0 === 'Failed' ? '—' : 'Result passed to ' + (outE.map((e) => nodeL(c, e[1])).join(', ') || 'the next step');
    return [
      { k: 'Status', v: st0 },
      { k: 'Detail', v: (s1 && s1[3]) || (st0 === 'Failed' ? 'Step failed' : st0 === 'Completed' ? 'Completed in ' + (300 + ((id.length * 137) % 2400)) + ' ms' : '—') },
      { k: 'Intermediate result', v: outp },
      ...(st0 === 'Failed' ? [{ k: 'Error', v: (s1 && s1[3]) || (testOv && testOv.err) || 'Step failed' }] : []),
    ];
  };
  const sel = x.sel;
  if (sel && sel.startsWith('n:')) {
    const id = sel.slice(2);
    const n = c.nodes.find((y) => y[0] === id);
    if (n) {
      const np = c.np[id] || {};
      const ag = (n[1] === 'agent' || n[1] === 'aggregate') && n[2] ? agentOf(D, n[2]) : undefined;
      pt = n[1] === 'review' ? (np.rt === 'human' ? 'Human review' : 'Validator') : n[1] === 'aggregate' ? 'Aggregator' : n[1] === 'fallback' ? 'Fallback handler' : KL[n[1]];
      ps = nodeL(c, id);
      if (ov) pkv = stepOf(id);
      else {
        const E = editable;
        const setLbl = E ? (v: string) => editF('l:' + id, (cc) => { cc.nodes.find((y) => y[0] === id)![2] = v; }) : null;
        const setSub = E ? (v: string) => editF('s:' + id, (cc) => { cc.nodes.find((y) => y[0] === id)![3] = v; }) : null;
        const setP = (k: string) => (E ? (v: string) => editF(k + ':' + id, (cc) => { cc.np[id] = { ...(cc.np[id] || {}), [k]: v }; }) : null);
        if (n[1] === 'agent') pf = [
          { label: 'Agent', val: n[2], on: setLbl, opts: AGL.includes(n[2]) ? AGL : [n[2], ...AGL] },
          { label: 'Role in this workflow', val: n[3], on: setSub, ph: 'e.g. Resolve the indicator' },
          { label: 'Timeout', val: np.timeout || '60 s', on: setP('timeout'), opts: ['10 s', '30 s', '60 s', '120 s', '180 s'] },
          { label: 'Retries', val: np.retries || '1', on: setP('retries'), opts: ['0', '1', '2', '3'] },
          { label: 'If the step fails', val: np.onErr || 'Use the failure path', on: setP('onErr'), opts: ['Use the failure path', 'Continue without this result', 'Stop the workflow'] },
        ];
        if (n[1] === 'aggregate') pf = [
          { label: 'Agent that combines the results', val: n[2] || 'Choose', on: setLbl, opts: (n[2] ? [] : ['Choose']).concat(AGL) },
          { label: 'How results are combined', val: np.merge || 'Merge all results', on: setP('merge'), opts: ['Merge all results', 'First successful result', 'Majority of results'] },
          { label: 'Wait for', val: np.wait || 'All incoming steps', on: setP('wait'), opts: ['All incoming steps', 'First completed step'] },
        ];
        if (n[1] === 'router') {
          const outs = c.edges.map((e, i) => [e, i] as const).filter(([e]) => e[0] === id);
          pf = [
            { label: 'Name', val: n[2], on: setLbl },
            { label: 'Decided by', val: np.by || 'Rule-based conditions', on: setP('by'), opts: ['Rule-based conditions', ...AGL] },
            ...outs.map(([e, i]): Fld => ({ label: 'Route to ' + nodeL(c, e[1]) + ' when', val: e[3], on: E ? (v) => editF('c:' + i, (cc) => { cc.edges[i][3] = v; }) : null, ph: 'e.g. numeric question' })),
            { label: 'Default path', val: np.def || (outs[0] ? nodeL(c, outs[outs.length - 1][0][1]) : '—'), on: setP('def'), opts: outs.length ? outs.map(([e]) => nodeL(c, e[1])) : ['—'] },
          ];
          pkv = outs.length < 2 ? [{ k: 'Paths', v: 'Connect the router to at least two steps: drag from its handle to a step.' }] : [];
        }
        if (n[1] === 'review' && np.rt !== 'human') pf = [
          { label: 'What is checked', val: np.check || CHECKS[0], on: E ? (v) => editF('chk:' + id, (cc) => { cc.np[id] = { ...(cc.np[id] || {}), check: v }; const nd = cc.nodes.find((y) => y[0] === id)!; if (Object.values(CHKL).includes(nd[2]) || nd[2] === 'Validator') nd[2] = CHKL[v]; }) : null, opts: CHECKS },
          { label: 'Name', val: n[2], on: setLbl },
          { label: 'If the check fails', val: np.onFail || 'Use the fallback', on: setP('onFail'), opts: ['Use the fallback', 'Stop and return an explanation'] },
        ];
        if (n[1] === 'review' && np.rt === 'human') pf = [
          { label: 'Reviewers', val: np.who || n[3] || 'Agent reviewers', on: E ? (v) => editF('who:' + id, (cc) => { cc.np[id] = { ...(cc.np[id] || {}), who: v }; cc.nodes.find((y) => y[0] === id)![3] = v; }) : null, opts: ['Agent reviewers', 'Analyst', 'Tenant administrators'] },
          { label: 'Review time limit', val: np.tl || '24 h', on: setP('tl'), opts: ['4 h', '24 h', '3 days'] },
          { label: 'If not reviewed in time', val: np.late || 'Escalate to tenant administrators', on: setP('late'), opts: ['Escalate to tenant administrators', 'Reject the result'] },
        ];
        if (n[1] === 'fallback') pf = [
          { label: 'Name', val: n[2], on: setLbl },
          { label: 'Triggered when', val: np.on || 'Validation fails or a step times out', on: setP('on'), opts: ['Validation fails or a step times out', 'Any step fails', 'A step times out'] },
          { label: 'What happens', val: np.action || FBA[0], on: setP('action'), opts: FBA },
          { label: 'Notify', val: np.notify || 'Nobody', on: setP('notify'), opts: ['Nobody', 'Workflow owner', 'Agent reviewers'] },
        ];
        if (n[1] === 'entry') pf = [{ label: 'Entry point', val: w.entry, on: null }, { label: 'Input', val: n[3] || 'Request text and caller identity', on: null }];
        if (n[1] === 'output') pf = [{ label: 'Name', val: n[2], on: setLbl }, { label: 'Format', val: np.fmt || 'Answer with citations', on: setP('fmt'), opts: ['Answer with citations', 'Structured result (JSON)', 'Report delivery'] }];
        if (ag) pkv = [
          { k: 'Published version', v: (ag.st === 'Draft' ? 'None' : ag.v) + (ag.dis ? ' · disabled' : '') },
          { k: 'Model', v: modelL(ag) },
          { k: 'Tools', v: ag.tset.map(toolName).join(', ') || 'None' },
          { k: 'Also used in', v: wfUsing(D, ag.id).filter((y) => y.id !== w.id).map((y) => y.n).join(', ') || 'No other workflow' },
        ];
        piss = iss.filter((i) => i.id === id).map((i) => ({ m: i.m, fg: i.sev === 'error' ? 'var(--danger)' : 'var(--warning-fg, #8a5a00)' }));
      }
      pacts = [
        ...(ag ? [{ l: 'Open agent', f: () => hub.go.agent(ag.id) }] : []),
        ...(editable && n[1] !== 'entry' && n[1] !== 'output'
          ? [{ l: 'Connect to…', f: () => put({ ...x, conn: id }) }, { l: 'Duplicate', f: dup }, { l: 'Remove', f: remove, v: 'ghost' as const }]
          : editable && n[1] === 'entry' ? [{ l: 'Connect to…', f: () => put({ ...x, conn: id }) }] : []),
      ];
    }
  } else if (sel && sel.startsWith('e:')) {
    const i = +sel.slice(2);
    const e = c.edges[i];
    if (e) {
      pt = 'Connection';
      ps = nodeL(c, e[0]) + ' → ' + nodeL(c, e[1]);
      const E = editable;
      pf = [
        { label: 'From', val: nodeL(c, e[0]), on: null },
        { label: 'To', val: nodeL(c, e[1]), on: null },
        { label: 'Type', val: (ETY.find((t) => t[0] === e[2]) || ETY[0])[1], on: E ? (v) => editF('et:' + i, (cc) => setEdgeKind(cc, i, v)) : null, opts: ETY.map((t) => t[1]) },
        { label: e[2] === 'cond' ? 'Condition' : e[2] === 'delegate' ? 'Delegate when' : e[2] === 'fallback' ? 'Triggered when' : 'Label (optional)', val: e[3], on: E ? (v) => editF('ec:' + i, (cc) => { cc.edges[i][3] = v; }) : null, ph: e[2] === 'cond' ? 'e.g. question about documents' : e[2] === 'delegate' ? 'e.g. the indicator cannot be resolved' : '' },
        { label: 'Data passed', val: e[4] || '', on: E ? (v) => editF('em:' + i, (cc) => { cc.edges[i][4] = v; }) : null, ph: 'Full context (default) or e.g. facts, citations' },
      ];
      if (ov) pkv = [{ k: 'Taken in this run', v: ov.path[e[0]] && ov.path[e[0]] !== 'skip' && ov.path[e[1]] && ov.path[e[1]] !== 'skip' ? 'Yes' : 'No' }];
      piss = iss.filter((q) => q.id === 'e:' + i).map((q) => ({ m: q.m, fg: 'var(--danger)' }));
      pacts = editable ? [{ l: 'Remove connection', f: remove, v: 'ghost' }] : [];
    }
  } else if (ov) {
    const R0 = testOv || rr;
    pt = testOv ? 'Test result' : 'Execution';
    ps = (R0?.id || '') + ' · ' + (testOv ? testOv.ver : rr?.v || vsel);
    pkv = [
      { k: 'Request', v: R0?.q || '—' },
      { k: 'Result', v: ov.running && testOv ? 'Running…' : R0?.st || '—' },
      ...(R0?.err ? [{ k: 'Error', v: R0.err }] : []),
      ...(testOv && !testOv.running ? [{ k: 'Answer', v: testOv.answer || '—' }] : []),
    ];
    pacts = [
      ...(testOv && !testOv.running && testOv.st !== 'Succeeded' ? [{ l: 'Create evaluation test case', f: () => hub.a.caseForm(w, { q: testOv.q, lang: testOv.lang, cat: testOv.err, run: testOv.id }) }] : []),
      ...(rr && rr.at !== 'test' ? [{ l: 'Open execution details', f: () => hub.go.run(rr.id) }] : []),
    ];
  } else {
    const E = editable;
    pf = [
      { label: 'Max duration', val: c.limits.dur, on: E ? (v) => edit((cc) => { cc.limits = { ...cc.limits, dur: v }; }) : null, opts: ['30 s', '60 s', '120 s', '5 min', '10 min'] },
      { label: 'Max steps', val: c.limits.steps, on: E ? (v) => edit((cc) => { cc.limits = { ...cc.limits, steps: v }; }) : null, opts: ['6', '8', '12', '16'] },
      { label: 'Without a fallback handler', val: c.onErr || 'Stop and return an explanation', on: E ? (v) => edit((cc) => { cc.onErr = v; }) : null, opts: ['Stop and return an explanation', 'Stop and notify the owner'] },
    ];
    pkv = [{ k: 'Orchestration', v: c.mode }, { k: 'Steps', v: String(c.nodes.length - 2) }, { k: 'Agents', v: agentsInG(c).join(', ') || 'None' }];
    piss = (x.showI ? iss : []).map((q) => ({ m: q.m, fg: q.sev === 'error' ? 'var(--danger)' : 'var(--text-muted)', f: () => put({ ...x, sel: q.id.startsWith('e:') ? q.id : 'n:' + q.id }) }));
  }

  // ---------------------------------------------------------------- canvas overlays
  // the canvas plane is in design units; zoom is a CSS scale
  const ports = editable ? spec.nodes.filter((n) => n.id.startsWith('n:') && n.kind !== 'output') : [];
  const geo = spec.edges.map((e) => { const a = byId.get(e.a), b = byId.get(e.b); return a && b ? { e, g: edgeGeom(e, a, b) } : null; }).filter(Boolean) as { e: (typeof spec.edges)[number]; g: ReturnType<typeof edgeGeom> }[];
  const wireFrom = wire ? byId.get('n:' + wire.from) : null;
  const connL = x.conn ? 'Connecting from ' + nodeL(c, x.conn) + ': select the target step, or drag from a handle to a step' : '';
  const roL = !isDraft ? vx.st + ' versions are read-only.' + (upd ? (dv ? ' Open draft ' + dv.v + ' to make changes.' : ' Create a draft to make changes.') : '') : '';
  const grid = editable ? 'radial-gradient(circle, var(--border-subtle) 1px, transparent 1px) 0 0 / 16px 16px' : 'var(--surface-sunken)';

  return (
    <div data-designer="1" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* toolbar */}
      <div data-dsg-toolbar="1" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
          Version
          <select aria-label="Version" value={vsel + ' · ' + vx.st} onChange={(e) => setVer(e.target.value.split(' · ')[0])} style={{ ...inp, height: 30, width: 'auto', padding: '0 6px', fontSize: 13 }}>
            {vers.map((v) => (
              <option key={v.v}>{v.v + ' · ' + v.st}</option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Mode" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 'var(--r-sm)', background: 'var(--surface-sunken)' }}>
          {([['design', 'Design'], ['test', 'Test'], ['replay', 'Replay']] as [DsgMode, string][]).map(([k, l]) => (
            <button key={k} type="button" data-mode={k} aria-pressed={mode === k} onClick={() => setMode(k)} style={{ border: 0, font: 'inherit', fontSize: 12.5, height: 26, padding: '0 12px', borderRadius: 5, cursor: 'pointer', background: mode === k ? 'var(--surface-card)' : 'transparent', color: mode === k ? 'var(--text-strong)' : 'var(--text-muted)', fontWeight: mode === k ? 600 : 500, boxShadow: mode === k ? '0 1px 2px rgba(31,26,28,.12)' : 'none' }}>
              {l}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {editable && <TbBtn l="↶" t="Undo" f={undo} off={!x.hist.length} ic />}
        {editable && <TbBtn l="↷" t="Redo" f={redo} off={!x.fut.length} ic />}
        <TbBtn l="−" t="Zoom out" f={() => setZoom(zoom - 0.1)} ic />
        <TbBtn l={Math.round(zoom * 100) + '%'} t="Reset zoom" f={() => setZoom(1)} />
        <TbBtn l="+" t="Zoom in" f={() => setZoom(zoom + 0.1)} ic />
        <TbBtn l="Fit" t="Fit to screen" f={fit} />
        {editable && <TbBtn l="Auto layout" f={() => edit((cc) => { cc.pos = wfLayout(cc); })} />}
        <TbBtn l={x.tools ? 'Hide tools' : 'Show tools'} f={() => put({ ...x, tools: !x.tools })} />
        {editable && <TbBtn l="Validate" f={validate} />}
        {editable && <TbBtn l="Save draft" f={() => hub.saveDesign(w, vsel, c, errs.length)} off={!x.dirty} pri />}
        {!isDraft && upd && (dv ? <TbBtn l={'Open draft ' + dv.v} f={() => hub.setVer(w, dv.v)} pri /> : <TbBtn l="Create draft" f={() => hub.a.createDraft(w, '', true)} pri />)}
        {isDraft && upd && <TbBtn l="Publish" t={x.dirty ? 'Save the draft first' : 'Publish this draft after a passing evaluation'} f={() => hub.a.publish(w)} off={x.dirty} />}
      </div>
      {/* status */}
      <div data-dsg-status="1" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', fontSize: 12.5, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
        <span>{status}</span>
        <button type="button" data-issues="1" onClick={validate} style={{ border: 0, background: 'none', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: errs.length ? 'var(--danger)' : warns.length ? 'var(--text-muted)' : 'var(--success)', cursor: 'pointer', padding: 0 }}>
          {issL}
        </button>
      </div>
      {!isDraft && <div style={{ padding: '8px 14px', fontSize: 12.5, color: 'var(--info)', background: 'var(--info-bg)', borderBottom: '1px solid var(--border-subtle)' }}>{roL}</div>}
      {connL && (
        <div data-conn="1" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 14px', fontSize: 12.5, color: 'var(--brand)', background: 'var(--brand-tint)', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ flex: 1 }}>{connL}</span>
          <button type="button" onClick={() => put({ ...x, conn: null })} style={{ border: 0, background: 'none', font: 'inherit', fontSize: 12.5, color: 'var(--brand)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: (showLeft ? '220px ' : '') + 'minmax(0,1fr) 280px', minHeight: 540 }}>
        {showLeft && (
          <div data-dsg-left="1" style={{ borderRight: '1px solid var(--border-subtle)', padding: 12, overflow: 'auto', maxHeight: 660, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {left}
          </div>
        )}
        {/* canvas */}
        <div data-canvas-wrap="1" ref={wrapRef} onClick={bgClick} onDragOver={(e) => { if (editable) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }} onDrop={onDrop} style={{ overflow: 'auto', maxHeight: 660, background: grid, padding: 16 }}>
          <div style={{ position: 'relative', width: W * zoom, height: H * zoom }}>
            <div ref={planeRef} data-canvas="1" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, display: 'block', overflow: 'visible' }}>
                {geo.map(({ e, g }, j) => {
                  const col = EDGE_C[e.tone ?? ''] ?? 'var(--text-subtle)';
                  return (
                    <g key={j}>
                      <path d={g.d} style={{ fill: 'none', stroke: col, strokeWidth: 1.5, strokeDasharray: e.dash || undefined }} />
                      {g.ah && <polygon points={g.ah} style={{ fill: col }} />}
                      {e.i >= 0 && <path d={g.d} data-edge={e.i} onClick={(ev) => { ev.stopPropagation(); click('e:' + e.i); }} style={{ fill: 'none', stroke: 'transparent', strokeWidth: 12, cursor: 'pointer' }} />}
                    </g>
                  );
                })}
                {wire && wireFrom && <path d={`M${wireFrom.x + wireFrom.w},${wireFrom.y + wireFrom.h / 2} L${wire.x},${wire.y}`} style={{ fill: 'none', stroke: 'var(--brand)', strokeWidth: 1.5, strokeDasharray: '4 3' }} />}
              </svg>
              {geo.map(({ e, g }, j) =>
                e.l ? (
                  <span key={'l' + j} style={{ position: 'absolute', left: g.lx, top: g.ly, transform: 'translate(-50%,-50%)', fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-card)', padding: '0 3px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                    {cut(e.l, 26)}
                  </span>
                ) : null,
              )}
              {geo.filter(({ e }) => e.i >= 0 && c.edges[e.i]).map(({ e, g }) => {
                const on = x.sel === 'e:' + e.i;
                const bad = showIds.has('e:' + e.i);
                const ed = c.edges[e.i];
                const sz = on ? 14 : 11;
                const lbl = 'Connection ' + nodeL(c, ed[0]) + ' to ' + nodeL(c, ed[1]);
                return (
                  <button
                    key={'h' + e.i}
                    type="button"
                    data-edge={e.i}
                    aria-label={lbl}
                    title={lbl}
                    onClick={(ev) => { ev.stopPropagation(); click('e:' + e.i); }}
                    style={{ position: 'absolute', left: g.lx, top: g.ly + (e.ortho ? 6 : 0), transform: 'translate(-50%,' + (e.l ? '70%' : '-50%') + ')', width: sz, height: sz, borderRadius: 7, boxSizing: 'border-box', padding: 0, background: on ? 'var(--brand)' : bad ? 'var(--danger)' : 'var(--surface-card)', border: '1.5px solid ' + (on ? 'var(--brand)' : bad ? 'var(--danger)' : 'var(--border-strong)'), cursor: 'pointer', zIndex: 2 }}
                  />
                );
              })}
              {spec.nodes.map((n) => {
                const t = TONE[n.tone ?? 'base'];
                const isSel = !!n.sel;
                const isTool = !n.id.startsWith('n:');
                return (
                  <div
                    key={n.id}
                    data-node={n.id}
                    title={n.l1 + (n.l2 ? ' · ' + n.l2 : '')}
                    onPointerDown={(e) => onNodeDown(e, n)}
                    onClick={(e) => { e.stopPropagation(); if (!isTool) click(n.id); }}
                    style={{
                      position: 'absolute', boxSizing: 'border-box', left: n.x, top: n.y, width: n.w, height: n.h, background: t[0],
                      border: (isSel ? 2.5 : 1.25) + 'px ' + (t[4] && !isSel ? 'dashed' : 'solid') + ' ' + (isSel ? 'var(--brand)' : t[1]), borderRadius: 8,
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 5px', overflow: 'hidden',
                      cursor: isTool ? 'default' : editable ? 'move' : 'pointer', userSelect: 'none', touchAction: 'none', boxShadow: isSel ? '0 0 0 3px rgba(138,21,56,.14)' : undefined,
                      zIndex: drag && 'n:' + drag.id === n.id ? 4 : 1, transition: n.tone === 'run' ? 'background .2s' : undefined,
                    }}
                  >
                    <div style={{ maxWidth: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: t[2], fontSize: 12.5, fontWeight: 600, lineHeight: 1.25 }}>{cut(n.l1, 60)}</div>
                    {n.l2 && <div style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: t[3], fontSize: 11, lineHeight: 1.3 }}>{cut(n.l2, 60)}</div>}
                  </div>
                );
              })}
              {ports.map((n) => {
                const id = n.id.slice(2);
                const lbl = 'Connect from ' + n.l1;
                return (
                  <span
                    key={'p' + id}
                    data-port={id}
                    title={lbl}
                    aria-label={lbl}
                    role="button"
                    onPointerDown={(e) => onPortDown(e, id)}
                    style={{ position: 'absolute', left: n.x + n.w, top: n.y + n.h / 2, transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: 7, boxSizing: 'border-box', background: x.conn === id ? 'var(--brand)' : 'var(--surface-card)', border: '2px solid var(--brand)', cursor: 'crosshair', zIndex: 3, touchAction: 'none' }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        {/* properties */}
        <div data-props="1" style={{ borderLeft: '1px solid var(--border-subtle)', padding: 14, overflow: 'auto', maxHeight: 660, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-strong)' }}>{pt}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{ps}</div>
          </div>
          {piss.map((q, i) => (
            <button key={i} type="button" data-issue="1" onClick={q.f} style={{ textAlign: 'left', border: 0, borderLeft: '3px solid ' + q.fg, background: 'var(--surface-sunken)', padding: '6px 8px', borderRadius: 4, font: 'inherit', fontSize: 12.5, color: 'var(--text-body)', cursor: q.f ? 'pointer' : 'default' }}>
              {q.m}
            </button>
          ))}
          {pf.map((f) => (
            <Field key={f.label} f={f} />
          ))}
          {pkv.map((q) => (
            <div key={q.k} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5, padding: '5px 0', borderBottom: '1px dashed var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{q.k}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{q.v}</span>
            </div>
          ))}
          {pacts.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {pacts.map((a) => (
                <Button key={a.l} size="xs" variant={a.v || 'outline'} onClick={a.f}>
                  {a.l}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', padding: '8px 14px', borderTop: '1px solid var(--border-subtle)' }}>
        {spec.legend.map(([l, tone]) => {
          const t = TONE[tone];
          return (
            <span key={l} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={{ display: 'inline-block', width: 14, height: 10, borderRadius: 3, background: t[0], border: '1.25px ' + (t[4] ? 'dashed' : 'solid') + ' ' + t[1] }} />
              {l}
            </span>
          );
        })}
      </div>
    </div>
  );
}

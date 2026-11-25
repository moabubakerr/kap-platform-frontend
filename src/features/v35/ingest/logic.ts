/**
 * Data Ingestion Hub domain helpers (port of the helpers at the top of the
 * prototype's `ingestHub`): source locations, input kind, outputs, triggers,
 * the simulated connection test and run execution, and the pipeline flow
 * diagram. Pure functions over the hub data.
 */
import type { DiagramEdge, DiagramNode, DiagramSpec, DsStatus } from '@/engine/types';
import type { IngestTenant, PipeCfg, Pipeline, Run, RunItem, Source, Stage } from '@/v35/data/ingest';
import type { LivePipeCfg } from './fromKap';

export type Kind = 'Structured' | 'Unstructured' | 'Mixed';

export const SRC_TYPES = ['S3', 'Microsoft SQL Server', 'Data warehouse · Azure Synapse', 'Data warehouse · Snowflake', 'Data warehouse · Google BigQuery', 'REST API', 'File repository'];

export const IMPL = (x: string): [DsStatus, string] => (x === 'Implemented' ? ['approved', 'Implemented'] : x === 'Simulated' ? ['draft', 'Simulated'] : ['submitted', 'Planned']);
export const IMPL_SUB = (x: string) => (x === 'Implemented' ? 'Supported by the current backend' : 'Needs backend work; the console simulates it');

export const stP = (s: string): DsStatus => (({ Succeeded: 'approved', 'Partially succeeded': 'hold', Failed: 'rejected', Running: 'submitted', Queued: 'draft', Cancelled: 'draft' }) as Record<string, DsStatus>)[s] ?? 'draft';
export const srcP = (s: string): [DsStatus, string] => (({ Connected: ['approved', 'Connected'], Failed: ['rejected', 'Failed'], 'Not tested': ['draft', 'Not tested'], Disabled: ['draft', 'Disabled'] }) as Record<string, [DsStatus, string]>)[s] ?? ['draft', s];
export const onP = (on: boolean): [DsStatus, string] => (on ? ['approved', 'Enabled'] : ['draft', 'Disabled']);

/** Where a source points (prototype `ihLoc`). */
export function ihLoc(s: Pick<Source, 'type' | 'cfg'>): string {
  const c = s.cfg || {};
  switch (s.type) {
    case 'S3':
      return `s3://${c.bucket}${c.base && c.base !== '/' ? c.base : ''} · ${c.endpoint}`;
    case 'Microsoft SQL Server':
    case 'PostgreSQL':
      return `${c.server}:${c.port} / ${c.db}`;
    case 'Data warehouse · Azure Synapse':
      return `${c.endpoint} / ${c.pool}`;
    case 'Data warehouse · Snowflake':
      return `${c.account} / ${c.db}.${c.schema}`;
    case 'Data warehouse · Google BigQuery':
      return `${c.project}.${c.dataset}`;
    case 'REST API':
      return c.url;
    default:
      return (c.repo ? `${c.repo} · ` : '') + c.path;
  }
}

export const srcOf = (H: IngestTenant, id: string | undefined) => H.sources.find((s) => s.id === id) ?? null;
export const pipeOf = (H: IngestTenant, id: string | undefined) => H.pipelines.find((p) => p.id === id) ?? null;
export const srcType = (H: IngestTenant, v: Pick<PipeCfg, 'src'>) => (v.src === 'manual' ? 'Manual upload' : srcOf(H, v.src)?.type ?? '—');
export const srcName = (v: Pick<PipeCfg, 'src'>) => (v.src === 'manual' ? 'Manual upload' : v.src);
export const isFile = (ty: string) => ty === 'S3' || ty === 'File repository' || ty === 'Manual upload';
export const isDb = (ty: string) => ty === 'Microsoft SQL Server' || (ty || '').startsWith('Data warehouse');

const STRX = /\.(csv|xlsx|json|parquet)\b|\*\.(csv|xlsx|json|parquet)/i;
const UNSX = /\.(pdf|docx|html|txt|eml|pptx)\b|\*\.(pdf|docx|html|txt|eml|pptx)/i;

export function kindOf(H: IngestTenant, v: Partial<PipeCfg> & { src?: string }): Kind {
  const kk = (v as LivePipeCfg).kap?.kind;
  if (kk) return kk === 'indicators' ? 'Structured' : 'Unstructured';
  const ty = v.src === 'manual' ? 'Manual upload' : srcOf(H, v.src)?.type ?? '';
  if (isDb(ty)) return 'Structured';
  if (ty === 'REST API') return (v.resp || '').startsWith('Records') ? 'Structured' : 'Unstructured';
  const s = v.src === 'manual' ? (v.files || []).join(' ') : v.pat || '';
  const a = STRX.test(s);
  const b = UNSX.test(s);
  return a && b ? 'Mixed' : a ? 'Structured' : b ? 'Unstructured' : 'Mixed';
}
export const outOf = (H: IngestTenant, v: Partial<PipeCfg>) => {
  const k = kindOf(H, v);
  return k === 'Mixed' ? 'Structured and Unstructured Data' : `${k} Data`;
};
export const trigOf = (v: Pick<PipeCfg, 'trig' | 'sched' | 'ev'>) => (v.trig === 'Schedule' ? v.sched ?? '' : v.trig === 'Event' ? `Event · ${v.ev}` : v.trig);
export const runsOf = (H: IngestTenant, pid: string) => H.runs.filter((r) => r.pipe === pid);
export const nextRunId = (H: IngestTenant) => `R-${String(Math.max(0, ...H.runs.filter((r) => /^R-\d+$/.test(r.id)).map((r) => +r.id.slice(2))) + 1).padStart(4, '0')}`;
/** Pipelines that read from source `sid` (live pipelines read from every connector of their collections). */
export const usesSource = (p: Pipeline, sid: string) => p.v.src === sid || !!(p.v as LivePipeCfg).kap?.conns.includes(sid);

/** Why a pipeline cannot run now ('' = it can). */
export function blockedBy(H: IngestTenant, p: Pipeline): string {
  const s = p.v.src !== 'manual' ? srcOf(H, p.v.src) : null;
  return !p.on ? 'Pipeline is disabled' : s && s.st === 'Failed' ? 'Data source failed its connection test' : s && s.st === 'Disabled' ? 'Data source is disabled' : '';
}

// ------------------------------------------------------------------ connection test (simulated)
export function testConn(type: string, cfg: Record<string, unknown>): { ok: boolean; msg: string } {
  const blob = JSON.stringify(cfg).toLowerCase();
  const fail = /fs01|denied|invalid|unknown/.test(blob);
  if (fail)
    return {
      ok: false,
      msg: `${
        type === 'File repository'
          ? `Access denied: the service identity cannot read ${(cfg.path as string) || 'the path'}`
          : type === 'Microsoft SQL Server'
            ? 'Login failed for the configured user (error 18456).'
            : type.startsWith('Data warehouse')
              ? 'The warehouse rejected the credentials (AADSTS7000215: invalid client secret).'
              : type === 'REST API'
                ? 'The test endpoint returned HTTP 401 Unauthorized.'
                : 'Access denied when listing the bucket (403).'
      } Simulated result.`,
    };
  return {
    ok: true,
    msg: `${
      type === 'S3'
        ? 'Bucket listed; base path readable.'
        : type === 'Microsoft SQL Server'
          ? 'Connected with TLS; 3 schemas and 12 tables discovered.'
          : type.startsWith('Data warehouse')
            ? 'Connected; schema readable; 4 tables, 2 views and 1 saved query available.'
            : type === 'REST API'
              ? 'Test endpoint returned HTTP 200 in 220 ms.'
              : 'Path readable; 14 files visible.'
    } Simulated result.`,
  };
}

// ------------------------------------------------------------------ run simulation
export interface RunOpts {
  retryOf?: string;
  files?: string[];
  trig?: string;
}

const clock = () => new Date().toLocaleTimeString('en-GB');

/** A new queued run for pipeline `pid` (prototype `simulate`, first part). */
export function queueRun(H: IngestTenant, pid: string, actor: string, opts: RunOpts = {}, time = clock()): Run {
  const p = pipeOf(H, pid)!;
  const id = nextRunId(H);
  const ty = srcType(H, p.v);
  const v = p.v;
  const kind = kindOf(H, v);
  const retryOf = opts.retryOf ? H.runs.find((r) => r.id === opts.retryOf) ?? null : null;
  const base = retryOf ? retryOf.items.filter((x) => x.res === 'Failed' && x.retry) : null;
  const prev = runsOf(H, pid).find((r) => !r.retryOf && r.items.length && r.st !== 'Running');
  const files = opts.files ?? v.files;
  const fresh = (n: string): RunItem => ({ n, path: v.src === 'manual' ? 'Upload batch' : v.path || '', ty: (n.split('.').pop() || '').toUpperCase(), size: '—', res: 'Queued', err: '', retry: true, parent: '' });
  const cext = ((v.pat || '*.pdf').match(/\*\.(\w+)/) || [0, 'pdf'])[1];
  const expand = (arr: string[]): RunItem[] =>
    arr.flatMap((n) => {
      if (!(/\.zip$/i.test(n) && v.zip !== 'No')) return [fresh(n)];
      const last = n.split('/').pop()!;
      const b = last.replace(/\.zip$/i, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      const ext = v.src === 'manual' ? 'pdf' : cext;
      return [{ ...fresh(last), ty: 'ZIP archive' }, ...[1, 2, 3].map((i) => ({ ...fresh(`${b}_part${i}.${ext}`), parent: last, path: `${last} › ${b}_part${i}.${ext}` }))];
    });
  const items: RunItem[] = base
    ? base.map((x) => ({ ...x, res: 'Queued', want: 'Succeeded' }))
    : v.src === 'manual'
      ? expand(files || [])
      : prev
        ? prev.items.map((x) => ({ ...x, want: x.res === 'Failed' ? 'Failed' : 'Succeeded', res: 'Queued' }))
        : isDb(ty)
          ? v.query && v.query !== 'None'
            ? [{ n: v.query, path: 'Saved query', ty: 'Query', size: '—', res: 'Queued', err: '', retry: false, parent: '' }]
            : (v.objs || []).map((o) => ({ n: o, path: (v.ext || 'Full refresh') + (v.wm ? ` · ${v.wm}` : ''), ty: /vw_|view/i.test(o) ? 'View' : 'Table', size: '—', res: 'Queued', err: '', retry: false, parent: '' }))
          : ty === 'REST API'
            ? [{ n: v.path || '/', path: srcOf(H, v.src)?.cfg.url ?? '', ty: 'API pages', size: '—', res: 'Queued', err: '', retry: true, parent: '' }]
            : v.zip === 'Yes' && v.sel === 'Single file'
              ? expand([v.path || ''])
              : (kind === 'Mixed' ? [`${pid}_1.csv`, `${pid}_2.pdf`] : kind === 'Unstructured' ? [`${pid}_1.pdf`, `${pid}_2.docx`] : [`${pid}_1.csv`, `${pid}_2.csv`]).map(fresh);
  return {
    id,
    pipe: pid,
    trig: opts.trig || `Manual · ${actor}`,
    start: 'just now',
    dur: '—',
    st: 'Queued',
    inN: `${items.length}${items.length === 1 ? ' item' : ' items'}`,
    outN: '—',
    errN: 0,
    stages: [],
    items,
    logs: [[time, 'INFO', `Run queued by ${actor}${retryOf ? ` · retry of ${retryOf.id} (failed items only)` : ''}`]],
    outDs: [],
    outDocs: [],
    batch: v.src === 'manual' ? { id: `U-${id.slice(2)}`, kind: 'Manual upload batch', inv: (v.files || []).join(', '), sum: `${(v.files || []).length} checksums recorded`, ver: 'Upload' } : null,
    retryOf: retryOf ? retryOf.id : '',
  };
}

/** Worker picked the run up. */
export function startRun(r: Run, time = clock()) {
  r.st = 'Running';
  r.dur = 'running';
  r.items.forEach((x) => {
    x.res = 'Running';
  });
  r.logs.push([time, 'INFO', 'Worker picked up the run on kap.pipeline']);
}

/**
 * Finish run `id` in tenant draft `H`: item results, stages, and publishing —
 * structured outputs become or update datasets, documents become or update
 * documents; collections only if configured. Returns the summary message.
 */
export function finishRun(H: IngestTenant, id: string, time = clock()): string {
  const r = H.runs.find((x) => x.id === id);
  if (!r) return '';
  const p = pipeOf(H, r.pipe);
  const v = p?.v ?? ({ src: '', sSteps: [], uSteps: [], colls: [], trig: '' } as PipeCfg);
  const kind = kindOf(H, v);
  const steps = (kind === 'Unstructured' ? [] : v.sSteps || []).concat(kind === 'Structured' ? [] : v.uSteps || []);
  r.items.forEach((x) => {
    if (x.want === 'Failed') x.res = 'Failed';
    else {
      x.res = 'Succeeded';
      x.err = '';
    }
    delete x.want;
  });
  const nf = r.items.filter((x) => x.res === 'Failed').length;
  const nk = r.items.length - nf;
  r.st = !nf ? 'Succeeded' : nk ? 'Partially succeeded' : 'Failed';
  r.dur = `${8 + r.items.length * 3} s`;
  r.errN = nf;
  const failStage = steps.find((x) => /extraction|Parse|API/.test(x)) || steps[0];
  const stages: Stage[] = v.zip === 'Yes' ? [['Archive extraction', 'Succeeded', '2 s', r.items.filter((x) => x.parent).length || r.items.length, 0, '']] : [];
  r.stages = stages.concat(
    steps.map((sn): Stage => [
      sn,
      sn === failStage && nf ? (nk ? 'Partially succeeded' : 'Failed') : nk ? 'Succeeded' : 'Cancelled',
      '1 s',
      nk,
      sn === failStage ? nf : 0,
      sn === failStage && nf ? r.items.filter((x) => x.res === 'Failed').map((x) => `${x.n}: ${x.err}`).join(' · ') : '',
    ]),
  );
  if (nf) r.items.filter((x) => x.res === 'Failed').forEach((x) => r.logs.push([time, 'ERROR', `${x.n}: ${x.err}`]));
  const ds: string[] = [];
  const docs: string[] = [];
  r.items
    .filter((x) => x.res === 'Succeeded' && !/ZIP archive|API page/.test(x.ty))
    .forEach((x) => {
      const isDoc = /\.(pdf|docx|html|txt|eml|pptx)$/i.test(x.n) || (kind === 'Unstructured' && !/\.(csv|xlsx|json)$/i.test(x.n));
      if (isDoc) {
        const did = /\./.test(x.n) ? x.n : `${x.n}.json`;
        docs.push(did);
        if (!H.pub.documents.includes(did)) H.pub.documents.push(did);
      } else {
        const base0 = (/^(Table|View|Query)$/.test(x.ty) ? x.n.split('.').pop()! : x.n.replace(/\.\w+$/, '')).replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
        const dsid = (v.dsName || '{file}').replace('{file}', base0).replace('{table}', base0.replace(/^vw_/, ''));
        if (!ds.includes(dsid)) ds.push(dsid);
        if (!H.pub.datasets.includes(dsid)) H.pub.datasets.push(dsid);
      }
    });
  (v.colls || []).forEach((cid) => {
    const c = H.pub.colls.find((y) => y.id === cid);
    if (!c) return;
    ds.forEach((x) => {
      if (!c.ds.includes(x)) c.ds.push(x);
    });
    docs.forEach((x) => {
      if (!c.docs.includes(x)) c.docs.push(x);
    });
  });
  r.outDs = ds;
  r.outDocs = docs;
  r.outN = [ds.length ? `${ds.length}${ds.length === 1 ? ' dataset' : ' datasets'}` : '', docs.length ? `${docs.length}${docs.length === 1 ? ' document' : ' documents'}` : ''].filter(Boolean).join(' · ') || 'No changes';
  r.logs.push([time, 'INFO', `Published ${r.outN}${(v.colls || []).length ? ` · referenced by ${v.colls.join(', ')}` : ' · no collection configured'}`]);
  if (r.retryOf) {
    const o = H.runs.find((x) => x.id === r.retryOf);
    if (o) o.logs.push([time, 'INFO', `Failed items retried in ${id} (${r.st.toLowerCase()})`]);
  }
  return `${id} ${r.st.toLowerCase()}: ${r.outN}${nf ? ` · ${nf} failed` : ''}.`;
}

// ------------------------------------------------------------------ pipeline flow diagram
export const ENT_U = 'Entity and relationship extraction';
export const ENT_S = 'Entity mapping';
export const STR_ALL = (f: string) => [f, 'Schema detection and mapping', 'Validation', 'Normalization and deduplication', ENT_S, 'Load structured records'];
export const UNS_ALL = ['File validation', 'Antivirus scan', 'Text extraction / OCR', 'Language detection and normalization', 'Translation', 'Chunking', ENT_U, 'Embedding generation', 'Vector indexing'];
export const UNS_REQ = ['Text extraction / OCR', 'Chunking', 'Embedding generation', 'Vector indexing'];
export const firstStep = (ty: string) => (isDb(ty) ? 'Database extraction' : ty === 'REST API' ? 'API response parsing' : 'Parse files');

export function stageCfg(s0: string, v: Partial<PipeCfg>): string {
  const kap = (v as LivePipeCfg).kap;
  if (kap) return kap.stages.find((x) => x.n === s0)?.cfg ?? '—';
  if (s0 === 'Chunking') return v.chunk ?? '—';
  if (s0.startsWith('Embedding')) return 'embed-prod · qwen3-embedding';
  if (s0 === 'Vector indexing') return 'Tenant vector index';
  if (s0 === 'Load structured records') return (v.mode || '—') + (v.dsName ? ` · ${v.dsName}` : '');
  if (s0 === 'Validation') return 'Types, required fields, duplicates';
  if (s0 === 'Language detection and normalization') return 'Per-language rules';
  if (s0 === 'Antivirus scan') return 'ClamAV';
  if (s0 === ENT_U || s0 === ENT_S) return `${(v.entTypes || []).join(', ') || 'No entity types'} · confidence ≥ ${v.entConf || '0.70'}`;
  if (s0 === 'Translation') return 'To the tenant answer language';
  return '—';
}

type Tone = NonNullable<DiagramNode['tone']>;
export interface DgmOpts {
  stages?: Stage[];
  runSt?: string;
  sel?: string | null;
  click?: (id: string, tab: string) => void;
  compact?: boolean;
  per?: number;
}

export function pipeDgm(v: Partial<PipeCfg>, ty: string, kind: Kind, o: DgmOpts = {}): DiagramSpec {
  const RS = o.stages ? Object.fromEntries(o.stages.map((x) => [x[0], x])) : null;
  const first = firstStep(ty);
  const stTone = (st: string): Tone => (({ Succeeded: 'ok', Failed: 'bad', 'Partially succeeded': 'warn', Running: 'run', Skipped: 'skip', Pending: 'skip' }) as Record<string, Tone>)[st] ?? 'skip';
  const NW = 140, NH = 52, GX = 24, GY = 22, SX = NW + GX, SY = NH + GY, PER = o.per || 5;
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const node = (id: string, x: number, y: number, l1: string, l2: string, tone: Tone, tab: string, w?: number) => {
    nodes.push({ id, x, y, w: w || NW, h: NH, l1, l2, tone, sel: o.sel === id, click: o.click ? () => o.click!(id, tab) : undefined });
    return id;
  };
  const laneItems = (all: string[], on: string[]) =>
    all
      .filter((n0) => (RS ? RS[n0] || on.includes(n0) : on.includes(n0) || !o.compact))
      .map((n0) => {
        const en = on.includes(n0);
        const r = RS && RS[n0];
        const st = r ? r[1] : RS ? (o.runSt === 'Queued' || o.runSt === 'Running' ? 'Pending' : 'Skipped') : '';
        return {
          n0,
          en: en || !!r,
          l2: r ? r[1] + (r[4] ? ` · ${r[4]} failed` : '') : RS ? st : en ? (n0 === ENT_U || n0 === ENT_S ? `${(v.entTypes || []).length} entity types` : 'On') : 'Off · optional',
          tone: (RS ? stTone(st) : en ? 'base' : 'off') as Tone,
          bad: !!r && r[1] === 'Failed',
        };
      });
  // a KAP pipeline's stages are its own (name · type), not the design's catalogue
  const kapL = (v as LivePipeCfg).kap?.stages.map((x) => x.n);
  const sAll = kapL ?? STR_ALL(first);
  const uAll = kapL ?? UNS_ALL;
  const lanes: [string, ReturnType<typeof laneItems>][] = [];
  if (kind !== 'Unstructured') lanes.push(['s', laneItems(sAll, v.sSteps || [])]);
  if (kind !== 'Structured') lanes.push(['d', laneItems(uAll, v.uSteps || [])]);
  const pre = RS ? o.stages!.map((s0) => s0[0]).filter((n0) => !sAll.includes(n0) && !uAll.includes(n0)) : v.zip === 'Yes' ? ['Archive extraction'] : [];
  const rowsOf = (it: unknown[]) => Math.max(1, Math.ceil(it.length / PER));
  let y = 10;
  const laneY = lanes.map(([, it]) => {
    const y0 = y;
    y += rowsOf(it) * SY + 6;
    return y0;
  });
  const yIn = lanes.length > 1 ? (laneY[0] + laneY[1]) / 2 : laneY[0] || 10;
  let prev = node('in', 10, yIn, v.src === 'manual' ? 'Manual upload' : v.src || 'Data source', ty || 'Input', 'brand', 'input');
  let x0 = 10 + SX;
  pre.forEach((n0) => {
    const r = RS && RS[n0];
    const id = node(`st:${n0}`, x0, yIn, n0, r ? r[1] : 'On', r ? stTone(r[1]) : 'base', 'input');
    edges.push({ a: prev, b: id, ortho: true, tone: r && r[1] === 'Failed' ? 'bad' : undefined });
    prev = id;
    x0 += SX;
  });
  const xo = x0 + PER * SX;
  const outIds: string[] = [];
  const outTone: Tone = RS ? (o.runSt === 'Succeeded' ? 'ok' : o.runSt === 'Partially succeeded' ? 'warn' : o.runSt === 'Failed' ? 'bad' : 'skip') : 'out';
  lanes.forEach(([k, it], li) => {
    let p = prev;
    it.forEach((s0, i) => {
      const row = Math.floor(i / PER), col = i % PER;
      const y0 = laneY[li] + row * SY;
      const id = node(`st:${s0.n0}`, x0 + col * SX, y0, s0.n0, s0.l2, s0.tone, 'processing');
      const pn = nodes.find((n) => n.id === p)!;
      const sty: Partial<DiagramEdge> = { dash: s0.en ? undefined : '4 3', tone: s0.en ? (s0.bad ? 'bad' : undefined) : 'off' };
      edges.push(p !== prev && pn.y !== y0 ? { a: p, b: id, wrap: true, ...sty } : { a: p, b: id, ortho: true, ...sty });
      if (s0.en) p = id;
    });
    const last = laneY[li] + (rowsOf(it) - 1) * SY;
    const oid = node(k === 's' ? 'out:sd' : 'out:ud', xo, last, k === 's' ? 'Structured Data' : 'Unstructured Data', k === 's' ? v.dsName || 'dataset' : 'documents', outTone, 'output');
    edges.push({ a: p, b: oid, ortho: true });
    outIds.push(oid);
  });
  const entOn = (v.uSteps || []).includes(ENT_U) || (v.sSteps || []).includes(ENT_S) || (RS && (RS[ENT_U] || RS[ENT_S]));
  if (entOn) {
    const id = node('out:es', xo, y, 'Entity Store', `${(v.entTypes || []).length} entity types`, outTone, 'processing');
    [ENT_U, ENT_S].filter((n0) => nodes.some((n) => n.id === `st:${n0}`)).forEach((n0) => edges.push({ a: `st:${n0}`, b: id, tone: 'brand', dash: '3 3' }));
  }
  const cs = v.colls || [];
  const ys = nodes.filter((n) => outIds.includes(n.id)).map((n) => n.y);
  const yc = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : yIn;
  const cid = node('out:coll', xo + SX + 10, yc, cs.length ? 'Collections' : 'No collections', cs.length ? cs.join(', ') : 'optional', cs.length ? 'ref' : 'off', 'output', 150);
  outIds.forEach((id) => edges.push({ a: id, b: cid, ortho: true, dash: '5 4', tone: 'ref' }));
  return {
    nodes,
    edges,
    legend: RS
      ? [['Succeeded', 'ok'], ['Partially succeeded', 'warn'], ['Failed', 'bad'], ['Running', 'run'], ['Pending or skipped', 'skip']]
      : [['Input', 'brand'], ['Enabled stage', 'base'], ['Optional stage not enabled', 'off'], ['Output', 'out'], ['Reference only', 'ref']],
  };
}

/** Readable name of a selected diagram node. */
export const nodeLabel = (sel: string) =>
  sel.replace(/^st:|^out:/, '').replace(/^sd$/, 'Structured Data').replace(/^ud$/, 'Unstructured Data').replace(/^es$/, 'Entity Store').replace(/^coll$/, 'Collections').replace(/^in$/, 'Input');

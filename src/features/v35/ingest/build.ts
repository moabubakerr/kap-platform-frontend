/**
 * Data Ingestion Hub (v35): Data Sources, Ingestion Pipelines and Ingestion
 * Runs as ScreenModels. Port of the prototype's `ingestHub` screens
 * (iSources, iSource, iPipes, iPipe, iRuns, iRun). Pure: data, filters,
 * permissions and callbacks in; model out.
 */
import { act, cell, fr } from '@/engine/build';
import type { Action, Filters, PageHead, Row, ScreenModel, Section } from '@/engine/types';
import type { IngestTenant, Pipeline, Run, Source } from '@/v35/data/ingest';
import {
  blockedBy, IMPL, IMPL_SUB, ihLoc, isDb, isFile, kindOf, nodeLabel, onP, outOf, pipeDgm, pipeOf, runsOf, SRC_TYPES, srcName, srcOf, srcP,
  srcType, stageCfg, stP, STR_ALL, trigOf, usesSource,
} from './logic';
import { isSess, kapOfPipe, kapOfRun, kapOfSource } from './fromKap';
import { pgOfRun, pgOfSource } from './pgView';

export interface IngestNav {
  sources: () => void;
  pipes: () => void;
  runs: () => void;
  source: (id: string, tab?: string) => void;
  pipe: (id: string, tab?: string) => void;
  run: (id: string, tab?: string) => void;
  dataset: (id: string) => void;
  document: (id: string) => void;
  collection: (id: string) => void;
  security: () => void;
}

export interface IngestActs {
  addSource: () => void;
  editSource: (s: Source) => void;
  testSource: (s: Source) => void;
  toggleSource: (s: Source) => void;
  addPipe: (fromSource?: Source) => void;
  editPipe: (p: Pipeline) => void;
  togglePipe: (p: Pipeline) => void;
  runNow: (pid: string) => void;
  retryFailed: (r: Run) => void;
  retryRun: (r: Run) => void;
  /** live tenant: ask KAP to stop a waiting or running job */
  cancelRun?: (r: Run) => void;
}

export interface IngestCtx {
  H: IngestTenant;
  /** data:manage on any collection: create, edit, test, enable or disable */
  canData: boolean;
  /** pipeline:execute on the tenant (or data:manage): run and retry */
  canRun: boolean;
  /** tenant:configure: open Security & Credentials */
  canConfigure: boolean;
  /** the tenant is live: KAP records carry `kap`, session-only ones `sess` */
  live?: boolean;
  go: IngestNav;
  a: IngestActs;
}

export type ListFilters = Record<string, string>;

const anyOk = (F: ListFilters, k: string, val: string) => !F[k] || F[k].startsWith('Any') || F[k] === val;
const qOk = (F: ListFilters, hay: string) => !F.q || hay.toLowerCase().includes(F.q.toLowerCase());

function filterBar(F: ListFilters, setF: (f: ListFilters) => void, defs: [string, string, string[]][]): Filters {
  const chips = defs.filter(([k, , opts]) => F[k] && F[k] !== opts[0]).map(([k, , ]) => ({ l: F[k], x: () => setF({ ...F, [k]: '' }) }));
  return {
    q: F.q ?? '',
    qLabel: 'Search by name',
    setQ: (q) => setF({ ...F, q }),
    main: defs.map(([k, label, opts]) => ({ label, value: F[k] || opts[0], options: opts, onChange: (v: string) => setF({ ...F, [k]: v }) })),
    chips,
    clear: () => setF({}),
  };
}

/** Implementation label: KAP-backed, planned, or (live tenant) session only. */
const implL = (x: Source | Pipeline) => (isSess(x) ? 'Session only' : x.impl);
const implSub = (x: Source | Pipeline) => (isSess(x) ? 'Not available in KAP: kept in this browser session only and simulated' : kapOfSource(x as Source) || kapOfPipe(x as Pipeline) ? 'Stored in KAP' : IMPL_SUB(x.impl));
const implP = (x: Source | Pipeline) => (isSess(x) ? IMPL('Planned') : IMPL(x.impl));

const notFound = (title: string, msg: string, back: Action): ScreenModel => ({ head: { title, acts: [back] }, sections: [{ callout: msg }] });

/** Run / Upload action for a pipeline, or a lock tip saying why it cannot run (prototype `runActs`). */
export function runActs(c: IngestCtx, p: Pipeline): { acts: Action[]; lock: string } {
  const blocked = blockedBy(c.H, p);
  return {
    acts: c.canRun && !blocked ? [act(p.v.src === 'manual' ? 'Upload and run' : 'Run now', () => c.a.runNow(p.id))] : [],
    lock: c.canRun && blocked ? blocked : '',
  };
}

// ================================================================ DATA SOURCES
export function sourcesScreen(c: IngestCtx, F: ListFilters, setF: (f: ListFilters) => void): ScreenModel {
  const { H } = c;
  const defs: [string, string, string[]][] = [
    ['type', 'Source type', ['Any type', ...new Set([...SRC_TYPES, ...H.sources.map((s) => s.type)])]],
    ['st', 'Status', ['Any status', 'Connected', 'Failed', 'Not tested', 'Disabled']],
  ];
  const rows = H.sources.filter((s) => anyOk(F, 'type', s.type) && anyOk(F, 'st', s.st) && qOk(F, `${s.id} ${s.desc}`));
  return {
    head: { title: 'Data Sources', add: c.canData ? act('Create data source', c.a.addSource, 'primary') : undefined },
    filters: filterBar(F, setF, defs),
    sections: [
      {
        empty: H.sources.length ? 'No data sources match the filters.' : 'No data sources yet.',
        cols: ['Source', 'Type', 'Endpoint or location', 'Connection', 'Pipelines using it', 'Last check'],
        mode: 'inline',
        rows: rows.map(
          (s): Row => ({
            key: `s:${s.id}`,
            cells: [
              cell(s.id, { m: true, sub: s.desc }),
              cell(s.type, { sub: implL(s), tip: implSub(s) }),
              cell(ihLoc(s)),
              cell('', { p: srcP(s.st), tip: s.err || '' }),
              pgOfSource(s)
                ? cell(`${pgOfSource(s)!.datasets} ${pgOfSource(s)!.datasets === 1 ? 'dataset' : 'datasets'}`, { tip: 'Exported to KAP by the platform' })
                : cell(H.pipelines.filter((p) => usesSource(p, s.id)).length),
              cell(s.chk),
            ],
            acts: [act('Open', () => c.go.source(s.id))],
            onClick: () => c.go.source(s.id),
          }),
        ),
      },
    ],
  };
}

export const SOURCE_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'conn', label: 'Connection Settings' },
  { value: 'browse', label: 'Browse / Test' },
  { value: 'pipes', label: 'Used by Pipelines' },
  { value: 'activity', label: 'Activity' },
];

const CFG_LABEL: Record<string, string> = { endpoint: 'Endpoint', region: 'Region', bucket: 'Bucket', base: 'Base path', server: 'Server', port: 'Port', db: 'Database', tls: 'Encryption', pool: 'SQL pool', schema: 'Schema', url: 'Base URL', test: 'Test endpoint', headers: 'Headers', repo: 'Repository type', path: 'Path', account: 'Account', wh: 'Warehouse', role: 'Role', project: 'Project', dataset: 'Dataset', loc: 'Location' };

export function sourceScreen(c: IngestCtx, id: string, tab0: string | undefined, setTab: (t: string) => void): ScreenModel {
  const s = srcOf(c.H, id);
  if (!s) return notFound(id, `No data source ${id} in this tenant. It may have been removed, or the name is wrong.`, act('Back to data sources', c.go.sources));
  const tab = SOURCE_TABS.some((x) => x.value === tab0) ? tab0! : 'overview';
  const K = kapOfSource(s);
  const head: PageHead = { title: s.id, status: K ? IMPL(s.impl) : implP(s), tabs: SOURCE_TABS, tab, setTab };
  const used = c.H.pipelines.filter((p) => usesSource(p, s.id));
  const fsKap = !!K && K.type !== 's3';
  const SA = c.canData && !fsKap
    ? [act('Edit', () => c.a.editSource(s)), act('Test connection', () => c.a.testSource(s)), act(K ? (s.st === 'Disabled' ? 'Reactivate' : 'Deactivate') : s.st === 'Disabled' ? 'Enable' : 'Disable', () => c.a.toggleSource(s))]
    : [];
  let sections: Section[] = [];
  if (tab === 'overview')
    sections = [
      {
        form: true,
        sacts: SA,
        rows: [
          fr('Name', s.id),
          fr('Type', s.type),
          { ...fr('Status', '', s.err || `Last check ${s.chk}`), cells: [cell('Status'), cell(srcP(s.st)[1], { sub: s.err || `Last check ${s.chk}`, p: srcP(s.st) })] },
          fr('Endpoint or location', ihLoc(s)),
          fr('Description', s.desc || '—'),
          { ...fr('Implementation', ''), cells: [cell('Implementation'), cell(implL(s), { sub: implSub(s), p: implP(s) })] },
        ],
        callout: fsKap ? 'File-system connectors are configured by the platform. The KAP API manages S3 connectors only, so this source cannot be edited, checked or deactivated here.' : undefined,
      },
    ];
  if (tab === 'conn')
    sections = [
      {
        form: true,
        sacts: SA.slice(0, 1),
        rows: [
          ...Object.entries(s.cfg).map(([k, val]) => fr(CFG_LABEL[k] ?? k, val || '—')),
          fr('Authentication', s.auth),
          K
            ? fr('Credentials', s.cred || '—', K.type === 's3' ? 'Exact-version references in the secret store. KAP returns only whether each key is set.' : '', [], { lock: 'Secret values are never displayed' })
            : fr('Managed credential', s.cred || 'Not needed (identity-based)', s.cred ? 'Reference to the tenant vault' : s.ident ? `Identity: ${s.ident}` : '', s.cred && c.canConfigure ? [act('Open in Security & Credentials', c.go.security)] : [], { lock: s.cred ? 'Secret values are never displayed' : '' }),
        ],
      },
    ];
  if (tab === 'browse')
    sections = [
      {
        title: 'Discovered objects',
        sacts: c.canData && !fsKap ? [act('Test connection', () => c.a.testSource(s))] : [],
        callout: K ? 'KAP does not list the objects a connector sees. Files it brings in appear in the collections that use it (Business Data Hub). The connection check reaches the endpoint and bucket, authorizes the keys, and writes and removes a test object.' : undefined,
        note: s.st === 'Failed' ? `Discovery is not available: ${s.err || 'the last connection test failed'}` : s.st === 'Disabled' ? 'Discovery is not available while the source is disabled.' : '',
        cols: ['Object', 'Kind', 'Detail'],
        empty: s.st === 'Connected' ? 'No objects discovered.' : s.st === 'Not tested' ? 'Test the connection to discover objects.' : 'Nothing to show.',
        rows: (s.st === 'Connected' ? s.browse : []).map((b): Row => ({ key: `b:${b[0]}`, cells: [cell(b[0], { m: true }), cell(b[1]), cell(b[2])] })),
      },
    ];
  if (tab === 'pipes')
    sections = [
      {
        sacts: c.canData && s.st === 'Connected' ? [act('Create pipeline from this source', () => c.a.addPipe(s))] : [],
        cols: ['Pipeline', 'Output', 'Run', 'State'],
        empty: 'No pipelines use this data source.',
        mode: 'inline',
        rows: used.map(
          (p): Row => ({
            key: `up:${p.id}`,
            cells: [cell(p.id, { m: true, sub: p.desc }), cell(outOf(c.H, p.v)), cell(trigOf(p.v)), cell('', { p: onP(p.on) })],
            acts: [act('Open', () => c.go.pipe(p.id))],
            onClick: () => c.go.pipe(p.id),
          }),
        ),
      },
    ];
  if (tab === 'activity')
    sections = [{ cols: ['When', 'Who', 'Event'], empty: 'No activity yet.', rows: s.act.map((a, i): Row => ({ key: `a:${i}`, cells: [cell(a[0]), cell(a[1], { m: true }), cell(a[2])] })) }];
  return { head, sections };
}

// ================================================================ INGESTION PIPELINES
export function pipesScreen(c: IngestCtx, F: ListFilters, setF: (f: ListFilters) => void): ScreenModel {
  const { H } = c;
  const defs: [string, string, string[]][] = [
    ['src', 'Data source', ['Any source', 'Manual upload', ...H.sources.map((s) => s.id)]],
    ['out', 'Output', ['Any output', 'Structured Data', 'Unstructured Data', 'Structured and Unstructured Data']],
    ['on', 'State', ['Any state', 'Enabled', 'Disabled']],
  ];
  const rows = H.pipelines.filter((p) => anyOk(F, 'src', srcName(p.v)) && anyOk(F, 'out', outOf(H, p.v)) && anyOk(F, 'on', p.on ? 'Enabled' : 'Disabled') && qOk(F, `${p.id} ${p.desc}`));
  return {
    head: { title: 'Ingestion Pipelines', add: c.canData ? act('Create pipeline', () => c.a.addPipe(), 'primary') : undefined },
    filters: filterBar(F, setF, defs),
    sections: [
      {
        empty: H.pipelines.length ? 'No pipelines match the filters.' : 'No pipelines yet.',
        cols: ['Pipeline', 'Source', 'Input', 'Output', 'Trigger or schedule', 'Last run', 'Last status', 'State'],
        mode: 'inline',
        rows: rows.map((p): Row => {
          const lr = runsOf(H, p.id)[0];
          const ra = runActs(c, p);
          const ty = srcType(H, p.v);
          return {
            key: `p:${p.id}`,
            cells: [
              cell(p.id, { m: true, tip: p.desc, sub: implL(p) }),
              cell(kapOfPipe(p) ? kapOfPipe(p)!.conns.join(', ') || 'No collection uses it' : srcName(p.v), { sub: ty === 'Manual upload' || ty === '—' ? '' : ty }),
              cell(kindOf(H, p.v)),
              cell(outOf(H, p.v).replace(' Data', '').replace('Structured and Unstructured', 'Both')),
              cell(trigOf(p.v)),
              cell(lr ? lr.start : 'Never'),
              cell('', { p: lr ? [stP(lr.st), lr.st] : ['draft', 'No runs'] }),
              cell('', { p: onP(p.on) }),
            ],
            acts: [act('Open', () => c.go.pipe(p.id)), ...ra.acts.map((x) => ({ ...x, l: x.l === 'Upload and run' ? 'Upload' : 'Run' }))],
            lockTip: ra.lock || undefined,
            onClick: () => c.go.pipe(p.id),
          };
        }),
      },
    ],
  };
}

export const PIPE_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'config', label: 'Configuration' },
  { value: 'runs', label: 'Runs' },
  { value: 'deps', label: 'Dependencies' },
];

/** Input selection, incremental strategy and its limits, as the pipeline overview words them. */
export function pipeInput(H: IngestTenant, p: Pipeline) {
  const ty = srcType(H, p.v);
  const v = p.v;
  const K = kapOfPipe(p);
  if (K)
    return {
      ty,
      inputL: K.conns.length ? `Files from ${K.conns.join(', ')} (connectors of ${v.colls.join(', ')})` : 'No collection references this pipeline yet',
      incL: 'Unchanged files are not processed again (content fingerprint and file version)',
      incLim: 'A modified object becomes a new file version; an object deleted at the source leaves the collection at the next sync.',
    };
  const inputL =
    ty === 'Manual upload'
      ? (v.files || []).join(', ') + (v.zip === 'Yes' ? ' · ZIP archives extracted' : '')
      : isDb(ty)
        ? (v.objs || []).length
          ? v.objs!.join(', ')
          : `Saved query ${v.query}`
        : ty === 'REST API'
          ? v.path + (v.params ? `?${v.params}` : '')
          : `${v.sel}: ${v.path} · ${v.pat}${v.rec === 'Yes' ? ' · subfolders' : ''}${v.zip === 'Yes' ? ' · extract ZIP' : ''}`;
  const incL = isDb(ty) ? (v.ext ?? '') + (v.wm ? ` on ${v.wm}` : '') : ty === 'REST API' ? v.inc ?? '' : ty === 'Manual upload' ? 'Each upload is a new batch' : `${v.which} · ${v.chg}`;
  const incLim = isDb(ty)
    ? (v.ext || '').includes('watermark')
      ? 'Deleted rows are not detected; the watermark column must change on every update.'
      : (v.ext || '').includes('change tracking')
        ? 'Requires SQL Server change tracking on each table; retention must exceed the schedule interval.'
        : 'Every run reads all rows.'
    : ty === 'REST API'
      ? (v.inc || '').startsWith('Since')
        ? 'Relies on the API filtering by modification time; deleted records are not detected.'
        : 'Every run reads all pages.'
      : ty === 'S3'
        ? (v.chg || '').startsWith('Object')
          ? 'Needs bucket versioning; deleted objects are not removed from KAP.'
          : 'Timestamps can miss files copied with preserved times.'
        : ty === 'File repository'
          ? 'No object versions: relies on timestamps or a checksum inventory.'
          : '';
  return { ty, inputL, incL, incLim };
}

export function pipeScreen(c: IngestCtx, id: string, tab0: string | undefined, setTab: (t: string) => void, sel: string | null, setSel: (s: string | null) => void): ScreenModel {
  const { H } = c;
  const p = pipeOf(H, id);
  if (!p) return notFound(id, `No pipeline ${id} in this tenant. It may have been removed, or the name is wrong.`, act('Back to pipelines', c.go.pipes));
  const tab = PIPE_TABS.some((x) => x.value === tab0) ? tab0! : 'overview';
  const K = kapOfPipe(p);
  const head: PageHead = { title: p.id, status: implP(p), tabs: PIPE_TABS, tab, setTab };
  const v = p.v;
  const kind = kindOf(H, v);
  const ra = runActs(c, p);
  const { ty, inputL, incL, incLim } = pipeInput(H, p);
  const PA = [
    ...(c.canData && (!K || p.on) ? [act('Edit pipeline', () => c.a.editPipe(p))] : []),
    ...ra.acts,
    ...(c.canData ? [act(K ? (p.on ? 'Delete' : 'Restore') : p.on ? 'Disable' : 'Enable', () => c.a.togglePipe(p))] : []),
    act('View runs', () => setTab('runs')),
  ];
  const srcRow = () =>
    K
      ? fr('Data sources', K.conns.join(', ') || 'None', K.conns.length ? 'Connectors of the collections that use this pipeline' : 'A collection links a pipeline to its connectors', K.conns.length ? [act('Open', () => c.go.source(K.conns[0]))] : [])
      : fr('Data source', v.src === 'manual' ? 'Manual upload (no data source)' : v.src, ty, srcOpen);
  const inspect = (nid: string | null): [string, string][] => {
    if (!nid) return [];
    if (nid === 'in') return [['Source', srcName(v)], ['Source type', ty], ['Selection', inputL], ['Incremental strategy', incL]];
    if (nid.startsWith('st:')) {
      const n0 = nid.slice(3);
      const structured = STR_ALL('').includes(n0) || n0 === 'Parse files' || n0 === 'Database extraction' || n0 === 'API response parsing';
      return [
        ['Stage', n0],
        ['Path', structured ? 'Structured' : n0 === 'Archive extraction' ? 'Input' : 'Documents'],
        ['State', [...(v.sSteps || []), ...(v.uSteps || [])].includes(n0) || n0 === 'Archive extraction' ? 'Enabled' : 'Not enabled'],
        ['Settings', stageCfg(n0, v)],
      ];
    }
    if (nid === 'out:sd') return [['Publishes to', 'Structured Data'], ['Dataset', v.dsName || '—'], ['Write mode', v.mode || '—'], ['Keys', v.keys || '—']];
    if (nid === 'out:ud') return [['Publishes to', 'Unstructured Data'], ['Versions', 'New file versions become new document versions']];
    if (nid === 'out:es') return [['Publishes to', 'Entity Store'], ['Entity types', (v.entTypes || []).join(', ') || '—'], ['Minimum confidence', v.entConf || '0.70']];
    return [['Collections', (v.colls || []).join(', ') || 'None'], ['Storage', 'References only']];
  };
  const flow = (): Section => ({
    title: 'Pipeline flow',
    dgm: { ...pipeDgm(v, ty, kind, { sel, click: (nid) => setSel(sel === nid ? null : nid) }), inspect: inspect(sel), inspectT: sel ? `Selected · ${nodeLabel(sel)}` : '' },
  });
  const srcOpen = v.src !== 'manual' ? [act('Open', () => c.go.source(v.src))] : [];
  let sections: Section[] = [];
  if (tab === 'overview')
    sections = [
      flow(),
      {
        form: true,
        sacts: PA,
        rows: [
          fr('Purpose', p.desc || '—'),
          srcRow(),
          fr('Input', inputL, `${kind} input`),
          fr('Incremental strategy', incL, incLim),
          fr('Publishes to', outOf(H, v) + (v.dsName ? ` · ${v.dsName}` : ''), kind !== 'Unstructured' ? `${K ? 'Mode' : 'Write mode'}: ${v.mode}${v.keys ? ` · keys ${v.keys}` : ''}` : K ? 'Collection files, with a new file version for each changed object' : 'New file versions become new document versions'),
          fr('Collections', (v.colls || []).join(', ') || 'None', K ? 'Collections reference their pipeline (Business Data Hub)' : 'Optional'),
          fr('Run', trigOf(v), K ? `${p.on ? 'Active' : 'Deleted in KAP'} · KAP has no pipeline schedules; connectors sync on their own interval` : p.on ? 'Enabled' : 'Disabled', [], { lock: ra.lock }),
          { ...fr('Implementation', ''), cells: [cell('Implementation'), cell(implL(p), { sub: implSub(p), p: implP(p) })] },
        ],
      },
    ];
  if (tab === 'config') {
    const stepRows = (path: string, steps: string[] | undefined) => (steps || []).map((s0, i): Row => ({ key: `${path}${i}`, cells: [cell(String(i + 1)), cell(path), cell(s0), cell(stageCfg(s0, v))] }));
    sections = [
      flow(),
      { form: true, title: 'Input', sacts: c.canData && (!K || p.on) ? [act('Edit pipeline', () => c.a.editPipe(p))] : [], rows: [fr('Source type', ty), fr('Selection', inputL), fr('Incremental strategy', incL, incLim)] },
      {
        title: 'Processing steps',
        note: K ? `KAP ${K.kind} pipeline: stages run in this order.` : '',
        cols: ['#', 'Path', 'Step', 'Settings'],
        rows: [
          ...(v.zip === 'Yes' ? [{ key: 'zip', cells: [cell('0'), cell('Input'), cell('Archive extraction'), cell('Extract, then apply the file pattern')] }] : []),
          ...stepRows('Structured', kind === 'Unstructured' ? [] : v.sSteps),
          ...stepRows('Documents', kind === 'Structured' ? [] : v.uSteps),
        ],
      },
      {
        form: true,
        title: 'Output and execution',
        rows: [fr('Publishes to', outOf(H, v)), fr('Dataset', v.dsName || '—', kind !== 'Unstructured' ? v.mode : ''), fr('Collections', (v.colls || []).join(', ') || 'None (optional)'), fr('Run', trigOf(v), K ? 'Schedules and event triggers are not available in KAP' : v.trig === 'Event' ? 'Needs bucket notifications' : '')],
      },
    ];
  }
  if (tab === 'runs')
    sections = [
      {
        sacts: ra.acts,
        cols: ['Run', 'Trigger', 'Started', 'Duration', 'Status', 'Input', 'Output', 'Errors'],
        empty: 'No runs yet.',
        mode: 'inline',
        rows: runsOf(H, p.id).map(
          (r): Row => ({
            key: `r:${r.id}`,
            cells: [cell(r.id, { m: true }), cell(r.trig), cell(r.start), cell(r.dur), cell('', { p: [stP(r.st), r.st] }), cell(r.inN), cell(r.outN), cell(r.errN || '—')],
            acts: [act('View details', () => c.go.run(r.id))],
            onClick: () => c.go.run(r.id),
          }),
        ),
      },
    ];
  if (tab === 'deps') {
    const runs = runsOf(H, p.id);
    const dsIds = [...new Set(runs.flatMap((r) => r.outDs))];
    const docIds = [...new Set(runs.flatMap((r) => r.outDocs))];
    sections = [
      { form: true, title: 'Source', rows: [srcRow()] },
      {
        title: 'Published datasets',
        callout: K ? 'KAP does not report which datasets or documents a run produced. The files of each collection are listed in Business Data Hub.' : undefined,
        cols: ['Dataset', 'Last run'],
        empty: K ? 'Not reported by KAP.' : 'No datasets published yet.',
        mode: 'inline',
        rows: dsIds.map((d): Row => ({ key: `d:${d}`, cells: [cell(d, { m: true }), cell(runs.find((r) => r.outDs.includes(d))?.id ?? '—')], acts: H.pub.datasets.includes(d) ? [act('Open in Structured Data', () => c.go.dataset(d))] : [] })),
      },
      {
        title: 'Published documents',
        cols: ['Document', 'Last run'],
        empty: K ? 'Not reported by KAP.' : 'No documents published yet.',
        mode: 'inline',
        rows: docIds.map((d): Row => ({ key: `o:${d}`, cells: [cell(d, { m: true }), cell(runs.find((r) => r.outDocs.includes(d))?.id ?? '—')], acts: H.pub.documents.includes(d) ? [act('Open in Unstructured Data', () => c.go.document(d))] : [] })),
      },
      {
        title: 'Collections',
        note: (v.colls || []).length ? '' : 'None configured. Published data is still available in Business Data Hub.',
        cols: ['Collection'],
        mode: 'inline',
        rows: (v.colls || []).map((cid): Row => ({ key: `c:${cid}`, cells: [cell(cid, { m: true })], acts: [act('Open', () => c.go.collection(cid))] })),
      },
    ];
  }
  return { head, sections };
}

// ================================================================ INGESTION RUNS
/** Age in days of a relative time such as "3 h ago" (prototype `age`). */
export const ageDays = (s: string) => {
  if (/just now|min|s ago|running/.test(s)) return 0;
  const h = s.match(/(\d+) h/);
  if (h) return +h[1] / 24;
  const d = s.match(/(\d+) d/);
  if (d) return +d[1];
  return 99;
};

/** Data source of a run: a live run's connector (or its pipeline's connectors), else the pipeline's source. */
export function srcOfRun(H: IngestTenant, r: Run): string {
  const pg = pgOfRun(r);
  if (pg) return pg.source;
  const K = kapOfRun(r);
  const p = pipeOf(H, r.pipe);
  if (K) return K.connector || kapOfPipe(p)?.conns.join(', ') || (p ? srcName(p.v) : '');
  return p ? srcName(p.v) : '';
}

/** The runs the list's filters keep, in list order. */
export function filterRuns(H: IngestTenant, F: ListFilters): Run[] {
  return H.runs.filter(
    (r) =>
      anyOk(F, 'pipe', r.pipe) &&
      (!F.src || F.src.startsWith('Any') || srcOfRun(H, r).split(', ').includes(F.src)) &&
      anyOk(F, 'st', r.st) &&
      (!F.per || F.per === 'Any time' || ageDays(r.start) <= (F.per === 'Last 24 hours' ? 1 : 7)) &&
      qOk(F, `${r.id} ${r.pipe} ${r.trig} ${kapOfRun(r)?.collection ?? pgOfRun(r)?.collection ?? ''}`),
  );
}

/** `liveTable`: the live tenant's run table (status icons, progress), replacing the plain table. */
export function runsScreen(c: IngestCtx, F: ListFilters, setF: (f: ListFilters) => void, liveTable?: (runs: Run[]) => Section): ScreenModel {
  const { H } = c;
  const defs: [string, string, string[]][] = [
    ['pipe', 'Pipeline', ['Any pipeline', ...H.pipelines.map((p) => p.id)]],
    ['src', 'Data source', ['Any source', 'Manual upload', ...H.sources.map((s) => s.id)]],
    ['st', 'Status', ['Any status', 'Queued', 'Running', 'Succeeded', 'Partially succeeded', 'Failed', 'Cancelled']],
    ['per', 'Period', ['Any time', 'Last 24 hours', 'Last 7 days']],
  ];
  const rows = filterRuns(H, F);
  if (liveTable) return { head: { title: 'Ingestion Runs' }, filters: filterBar(F, setF, defs), sections: [liveTable(rows)] };
  return {
    head: { title: 'Ingestion Runs' },
    filters: filterBar(F, setF, defs),
    sections: [
      {
        empty: H.runs.length ? 'No runs match the filters.' : 'No ingestion runs yet.',
        cols: ['Run', 'Pipeline', 'Data source', 'Trigger', 'Started', 'Duration', 'Status', 'Input → output', 'Errors'],
        mode: 'inline',
        rows: rows.map(
          (r): Row => ({
            key: `r:${r.id}`,
            cells: [cell(r.id, { m: true }), cell(r.pipe), cell(srcOfRun(H, r)), cell(r.trig), cell(r.start), cell(r.dur), cell('', { p: [stP(r.st), r.st] }), cell(`${r.inN} → ${r.outN}`), cell(r.errN || '—')],
            acts: [act('View details', () => c.go.run(r.id)), act('View logs', () => c.go.run(r.id, 'errors')), ...(canCancel(c, r) ? [act('Cancel', () => c.a.cancelRun!(r))] : [])],
            onClick: () => c.go.run(r.id),
          }),
        ),
      },
    ],
  };
}

export const RUN_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'stages', label: 'Processing Stages' },
  { value: 'items', label: 'Processed Items' },
  { value: 'errors', label: 'Errors & Logs' },
  { value: 'lineage', label: 'Output & Lineage' },
];

/** A live run KAP can still cancel (waiting or running). */
export const canCancel = (c: IngestCtx, r: Run) => !!c.a.cancelRun && c.canRun && !!kapOfRun(r) && (r.st === 'Queued' || r.st === 'Running');

/** Retry actions and the notes explaining what cannot be retried (prototype iRun). */
export function runRetry(c: IngestCtx, r: Run) {
  const p = pipeOf(c.H, r.pipe) ?? ({ id: r.pipe, v: { src: '', sSteps: [], uSteps: [], colls: [], trig: '' }, on: false, impl: 'Planned', desc: '' } as Pipeline);
  const K = kapOfRun(r);
  if (K) {
    // KAP: a run is one collection; running it again skips unchanged files. Single files are reprocessed from the collection.
    const done = !['Queued', 'Running'].includes(r.st);
    const acts: Action[] = [
      ...(canCancel(c, r) ? [act('Cancel run', () => c.a.cancelRun!(r))] : []),
      ...(c.canRun && done && p.on ? [act('Run again', () => c.a.retryRun(r))] : []),
    ];
    const note = !done
      ? 'Cancelling stops the run at the next safe boundary; files already written are kept.'
      : r.st === 'Failed' || r.st === 'Partially succeeded'
        ? 'Running again processes the collection once more; unchanged files that succeeded are not processed again. Single files can be reprocessed from the collection in Business Data Hub.'
        : '';
    return { p, ty: srcType(c.H, p.v), failed: [] as Run['items'], retryable: [] as Run['items'], acts, note };
  }
  const failed = r.items.filter((x) => x.res === 'Failed');
  const retryable = failed.filter((x) => x.retry);
  const done = ['Succeeded', 'Partially succeeded', 'Failed', 'Cancelled'].includes(r.st);
  const ty = srcType(c.H, p.v);
  const idem = !(p.v.mode || '').startsWith('Append');
  const itemLevel = isFile(ty) || ty === 'REST API';
  const retryNote = !done
    ? 'Retry is available when the run has finished.'
    : !failed.length && r.st !== 'Failed'
      ? 'Nothing to retry.'
      : !itemLevel
        ? 'Item-level retry is not supported for database extraction; retry the whole run.'
        : retryable.length < failed.length
          ? `${failed.length - retryable.length} failed item(s) cannot be retried until the source file is fixed.`
          : '';
  const bad = r.st === 'Failed' || r.st === 'Partially succeeded';
  const acts: Action[] =
    c.canRun && done
      ? [
          ...(retryable.length && itemLevel ? [act(`Retry failed items (${retryable.length})`, () => c.a.retryFailed(r))] : []),
          ...(bad && p.on && idem ? [act('Retry run', () => c.a.retryRun(r))] : []),
        ]
      : [];
  const appendNote = bad && !idem ? 'Retry run is not offered: the pipeline appends records, so re-running everything would create duplicates. Retry only the failed items.' : '';
  return { p, ty, failed, retryable, acts, note: [retryNote, appendNote].filter(Boolean).join(' ') };
}

/** Tabs of a live (KAP) run: the step view, the files, the logs. */
export const LIVE_RUN_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'items', label: 'Processed Items' },
  { value: 'errors', label: 'Errors & Logs' },
];

/** Custom content of a live run page (`LiveRunView.tsx`). */
export interface LiveRunContent {
  overview: Section['custom'];
  items: Section['custom'];
}

export function runScreen(c: IngestCtx, id: string, tab0: string | undefined, setTab: (t: string) => void, sel: string | null, setSel: (s: string | null) => void, live?: LiveRunContent): ScreenModel {
  const { H } = c;
  const r = H.runs.find((x) => x.id === id);
  if (!r) return notFound(id, `No ingestion run ${id} in this tenant. It may have been purged from history, or the ID is wrong.`, act('Back to runs', c.go.runs));
  const K = kapOfRun(r);
  if (K && live) return liveRunScreen(c, r, tab0, setTab, live);
  const tab = RUN_TABS.some((x) => x.value === tab0) ? tab0! : 'overview';
  const head: PageHead = { title: r.id, status: [stP(r.st), r.st], tabs: RUN_TABS, tab, setTab };
  const { p, ty, failed, acts: RA, note } = runRetry(c, r);
  const B = r.batch;
  let sections: Section[] = [];
  if (tab === 'overview')
    sections = [
      {
        form: true,
        sacts: [...RA, act('View logs', () => setTab('errors'))],
        rows: [
          fr('Run', r.id, K ? `KAP job ${K.job}` : r.retryOf ? `Retry of ${r.retryOf}` : ''),
          fr('Pipeline', r.pipe, '', [act('Open', () => c.go.pipe(r.pipe))]),
          ...(K
            ? [
                fr('Collection', K.collection, 'The run processes the files of one collection', K.collection !== 'collection not listed' ? [act('Open', () => c.go.collection(K.collection))] : []),
                fr('Data source', K.connector || 'All connectors of the collection', K.connector ? 'The run was narrowed to this connector' : '', K.connector && !K.connector.includes(' ') ? [act('Open', () => c.go.source(K.connector))] : []),
              ]
            : [fr('Data source', srcName(p.v), ty, p.v.src && p.v.src !== 'manual' ? [act('Open', () => c.go.source(p.v.src))] : [])]),
          fr('Trigger', r.trig),
          fr('Started', r.start, `Duration ${r.dur}`),
          fr('Status', r.st, K?.error ? `${K.error.code}: ${K.error.message}` : r.errN ? `${r.errN} error(s)` : K && K.percent != null && (r.st === 'Queued' || r.st === 'Running') ? `${K.percent}% of files finished` : ''),
          fr('Input', r.inN, K ? 'Files the run discovered' : ''),
          fr('Output', r.outN, K && !K.detail && !['Queued', 'Running'].includes(r.st) ? 'Loading the result from KAP…' : ''),
          ...(B ? [fr('Batch', B.id, `${B.kind} · ${B.ver}`), fr('Batch inventory', B.inv, B.sum)] : []),
        ],
        callout: note || undefined,
      },
    ];
  if (tab === 'stages') {
    const rsx = sel && sel.startsWith('st:') ? r.stages.find((x) => x[0] === sel.slice(3)) : null;
    const inspect: [string, string | number][] = rsx
      ? [['Stage', rsx[0]], ['Status', rsx[1]], ['Duration', rsx[2]], ['Processed', rsx[3]], ['Failed', rsx[4] || 0], ['Summary', rsx[5] || '—']]
      : sel && sel.startsWith('st:')
        ? [['Stage', sel.slice(3)], ['Status', r.st === 'Queued' || r.st === 'Running' ? 'Pending' : 'Skipped']]
        : sel
          ? [
              ['Output', sel === 'out:sd' ? `Structured Data · ${r.outDs.join(', ') || 'none'}` : sel === 'out:ud' ? `Unstructured Data · ${r.outDocs.length} documents` : sel === 'out:es' ? 'Entity Store' : `Collections · ${(p.v.colls || []).join(', ') || 'none'}`],
              ['Run status', r.st],
            ]
          : [];
    sections = [
      {
        title: 'Processing flow',
        note: K ? 'KAP reports progress for the whole run, not for each stage. The diagram shows the stages of the pipeline.' : '',
        dgm: K
          ? { ...pipeDgm(p.v, ty, kindOf(H, p.v), { sel, click: (nid) => setSel(sel === nid ? null : nid) }), inspect: sel && sel.startsWith('st:') ? [['Stage', sel.slice(3)], ['Settings', stageCfg(sel.slice(3), p.v)]] : inspect, inspectT: sel ? `Selected · ${nodeLabel(sel)}` : '' }
          : { ...pipeDgm(p.v, ty, kindOf(H, p.v), { stages: r.stages, runSt: r.st, sel, click: (nid) => setSel(sel === nid ? null : nid) }), inspect, inspectT: sel ? `Selected · ${nodeLabel(sel)}` : '' },
      },
      {
        cols: ['Stage', 'Status', 'Duration', 'Processed', 'Failed', 'Summary'],
        empty: r.st === 'Queued' ? 'The run has not started yet.' : 'No stages reported.',
        rows: r.stages.map((s0, i): Row => ({ key: `st:${i}`, cells: [cell(s0[0]), cell('', { p: [stP(s0[1]), s0[1]] }), cell(s0[2]), cell(String(s0[3])), cell(String(s0[4] || '—')), cell(s0[5] || '—')] })),
      },
    ];
  }
  if (tab === 'items')
    sections = [
      {
        title: isDb(ty) ? 'Extraction units' : 'Files',
        note: r.items.some((x) => x.parent) ? 'Files extracted from an archive are listed under the archive.' : '',
        callout: K ? `KAP reports file counts for a run (${r.outN}), not the files themselves. The files and their states are listed with the collection ${K.collection} in Business Data Hub.` : undefined,
        cols: ['Item', 'Path or unit', 'Type', 'Size or records', 'Result', 'Error'],
        empty: K ? 'Not reported by KAP.' : 'No items processed.',
        rows: r.items.map(
          (x, i): Row => ({
            key: `it:${i}`,
            cells: [cell((x.parent ? '↳ ' : '') + x.n, { m: true }), cell(x.path), cell(x.ty), cell(x.size), cell('', { p: [stP(x.res), x.res] }), cell(x.err ? x.err + (x.res === 'Failed' ? (x.retry ? ' · retryable' : ' · not retryable') : '') : '—')],
          }),
        ),
      },
    ];
  if (tab === 'errors')
    sections = [
      {
        title: 'Failed items',
        sacts: RA,
        note: K ? (r.errN ? `${r.errN} failed file(s). KAP does not name them per run; see the collection's files in Business Data Hub.` : 'No failed files.') : failed.length ? '' : 'No failed items.',
        cols: ['Item', 'Error', 'Retry'],
        rows: failed.map((x, i): Row => ({ key: `fe:${i}`, cells: [cell(x.n, { m: true }), cell(x.err), cell(x.retry ? 'Eligible' : 'Not eligible · fix the source')] })),
      },
      {
        title: 'Logs',
        cols: ['Time', 'Level', 'Message'],
        rows: r.logs.map((l, i): Row => ({ key: `lg:${i}`, cells: [cell(l[0], { m: true }), cell('', { p: [l[1] === 'ERROR' ? 'rejected' : l[1] === 'WARN' ? 'hold' : 'draft', l[1]] }), cell(l[2])] })),
      },
    ];
  if (tab === 'lineage') {
    const collsWith = (k: 'ds' | 'docs', x: string) => H.pub.colls.filter((cc) => cc[k].includes(x)).map((cc) => cc.id).join(', ') || 'None';
    sections = [
      {
        title: 'Datasets',
        callout: K ? 'KAP does not report which datasets or documents a run produced. The files of the collection are listed in Business Data Hub.' : undefined,
        note: K ? '' : r.outDs.length ? '' : 'No datasets created or updated.',
        cols: ['Dataset', 'Collections'],
        mode: 'inline',
        rows: r.outDs.map((d): Row => ({ key: `ld:${d}`, cells: [cell(d, { m: true }), cell(collsWith('ds', d))], acts: H.pub.datasets.includes(d) ? [act('Open in Structured Data', () => c.go.dataset(d))] : [] })),
      },
      {
        title: 'Documents',
        note: K ? '' : r.outDocs.length ? '' : 'No documents created or updated.',
        cols: ['Document', 'Collections'],
        mode: 'inline',
        rows: r.outDocs.map((d): Row => ({ key: `lo:${d}`, cells: [cell(d, { m: true }), cell(collsWith('docs', d))], acts: H.pub.documents.includes(d) ? [act('Open in Unstructured Data', () => c.go.document(d))] : [] })),
      },
      {
        form: true,
        title: 'Provenance',
        rows: [
          K
            ? fr('Original inputs', `Collection ${K.collection}${K.connector ? ` · connector ${K.connector}` : ''}`, r.inN)
            : fr('Original inputs', r.items.map((x) => x.n).slice(0, 4).join(', ') + (r.items.length > 4 ? ` and ${r.items.length - 4} more` : '') || '—'),
          fr('Configuration', r.pipe, K ? 'Current pipeline definition (KAP keeps configuration versions, not a copy per run)' : 'Pipeline definition at run time', [act('Open pipeline', () => c.go.pipe(r.pipe, 'config'))]),
        ],
      },
    ];
  }
  return { head, sections };
}

/** A live (KAP) run: the step view (overview), the files of the run, and the failed files and logs. */
function liveRunScreen(c: IngestCtx, r: Run, tab0: string | undefined, setTab: (t: string) => void, live: LiveRunContent): ScreenModel {
  const tab = LIVE_RUN_TABS.some((x) => x.value === tab0) ? tab0! : 'overview';
  const { acts: RA, note } = runRetry(c, r);
  const head: PageHead = { title: r.id, status: [stP(r.st), r.st], tabs: LIVE_RUN_TABS, tab, setTab, acts: [...RA, act('Back to runs', c.go.runs)] };
  let sections: Section[];
  if (tab === 'items') sections = [{ custom: live.items }];
  else if (tab === 'errors')
    sections = [
      {
        title: 'Logs',
        note: `What KAP reports for the run. ${r.errN ? 'Failed files are marked on the Processed Items tab.' : ''}`.trim(),
        cols: ['Time', 'Level', 'Message'],
        rows: r.logs.map((l, i): Row => ({ key: `lg:${i}`, cells: [cell(l[0], { m: true }), cell('', { p: [l[1] === 'ERROR' ? 'rejected' : l[1] === 'WARN' ? 'hold' : 'draft', l[1]] }), cell(l[2])] })),
      },
    ];
  else sections = [{ custom: live.overview, callout: note || undefined }];
  return { head, sections };
}

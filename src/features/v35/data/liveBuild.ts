/**
 * Business Data Hub screens for a live tenant (sandbox): the same screens as
 * `build.ts`, with KAP's records, KAP writes and lazy, paged lists. What KAP
 * has no field for shows '—' and says so; what only the console keeps
 * (access grants and policies, classification, relationship types) is marked
 * session-only where it is shown or changed.
 */
import { act, cell, fr, kv } from '@/engine/build';
import type { FormField } from '@/engine/dialogs';
import type { Action, DsStatus, PageHead, Row, ScreenModel, Section } from '@/engine/types';
import {
  accessSections, COLLECTION_TABS, DATASET_TABS, datasetScreen, denied, derive, DOCUMENT_TABS, documentScreen, documentsScreen, dsPill, entitiesScreen, ENTITY_TABS, fmt, openRow,
  type EntitiesView, type Hub, type LiveHub,
} from './build';
import {
  ENTITY_OFF, MAX_DOCS, SYNC_OPTS, ago, bytes, checkCollection, checkEntityTypeName, checkObservation, collectionOfDataset, collectionsUsingType, docIds, docIdOf, kindOf, obsKey, obsSource, obsStatus, obsValue, pageKey, periodLabel,
  procStatus, schemaWithAttr, schemaWithoutAttr, stateLabel,
  type CollectionForm, type KapCollection, type KapFile, type KapObservation,
} from './fromKap';
import type { UdFilters } from './session';

const enc = encodeURIComponent;
const tabsOf = (T: [string, string][]) => T.map(([value, label]) => ({ value, label }));
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—');

/** Shown while the first KAP load runs (the banner says so). */
const loading = (title: string): ScreenModel => ({ head: { title }, sections: [] });

export const SESSION_ACCESS = 'Groups, grants and access policies here are kept in this console only (session). KAP applies its own roles and resource grants.';

const kapColl = (lv: LiveHub, name: string) => lv.cache.collections.find((c) => c.name === name) ?? null;
const pstPill = (pst: string, label: string): [DsStatus, string] => [pst === 'Failed' ? 'rejected' : pst === 'Completed' ? 'approved' : pst === 'Processing' ? 'submitted' : 'draft', label];

/** Status pill of a collection: observations to review, failed or processing files. */
export function collectionStatus(lv: LiveHub, k: KapCollection): [DsStatus, string] {
  const C = lv.cache;
  if (kindOf(k, C.pipelines) === 'indicators') {
    const o = C.obsTotal[k.id];
    if (!o) return ['draft', '—'];
    return !o.total ? ['draft', 'Empty'] : o.review ? ['hold', `${fmt(o.review)} to review`] : ['approved', 'Ready'];
  }
  const n = C.fileTotal[k.id];
  const s = C.fileStates[k.id];
  if (n == null) return ['draft', '—'];
  if (!n) return ['draft', 'Empty'];
  if (!s) return ['draft', '—'];
  return s.failed ? ['hold', `${fmt(s.failed)} failed`] : s.busy ? ['submitted', `${fmt(s.busy)} processing`] : ['approved', 'Ready'];
}

function contentsOf(lv: LiveHub, k: KapCollection): string {
  const C = lv.cache;
  if (kindOf(k, C.pipelines) === 'indicators') {
    const o = C.obsTotal[k.id];
    return o ? plural(o.total, 'observation', 'observations') : '—';
  }
  const n = C.fileTotal[k.id];
  return n == null ? '—' : n ? plural(n, 'file', 'files') : 'Empty';
}

// ================================================================== collection create / edit
export function collectionForm(h: Hub, k: KapCollection | null) {
  const lv = h.live!;
  const C = lv.cache;
  const types = C.entityTypes.map((e) => e.name);
  const cur = k?.entity?.enabled && k.entity.entity_type_ref ? k.entity.entity_type_ref : ENTITY_OFF;
  const fields: FormField[] = [
    ...(k ? [] : [{ k: 'name', label: 'Name', type: 'text', ph: 'e.g. supplier_contracts', hint: '4–32 letters, digits and underscores. Agents refer to collections by name.' } as FormField]),
    C.pipelines
      ? { k: 'pipeline', label: 'Pipeline', type: 'select', opts: C.pipelines.map((p) => p.name), val: k?.pipeline_ref ?? C.pipelines[0]?.name, hint: 'A document pipeline indexes files; an indicator metrics pipeline loads observations.' }
      : { k: 'pipeline', label: 'Pipeline', type: 'text', val: k?.pipeline_ref ?? '', hint: 'Name of a KAP pipeline (the pipeline list could not be read).' },
    C.connectors
      ? { k: 'connectors', label: 'Connectors', type: 'chips', opts: C.connectors.map((c) => c.name), val: k?.connectors ?? [] }
      : { k: 'connectors', label: 'Connectors', type: 'text', val: (k?.connectors ?? []).join(', '), hint: 'Connector names, separated by commas (the connector list could not be read).' },
    { k: 'sync', label: 'Sync strategy', type: 'select', opts: SYNC_OPTS, val: k?.sync_strategy ?? 'unique_name', hint: 'When files from different connectors have the same path: unique_name keeps both, overwrite keeps one.' },
    { k: 'entity', label: 'Entity extraction', type: 'select', opts: [ENTITY_OFF, ...types], val: cur, hint: 'Groups the files into entities of this type. Other entity rules of the collection are kept.' },
    { type: 'note', tone: 'info', text: 'KAP collections have no description or retrieval settings: the pipeline decides how files are processed and indexed.' },
  ];
  h.ui.form(k ? `Edit collection · ${k.name}` : 'Create collection', fields, k ? 'Save' : 'Create', (v) => {
    const f: CollectionForm = {
      name: k ? k.name : String(v.name ?? '').trim(),
      pipeline: String(v.pipeline ?? '').trim(),
      connectors: Array.isArray(v.connectors) ? v.connectors : String(v.connectors ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      sync: String(v.sync ?? ''),
      entity: String(v.entity ?? ENTITY_OFF),
    };
    const err = checkCollection(f, !k, C.collections.map((c) => c.name));
    if (err) return err;
    return k ? lv.updateCollection(k.name, f) : lv.createCollection(f);
  });
}

// ================================================================== COLLECTIONS
export function liveCollectionsScreen(h: Hub): ScreenModel {
  const x = derive(h);
  const { D, acc, ui } = h;
  const lv = h.live!;
  const rows = D.collections.filter((c) => acc.canRead(c.id));
  return {
    head: { title: 'Collections', add: acc.canData ? act('Create collection', () => collectionForm(h, null), 'primary') : undefined },
    sections: [
      {
        empty: lv.cache.loaded ? 'No collections you can open.' : '',
        cols: ['Collection', 'Contents', 'Index status', 'Access policies', 'Agents'],
        rows: rows.flatMap((c) => {
          const k = kapColl(lv, c.id);
          if (!k) return [];
          const ags = x.agentsOf(c.id);
          return [
            openRow(`c:${c.id}`, [
              cell(c.id, { m: true, sub: c.desc }),
              cell(contentsOf(lv, k)),
              cell('', { p: collectionStatus(lv, k) }),
              cell(x.label(c.id) || 'None', { tip: 'Kept in this console only (session)' }),
              cell(ags.length ? ags.join(', ') : '—'),
            ], () => ui.go(`collections/${enc(c.id)}`)),
          ];
        }),
      },
    ],
  };
}

// ------------------------------------------------------------------ files of a collection (paged)
function fileRow(h: Hub, f: KapFile, kind: 'indicators' | 'document'): Row {
  const lv = h.live!;
  const id = docIdOf(lv.cache, f.id) ?? f.name;
  const pst = procStatus(f.state, kind);
  const open = kind === 'document' ? () => h.ui.go(`unstructured/${enc(id)}`) : undefined;
  const acts: Action[] = [
    ...(open ? [act('Open', open)] : []),
    act('Download', () => lv.download(id)),
    ...(h.acc.canData ? [act('Reprocess', () => reprocessConfirm(h, id, f)), act('Delete', () => deleteFileConfirm(h, id, f, false), 'ghost')] : []),
  ];
  return {
    key: `f:${f.id}`,
    cells: [
      cell(f.name, { m: true, sub: f.source_path }),
      cell((f.file_type || '—').toUpperCase()),
      cell(bytes(f.size_bytes)),
      cell('', { p: pstPill(pst, stateLabel(f.state)) }),
      cell(f.current_version_number != null ? `v${f.current_version_number}` : '—', { sub: f.version_count > 1 ? `${f.version_count} versions` : '' }),
      cell(ago(f.content_changed_at ?? f.updated_at)),
    ],
    acts,
    onClick: open,
  };
}

function reprocessConfirm(h: Hub, id: string, f: KapFile) {
  h.ui.confirm(`Reprocess ${f.name}?`, "The collection's pipeline runs again: from parsing when a version is stored, otherwise from ingest. The content is not changed and no new version is created.", [], 'Reprocess', () => h.live!.reprocessFile(id));
}

function deleteFileConfirm(h: Hub, id: string, f: KapFile, leave: boolean) {
  h.ui.confirm(`Delete ${f.name}?`, 'KAP removes the file from this collection and erases its versions, stored objects and vector data. The source object in the connector is not touched, and a later synchronization may add the file again.', [], 'Delete', async () => {
    const e = await h.live!.deleteFile(id);
    if (!e && leave) h.ui.go('unstructured');
    return e;
  });
}

function filesSection(h: Hub, k: KapCollection, title: string): Section {
  const lv = h.live!;
  const C = lv.cache;
  const kind = kindOf(k, C.pipelines);
  const pg = lv.filesAt(k.name);
  const ids = C.filePages[k.id]?.[pageKey(pg.offset, pg.size)];
  const total = C.fileTotal[k.id] ?? 0;
  const files = (ids ?? []).map((i) => C.files[i]).filter((f): f is KapFile => !!f);
  const pages = Math.max(1, Math.ceil(total / pg.size));
  const n = Math.floor(pg.offset / pg.size) + 1;
  return {
    title,
    note: 'Files come from the collection\'s connectors when KAP synchronizes them; they are not added here.',
    empty: ids ? 'No files in this collection.' : 'Loading files from KAP…',
    cols: ['File', 'Type', 'Size', 'Processing', 'Version', 'Changed'],
    mode: 'inline',
    rows: files.map((f) => fileRow(h, f, kind)),
    pager: {
      l: total ? `${fmt(pg.offset + 1)}–${fmt(Math.min(pg.offset + pg.size, total))} of ${fmt(total)}` : '0 files',
      size: pg.size,
      setSize: (size) => lv.setFilesAt(k.name, { offset: 0, size }),
      pg: `Page ${n} of ${pages}`,
      prev: () => n > 1 && lv.setFilesAt(k.name, { offset: pg.offset - pg.size, size: pg.size }),
      next: () => n < pages && lv.setFilesAt(k.name, { offset: pg.offset + pg.size, size: pg.size }),
      prevOff: n <= 1,
      nextOff: n >= pages,
    },
  };
}

// ================================================================== COLLECTION
export function liveCollectionScreen(h: Hub, id: string, tab0: string | undefined): ScreenModel {
  const x = derive(h);
  const { D, acc, ui } = h;
  const lv = h.live!;
  const C = lv.cache;
  const c = D.collections.find((y) => y.id === id);
  const k = kapColl(lv, id);
  if (!C.loaded) return loading(id);
  if (!c || !k || !acc.canRead(c.id)) return denied(h, 'collection', id);
  const kind = kindOf(k, C.pipelines);
  const pipe = C.pipelines?.find((p) => p.name === k.pipeline_ref) ?? null;
  const tab = COLLECTION_TABS.some(([q]) => q === tab0) ? tab0! : 'overview';
  const base = `collections/${enc(c.id)}`;
  const ags = x.agentsOf(c.id);
  const del = () =>
    ui.confirm(`Delete collection ${c.id}?`, 'KAP soft-deletes the collection: its data and role assignments are kept, and creating a collection with the same name reactivates it. Agents that use it can no longer search or query it.', ags.map((a) => ({ a, b: 'Agent', c: 'Uses this collection' })), 'Delete', async () => {
      const e = await lv.deleteCollection(c.id);
      if (!e) ui.go('collections');
      return e;
    });
  const head: PageHead = {
    title: c.id,
    tabs: tabsOf(COLLECTION_TABS),
    tab,
    setTab: (v) => ui.go(v === 'overview' ? base : `${base}/${v}`),
    status: collectionStatus(lv, k),
    acts: acc.canData ? [act('Edit settings', () => collectionForm(h, k)), act('Delete', del, 'ghost')] : [],
  };
  const o = C.obsTotal[k.id];
  const st = C.fileStates[k.id];
  let sections: Section[] = [];

  if (tab === 'overview')
    sections = [
      {
        form: true,
        rows: [
          fr('Description', '—', 'KAP collections have no description'),
          fr('Data types', kind === 'indicators' ? 'Structured' : 'Unstructured', kind === 'indicators' ? 'Indicator observations' : 'Documents (files)'),
          fr('Assets', contentsOf(lv, k), kind === 'indicators' ? `Dataset ${c.ds[0] ?? '—'}` : 'Files of the collection'),
          fr(
            'Processing and index status',
            collectionStatus(lv, k)[1],
            kind === 'indicators' ? (o ? `${fmt(o.review)} of ${fmt(o.total)} observations need review` : 'Not counted') : st ? `${fmt(st.failed)} failed · ${fmt(st.busy)} still processing` : 'Not counted',
          ),
          fr('Pipeline', k.pipeline_ref, pipe ? `${pipe.kind === 'indicators' ? 'Indicator metrics' : 'Document'} pipeline${pipe.embedding_model_ref ? ` · embedding ${pipe.embedding_model_ref}` : ''}` : 'Pipeline details could not be read', [act('Open', () => ui.go(`pipelines/${enc(k.pipeline_ref)}`))]),
          fr('Connectors', k.connectors.join(', ') || '—', `Sync strategy: ${k.sync_strategy}`),
          fr('Entity extraction', k.entity?.enabled ? `On · ${k.entity.entity_type_ref ?? '—'}` : 'Off', k.entity?.enabled ? 'Files are grouped into entities of this type' : '', [act('View', () => ui.go('entities'))]),
          fr('Access', x.label(c.id) || 'No access policy', 'Kept in this console only (session)', [act('Open Access & Usage', () => ui.go(`${base}/access`))]),
          fr('Created', day(k.created_at), `Updated ${ago(k.updated_at)}`),
        ],
      },
    ];

  if (tab === 'scope') {
    const dss = c.ds.map((i) => D.datasets.find((y) => y.id === i)).filter((y): y is NonNullable<typeof y> => !!y);
    sections =
      kind === 'indicators'
        ? [
            {
              title: 'Datasets',
              note: 'An indicator metrics collection holds one dataset: the observations its pipeline loads.',
              cols: ['Dataset', 'Type', 'Records', 'Membership', 'Status'],
              rows: dss.map((d) => openRow(`sd:${d.id}`, [cell(d.id, { m: true, sub: d.desc }), cell(d.kind), cell(fmt(d.rows)), cell('Whole collection'), cell('', { p: dsPill(d) })], () => ui.go(`structured/${enc(d.id)}`))),
            },
            filesSection(h, k, 'Package files'),
          ]
        : [filesSection(h, k, 'Documents')];
  }

  if (tab === 'retrieval')
    sections = [
      {
        form: true,
        title: 'Structured query',
        rows:
          kind === 'indicators'
            ? [
                fr('Indicator observations', 'Read by agents with indicator tools', 'Exact values by indicator and period; a value that needs review is returned with a data-quality warning'),
                fr('Datasets queried', c.ds.join(', ') || '—', ''),
              ]
            : [fr('Structured query', 'Not available', 'This collection has no observations')],
      },
      {
        form: true,
        title: 'Document search',
        rows:
          kind === 'document'
            ? [
                fr('Embedding model', pipe?.embedding_model_ref || '—', `Set by pipeline ${k.pipeline_ref}`),
                fr('Search mode, reranker, results per query, minimum relevance', '—', 'KAP has no per-collection search settings'),
              ]
            : [fr('Document search', 'Not available', 'This collection has no documents')],
      },
    ];

  if (tab === 'access')
    sections = [
      ...accessSections(h, `collection:${c.id}`).map((s, i) => (i === 0 ? { ...s, note: SESSION_ACCESS } : s)),
      {
        title: 'Assigned agents',
        note: 'From KAP: agents that list this collection. Assign collections on the agent (Agents → Knowledge & Tools).',
        empty: 'No agent uses this collection.',
        cols: ['Agent', 'Uses', 'Other collections'],
        mode: 'inline',
        rows: ags.map((a): Row => ({
          key: `ag:${a}`,
          cells: [cell(a, { m: true }), cell(kind === 'indicators' ? 'Structured query' : 'Document search'), cell((lv.agColl[a] ?? []).filter((q) => q !== c.id).join(', ') || '—')],
          acts: [act('Open agent', () => ui.go(`agents/${enc(a)}`))],
        })),
      },
      {
        title: 'Usage',
        note: 'KAP does not report how often a collection is used.',
        cols: ['Measure', 'Value'],
        rows: [['Queries and searches · 7 days', '—'], ['Last used', '—'], ['Assigned agents', String(ags.length)]].map(([q, v]) => ({ key: `u:${q}`, cells: [cell(q), cell(v)] })),
      },
      { form: true, rows: [fr('Agents and callers', 'Callers use their own access', "Assigning this collection to an agent does not give the agent's callers access. Each caller needs a read grant in KAP.")] },
    ];
  return { head, sections };
}

// ================================================================== DATASET (indicator observations)
function correctForm(h: Hub, ds: string, o: KapObservation) {
  const per = periodLabel(o.period_type, o.period_start);
  h.ui.form(`Correct ${o.indicator.external_id} · ${per}`, [
    { type: 'kv', rows: [['Indicator', `${o.indicator.external_id} · ${o.indicator.name_en}`], ['Period', `${per} (${o.period_type})`], ['Dimension', o.dimension || '—'], ['Current value', obsValue(o)], ['Status', obsStatus(o.status)], ['Issues', o.issues.join('; ') || 'None'], ['Source', obsSource(o)]] },
    { k: 'value', label: `Value${o.indicator.unit ? ` (${o.indicator.unit})` : ''}`, type: 'text', val: o.value ?? '' },
    { k: 'status', label: 'Status', type: 'select', opts: ['valid', 'needs_review'], val: o.status, hint: 'valid: only with a value, and when every flag is a value outside the allowed range (the flags are cleared). needs_review: keeps the flags and adds a manual review reason.' },
    { k: 'reason', label: 'Reason', type: 'text', ph: 'e.g. Confirmed with the publishing agency', hint: "KAP stores no reason; it is kept in this console's audit log." },
    { type: 'note', tone: 'warn', text: 'The next load of a package overwrites this observation (same indicator, period and dimension).' },
  ], 'Save', (v) => {
    const err = checkObservation(v);
    if (err) return err;
    return h.live!.correctObservation(ds, o.id, { value: String(v.value ?? ''), status: String(v.status ?? ''), reason: String(v.reason ?? '').trim() });
  });
}

function observationsSection(h: Hub, ds: string, k: KapCollection): Section {
  const lv = h.live!;
  const pg = lv.obsAt(ds);
  const page = lv.cache.obs[k.id]?.[obsKey(pg.status, pg.offset, pg.size)];
  const total = page?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pg.size));
  const n = Math.floor(pg.offset / pg.size) + 1;
  const set = (v: Partial<typeof pg>) => lv.setObsAt(ds, { ...pg, ...v });
  return {
    title: pg.status === 'needs_review' ? 'Observations that need review' : 'Observations',
    sacts: pg.status === 'needs_review' ? [act('Show all', () => set({ status: '', offset: 0 }))] : [act('Needs review only', () => set({ status: 'needs_review', offset: 0 }))],
    note: 'From KAP, newest period first.',
    empty: page ? (pg.status ? 'No observation needs review.' : 'No observations.') : 'Loading observations from KAP…',
    cols: ['Indicator', 'Period', 'Dimension', 'Value', 'Status', 'Issues', 'Source', 'Updated'],
    mode: 'inline',
    rows: (page?.items ?? []).map((o): Row => ({
      key: `o:${o.id}`,
      cells: [
        cell(o.indicator.external_id, { m: true, sub: o.indicator.name_en }),
        cell(periodLabel(o.period_type, o.period_start)),
        cell(o.dimension || '—'),
        cell(obsValue(o)),
        cell('', { p: o.status === 'valid' ? ['approved', 'Valid'] : ['hold', obsStatus(o.status)] }),
        cell(o.issues.join('; ') || '—'),
        cell(obsSource(o)),
        cell(ago(o.updated_at)),
      ],
      acts: h.acc.canData ? [act('Correct', () => correctForm(h, ds, o))] : [],
    })),
    pager: {
      l: total ? `${fmt(pg.offset + 1)}–${fmt(Math.min(pg.offset + pg.size, total))} of ${fmt(total)}` : '0 observations',
      size: pg.size,
      setSize: (size) => set({ size, offset: 0 }),
      pg: `Page ${n} of ${pages}`,
      prev: () => n > 1 && set({ offset: pg.offset - pg.size }),
      next: () => n < pages && set({ offset: pg.offset + pg.size }),
      prevOff: n <= 1,
      nextOff: n >= pages,
    },
  };
}

export function liveDatasetScreen(h: Hub, id: string, tab0: string | undefined): ScreenModel {
  const x = derive(h);
  const { D, ui } = h;
  const lv = h.live!;
  if (!lv.cache.loaded) return loading(id);
  const m = datasetScreen(h, id, tab0);
  const d = D.datasets.find((y) => y.id === id);
  const k = collectionOfDataset(lv.cache, id);
  if (m.denied || !d || !k) return m.denied ? m : denied(h, 'dataset', id);
  const tab = DATASET_TABS.some(([q]) => q === tab0) ? tab0! : 'overview';
  const o = lv.cache.obsTotal[k.id];
  const showReview = () => {
    lv.setObsAt(id, { ...lv.obsAt(id), status: 'needs_review', offset: 0 });
    ui.go(`structured/${enc(id)}/preview`);
  };
  const head: PageHead = { ...m.head, status: dsPill(d) };
  let sections = m.sections;

  if (tab === 'overview')
    sections = [
      {
        form: true,
        rows: [
          fr('Description', d.desc),
          fr('Type', d.kind, 'Indicator observations loaded by an indicator metrics pipeline'),
          fr('Collection', k.name, '', [act('Open', () => ui.go(`collections/${enc(k.name)}`))]),
          fr('Records', o ? fmt(o.total) : '—', 'Observations'),
          fr('Need review', o ? fmt(o.review) : '—', 'Flagged by the package validation or by a reviewer', o?.review ? [act('Show', showReview)] : []),
          fr('Fields', `${d.fields.length} fields`, 'Keys: indicator, period, dimension'),
          fr('Pipeline', k.pipeline_ref, `Connectors: ${k.connectors.join(', ') || '—'}`, [act('Open', () => ui.go(`pipelines/${enc(k.pipeline_ref)}`))]),
          fr('Last update', d.upd, 'Latest package file change, or the collection change'),
          fr('Access policies', x.polN(`dataset:${d.id}`) || 'None', 'Kept in this console only (session)', [], { lock: 'Managed in Roles & Permissions → Access Policies' }),
        ],
      },
    ];
  if (tab === 'preview') sections = [observationsSection(h, id, k)];
  if (tab === 'quality')
    sections = [
      {
        note: 'KAP validates each package on load; it reports flagged observations, not quality scores.',
        cols: ['Check', 'Result', 'Detail'],
        rows: [
          { key: 'q:review', cells: [cell('Observations flagged for review'), cell('', { p: !o ? ['draft', '—'] : o.review ? ['hold', `${fmt(o.review)} to review`] : ['approved', 'None'] }), cell(o ? `${fmt(o.review)} of ${fmt(o.total)} observations` : 'Not counted')], acts: o?.review ? [act('Review', showReview)] : [] },
          { key: 'q:keys', cells: [cell('Duplicate keys'), cell('—'), cell('KAP keeps one observation per indicator, period and dimension')] },
          { key: 'q:req', cells: [cell('Required fields and value ranges'), cell('—'), cell("Set in the pipeline's validation; failures show as issues on the observation")] },
          { key: 'q:fresh', cells: [cell('Freshness'), cell('—'), cell(`Last update ${d.upd}`)] },
        ],
      },
    ];
  if (tab === 'prov')
    sections = [
      ...m.sections.filter((s) => s.form),
      { ...filesSection(h, k, 'Source files and versions'), note: 'Package files of the collection. KAP does not report rows per file.' },
    ];
  if (tab === 'usage') sections = m.sections.map((s) => (s.title === 'Collections' ? { ...s, sacts: [], note: 'Datasets belong to their own collection in KAP.' } : s.title === 'Extracted entities' ? { ...s, empty: 'KAP has no API for extracted entities.' } : s)).map((s, i) => (i === 0 ? { ...s, note: SESSION_ACCESS } : s));
  return { head, sections };
}

// ================================================================== DOCUMENTS
export function liveDocumentsScreen(h: Hub, F: UdFilters, setF: (f: UdFilters) => void): ScreenModel {
  const m = documentsScreen(h, F, setF);
  const tr = h.live!.cache.truncated;
  return {
    ...m,
    sections: m.sections.map((s, i) =>
      i === 0
        ? {
            ...s,
            sacts: h.acc.canData ? [act('Open Ingestion Pipelines', () => h.ui.go('pipelines'))] : [],
            note: `Files of every document collection in KAP${tr.length ? ` (newest ${fmt(MAX_DOCS)} of ${tr.join(', ')})` : ''}. Classification is kept in this console only; KAP reports no language, pages or extracted entities.`,
            empty: h.live!.cache.loaded ? s.empty : 'Loading documents from KAP…',
          }
        : s,
    ),
  };
}

export function liveDocumentScreen(h: Hub, id: string, tab0: string | undefined, results: string[] | null): ScreenModel {
  const { ui, acc } = h;
  const lv = h.live!;
  const C = lv.cache;
  const f = docIds(C).get(id);
  if (!C.loaded || !f) return loading(id);
  const m = documentScreen(h, id, tab0, results);
  if (m.denied) return m;
  const d = h.D.documents.find((y) => y.id === id)!;
  const k = C.collections.find((c) => c.id === f.collection_id)!;
  const pipe = C.pipelines?.find((p) => p.name === k.pipeline_ref) ?? null;
  const tab = DOCUMENT_TABS.some(([q]) => q === tab0) ? tab0! : 'overview';
  const vers = C.versions[f.id]?.slice().sort((a, b) => b.version_number - a.version_number);
  const download = act('Download', () => lv.download(id));
  const head: PageHead = {
    ...m.head,
    status: pstPill(d.pst, d.pst),
    acts: [...(m.head.acts ?? []), download, ...(acc.canData ? [act('Reprocess', () => reprocessConfirm(h, id, f)), act('Delete', () => deleteFileConfirm(h, id, f, true), 'ghost')] : [])],
  };
  const baseRow = (label: string) => m.sections.flatMap((s) => (s.form ? (s.rows ?? []) : [])).find((r) => r.cells[0].v === label);
  const sessionRow = (label: string) => {
    const r = baseRow(label);
    return r ? { ...r, cells: [r.cells[0], { ...r.cells[1], sub: 'Kept in this console only (session)' }] } : fr(label, '—');
  };
  let sections = m.sections;

  if (tab === 'overview')
    sections = [
      {
        form: true,
        rows: [
          fr('Title', f.name, f.source_path),
          fr('Type', d.ty, bytes(f.size_bytes)),
          fr('Collection', k.name, `Connector ${d.src.conn || f.connector_id}`, [act('Open', () => ui.go(`collections/${enc(k.name)}`))]),
          fr('Latest version', d.vers[0][0], d.vers[0][1] + (d.vers[0][2] ? ` · ${d.vers[0][2]}` : '')),
          fr('Content changed', day(f.content_changed_at), `Added ${day(f.created_at)}`),
          fr('Processing', d.pst, `KAP state: ${stateLabel(f.state)}`),
          fr('Language and pages', '—', 'KAP does not report them'),
          sessionRow('Classification'),
          sessionRow('Need-to-know'),
          sessionRow('Collection restrictions'),
          fr('Entity extraction', k.entity?.enabled ? `On · ${k.entity.entity_type_ref ?? '—'}` : 'Off', "The collection's setting"),
        ],
      },
    ];
  if (tab === 'versions')
    sections = [
      {
        empty: vers ? 'No versions stored yet.' : 'Loading versions from KAP…',
        cols: ['Version', 'Created', 'Size', 'Content hash', 'Processed', 'Current'],
        rows: (vers ?? []).map((v) => ({
          key: `v:${v.id}`,
          cells: [cell(`v${v.version_number}`, { m: true }), cell(day(v.created_at), { sub: v.mtime ? `Source modified ${day(v.mtime)}` : '' }), cell(bytes(v.size_bytes)), cell(v.content_sha256.slice(0, 12), { m: true, tip: v.content_sha256 }), cell(v.processed_at ? day(v.processed_at) : 'Not processed'), cell(v.is_current ? 'Current' : '—')],
        })),
      },
    ];
  if (tab === 'proc') {
    const p = h.ing.pipelines.find((y) => y.id === k.pipeline_ref);
    sections = [
      {
        form: true,
        sacts: acc.canData ? [act('Reprocess', () => reprocessConfirm(h, id, f))] : [],
        rows: [
          fr('Status', d.pst, d.err || ''),
          fr('KAP state', stateLabel(f.state), f.processing_started_at ? `Processing started ${ago(f.processing_started_at)}` : ''),
          fr('Last processed', f.current_version?.processed_at ? day(f.current_version.processed_at) : vers?.find((v) => v.is_current)?.processed_at ? day(vers.find((v) => v.is_current)!.processed_at) : '—', 'Current version'),
          fr('Processing pipeline', k.pipeline_ref, p?.uSteps.length ? p.uSteps.join(' → ') : '', [act('Open', () => ui.go(`pipelines/${enc(k.pipeline_ref)}/config`))]),
          fr('Embedding model', pipe?.embedding_model_ref || '—', 'Set by the pipeline'),
          fr('Chunks', '—', 'KAP does not report chunks per file'),
        ],
      },
    ];
  }
  if (tab === 'content') sections = [{ form: true, rows: [fr('Extracted content', 'Not available from KAP', 'KAP serves the original file; extracted text and chunks are not exposed.', [download])] }];
  if (tab === 'ents')
    sections = [{ form: true, rows: [fr('Entity extraction', k.entity?.enabled ? `On · ${k.entity.entity_type_ref ?? '—'}` : 'Off', "The collection's setting"), fr('Extracted entities', '—', 'KAP has no API for the entities extracted from a file')] }];
  if (tab === 'usage') sections = m.sections.map((s) => (s.title === 'Collections' ? { ...s, sacts: [], note: 'A file belongs to the collection whose connectors deliver it.' } : s));
  return { head, sections };
}

// ================================================================== BUSINESS ENTITIES
const DT_LIVE = ['Text', 'Number', 'Date', 'Boolean', 'Category'];

export function liveEntitiesScreen(h: Hub, v: EntitiesView): ScreenModel {
  const { D, acc, ui } = h;
  const lv = h.live!;
  const C = lv.cache;
  const tab = ENTITY_TABS.some(([q]) => q === v.tab) ? v.tab! : 'types';
  const m = entitiesScreen(h, v);
  const head: PageHead = { ...m.head, add: undefined };
  const canData = acc.canData;
  const RL = D.onto.rels;
  let sections = m.sections;

  if (tab === 'types') {
    const createF = () =>
      ui.form('Create entity type', [
        { k: 'n', label: 'Name', type: 'text', ph: 'e.g. Supplier', hint: '4–64 letters, digits and underscores.' },
        { k: 'd', label: 'Description', type: 'text' },
        { k: 'idn', label: 'First attribute', type: 'text', ph: 'e.g. supplier_id', hint: 'Required on every entity. Add more attributes afterwards.' },
        { k: 'idt', label: 'Data type', type: 'select', opts: DT_LIVE, val: 'Text' },
      ], 'Create', (f) => {
        const n = String(f.n ?? '').trim();
        const err = checkEntityTypeName(n, C.entityTypes.map((e) => e.name));
        if (err) return err;
        if (!String(f.idn ?? '').trim()) return 'Enter the first attribute.';
        return lv.createEntityType(f);
      });
    const editF = (name: string, d0: string) =>
      ui.form(`Edit entity type · ${name}`, [
        { k: 'n', label: 'Name', type: 'text', val: name, ro: true },
        { k: 'd', label: 'Description', type: 'text', val: d0 },
        { type: 'note', tone: 'info', text: 'Changing the description re-ingests every collection that extracts this type. KAP has no extraction guidance.' },
      ], 'Save', (f) => {
        const d = String(f.d ?? '').trim();
        if (d === d0) return 'No change.';
        return lv.updateEntityType(name, { description: d }, 'description');
      });
    const attrF = (name: string) => {
      const e = C.entityTypes.find((y) => y.name === name)!;
      ui.form(`Add attribute · ${name}`, [
        { k: 'n', label: 'Attribute', type: 'text', val: '' },
        { k: 'ty', label: 'Data type', type: 'select', opts: DT_LIVE, val: 'Text' },
        { k: 'req', label: 'Required', type: 'select', opts: ['No', 'Yes'], val: 'No' },
        { k: 'hint', label: 'Description (optional)', type: 'text', val: '' },
        { type: 'note', tone: 'warn', text: 'Changing the schema re-ingests every collection that extracts this type.' },
      ], 'Add', (f) => {
        const n = String(f.n ?? '').trim();
        if (!n) return 'Enter the attribute name.';
        if (Object.keys(e.schema?.properties ?? {}).some((a) => a.toLowerCase() === n.toLowerCase())) return 'This attribute exists.';
        return lv.updateEntityType(name, { schema: schemaWithAttr(e.schema, { n, ty: String(f.ty), req: f.req === 'Yes', hint: String(f.hint ?? '').trim() }) }, `added attribute ${n}`);
      });
    };
    const rmAttr = (name: string, a: string) => {
      const e = C.entityTypes.find((y) => y.name === name)!;
      ui.confirm(`Remove attribute ${a} from ${name}?`, 'KAP replaces the schema; every collection that extracts this type is re-ingested.', [], 'Remove', () => lv.updateEntityType(name, { schema: schemaWithoutAttr(e.schema, a) }, `removed attribute ${a}`));
    };
    const del = (name: string) => {
      const used = collectionsUsingType(C, name);
      if (used.length) return ui.form(`Delete entity type ${name}?`, [{ type: 'note', tone: 'warn', text: 'KAP keeps an entity type while a collection refers to it. Change these collections first:' }, { type: 'kv', rows: used.map((c) => [c, 'Collection · entity extraction']) }], 'Close', () => '');
      ui.confirm(`Delete entity type ${name}?`, 'KAP deactivates the entity type; it is no longer served by the API.', [], 'Delete', () => lv.deleteEntityType(name));
    };
    head.add = canData ? act('Create entity type', createF, 'primary') : undefined;
    sections = [
      {
        empty: C.loaded ? 'No entity types yet.' : '',
        note: 'From KAP. Attributes are the properties of the entity type\'s JSON Schema.',
        cols: ['Entity type', 'Attributes', 'Required', 'Relationship types', 'Used by collections', 'Updated'],
        mode: 'panel',
        rows: C.entityTypes.map((e): Row => {
          const t = D.onto.types.find((y) => y.n === e.name);
          const attrs = t?.attrs ?? [];
          const used = collectionsUsingType(C, e.name);
          const rs = RL.filter((r) => r.src === e.name || r.tgt === e.name);
          return {
            key: `t:${e.name}`,
            cells: [cell(e.name, { sub: e.description }), cell(String(attrs.length)), cell(attrs.filter((a) => a.req).map((a) => a.n).join(', ') || '—'), cell(String(rs.length), { tip: 'Kept in this console only (session)' }), cell(used.join(', ') || 'None'), cell(ago(e.updated_at))],
            kv: kv([['Description', e.description], ['Created', day(e.created_at)], ['Extracted entities', '— (KAP does not report them)']]),
            lists: [
              {
                title: 'Attributes',
                empty: 'None',
                items: attrs.map((a) => ({ a: a.n, b: a.ty + (a.req ? ' · required' : ''), c: a.hint, x: canData ? () => rmAttr(e.name, a.n) : undefined, xl: canData ? 'Remove' : '' })),
              },
              { title: 'Collections', empty: 'No collection extracts this type', items: used.map((c) => ({ a: c, b: 'Entity extraction', x: () => ui.go(`collections/${enc(c)}`), xl: 'Open' })) },
            ],
            acts: canData ? [act('Add attribute', () => attrF(e.name)), act('Edit', () => editF(e.name, e.description)), act('Delete', () => del(e.name), 'ghost')] : [],
          };
        }),
      },
    ];
  }
  if (tab === 'rels') {
    head.add = m.head.add;
    sections = m.sections.map((s, i) => (i === 0 ? { ...s, note: 'Kept in this console only (session): KAP has no relationship types.' } : s));
  }
  if (tab === 'map') sections = m.sections;
  if (tab === 'inst') {
    const on = C.collections.filter((c) => c.entity?.enabled);
    sections = [
      { form: true, rows: [fr('Extracted entities', 'Not available from KAP', 'KAP has no API that lists extracted entities. Collections with entity extraction group their files into entities of the selected type.')] },
      {
        title: 'Entity extraction by collection',
        empty: 'No collection extracts entities.',
        cols: ['Collection', 'Entity type', 'Files'],
        rows: on.map((c) => openRow(`ex:${c.name}`, [cell(c.name, { m: true }), cell(c.entity.entity_type_ref ?? '—'), cell(C.fileTotal[c.id] != null ? fmt(C.fileTotal[c.id]) : '—')], () => ui.go(`collections/${enc(c.name)}`))),
      },
    ];
  }
  if (tab === 'agents') {
    const typeOf = (n: string) => {
      const c = C.collections.find((y) => y.name === n);
      return c?.entity?.enabled ? (c.entity.entity_type_ref ?? null) : null;
    };
    const rows = Object.entries(lv.agColl)
      .map(([a, cs]) => ({ a, cs: cs.filter((n) => typeOf(n)) }))
      .filter((r) => r.cs.length)
      .sort((p, q) => p.a.localeCompare(q.a));
    sections = [
      { form: true, rows: [fr('Where to change this', 'Agents → Knowledge & Tools', 'From KAP: agents and the collections they use. Read-only here.')] },
      {
        title: 'Agents using collections with entity extraction',
        empty: 'No agent uses a collection with entity extraction.',
        cols: ['Agent', 'Collections', 'Entity types'],
        rows: rows.map(({ a, cs }) => openRow(`ag:${a}`, [cell(a, { m: true }), cell(cs.join(', ')), cell([...new Set(cs.map((n) => typeOf(n)!))].join(', '))], () => ui.go(`agents/${enc(a)}`))),
      },
    ];
  }
  return { head, sections };
}

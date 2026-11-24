/**
 * Data source and pipeline wizards (create and edit), port of the prototype's
 * `srcWizard` and `pipeWizard`. Each returns a WizardSpec for `useDialogs().wizard`.
 */
import type { FormField, FormValues, WizardSpec } from '@/engine/dialogs';
import type { IngestTenant, PipeCfg, Pipeline, Source } from '@/v35/data/ingest';
import { ENT_S, ENT_U, firstStep, isDb, isFile, kindOf, outOf, pipeDgm, SRC_TYPES, srcOf, STR_ALL, testConn, UNS_ALL, UNS_REQ } from './logic';

/**
 * Selects show their first option before the user touches them; record that
 * value so validation and the summary see what the user sees (the dialog keeps
 * this values object between renders and steps).
 */
function withDefaults(fields: FormField[], v: FormValues): FormField[] {
  fields.forEach((f) => {
    if (f.type === 'select' && (v[f.k] == null || v[f.k] === '') && f.opts.length) v[f.k] = f.opts[0];
  });
  return fields;
}

const NAME_RX = /^[a-z][a-z0-9_]{2,40}$/;

// ------------------------------------------------------------------ data source
export const AUTH: Record<string, string[]> = {
  S3: ['Access key', 'IAM role / instance identity'],
  'Microsoft SQL Server': ['SQL login', 'Windows / Kerberos service account', 'Microsoft Entra ID'],
  'Data warehouse · Azure Synapse': ['Microsoft Entra ID service principal', 'Managed identity', 'SQL login'],
  'Data warehouse · Snowflake': ['Key-pair authentication', 'OAuth'],
  'Data warehouse · Google BigQuery': ['Service account key', 'Workload identity federation'],
  'REST API': ['OAuth 2.0 client credentials', 'API key header', 'Bearer token', 'None'],
  'File repository': ['Service identity', 'Username and password', 'Microsoft Entra ID application'],
};
export const NOSECRET = (a: string) => /identity|IAM role|Managed identity|Kerberos|federation|^None$/i.test(a);

export const cfgFields = (ty: string): [string, string, string][] =>
  ty === 'S3'
    ? [['endpoint', 'Endpoint URL', 'https://s3.example.internal'], ['region', 'Region', 'e.g. me-central-1'], ['bucket', 'Bucket', 'bucket-name'], ['base', 'Base path (optional)', 'e.g. /exports']]
    : ty === 'Microsoft SQL Server'
      ? [['server', 'Server address', 'sql01.example.internal'], ['port', 'Port', '1433'], ['db', 'Database', 'e.g. SalesDB']]
      : ty === 'Data warehouse · Azure Synapse'
        ? [['endpoint', 'Workspace SQL endpoint', 'workspace.sql.azuresynapse.net'], ['pool', 'Dedicated SQL pool', 'e.g. edw'], ['schema', 'Default schema', 'e.g. mart']]
        : ty === 'Data warehouse · Snowflake'
          ? [['account', 'Account identifier', 'org-account'], ['wh', 'Virtual warehouse', 'e.g. INGEST_WH'], ['db', 'Database', 'e.g. EDW'], ['schema', 'Schema', 'e.g. MART'], ['role', 'Role', 'e.g. KAP_READER']]
          : ty === 'Data warehouse · Google BigQuery'
            ? [['project', 'Project ID', 'my-project'], ['dataset', 'Dataset', 'e.g. analytics'], ['loc', 'Location', 'e.g. me-central2']]
            : ty === 'REST API'
              ? [['url', 'Base URL', 'https://api.example.com/v1'], ['test', 'Test endpoint path', '/health'], ['headers', 'Additional headers (optional)', 'Accept: application/json']]
              : [['path', 'Path or URL', '\\\\server\\share\\folder or sftp://host/path']];

export interface SourceSaved {
  rec: Source;
  edit: boolean;
  ok: boolean;
  /** a new, empty credential reference to register */
  newRef: string | null;
}

export function validateSource(H: IngestTenant, edit: boolean, step: number, v: FormValues): string {
  if (step === 0 && !v.type) return 'Select a source type.';
  if (step === 1 && !edit) {
    const id = (v.id || '').trim();
    if (!NAME_RX.test(id)) return 'Name: 3–41 lower-case letters, digits and underscores.';
    if (H.sources.some((x) => x.id === id)) return 'A data source with this name exists.';
  }
  if (step === 2) {
    const miss = cfgFields(v.type).filter(([k, l]) => !/optional/i.test(l) && !(v[k] || '').trim());
    if (miss.length) return `Enter ${miss[0][1].toLowerCase()}.`;
    if (v.type === 'Microsoft SQL Server' && !/^\d{2,5}$/.test(v.port || '')) return 'Port must be a number.';
    if (v.type === 'Microsoft SQL Server' && v.tls === 'No encryption') return 'Unencrypted connections are not allowed. Choose an encrypted option.';
    if (v.type === 'REST API' && v.url && !/^https:\/\//.test(v.url)) return 'The base URL must start with https://.';
  }
  if (step === 3) {
    if (NOSECRET(v.auth || '')) {
      if (v.cred && v.cred !== 'Not needed (identity-based)' && v.cred !== 'Choose a managed credential') return 'This method uses an identity; set the credential to "Not needed".';
    } else {
      if (!v.cred || v.cred === 'Choose a managed credential' || v.cred === 'Not needed (identity-based)') return `Choose a managed credential for ${v.auth}.`;
      if (v.cred === 'New reference…' && !NAME_RX.test(v.newref || '')) return 'Enter a reference name (lower-case letters, digits, underscores).';
    }
  }
  if (step === 4 && !v.__test) return 'Run the connection test first.';
  return '';
}

/** The record the wizard saves. */
export function sourceRecord(v: FormValues, s: Source | null, actor: string): SourceSaved {
  const edit = !!s;
  const r: { ok?: boolean; msg?: string } = v.__test || {};
  const cfg: Record<string, string> = Object.fromEntries([
    ...cfgFields(v.type).map(([k]) => [k, (v[k] || '').trim()]),
    ...(v.type === 'File repository' ? [['repo', v.repo]] : []),
    ...(v.type === 'Microsoft SQL Server' ? [['tls', v.tls]] : []),
  ]);
  const cred = v.cred === 'New reference…' ? v.newref : NOSECRET(v.auth) ? '' : v.cred;
  const sch = v.schema || v.dataset || 'mart';
  const rec: Source = {
    id: edit ? s!.id : v.id.trim(),
    type: v.type,
    desc: (v.desc || '').trim(),
    cfg,
    auth: v.auth,
    cred,
    ident: v.ident || '',
    st: r.ok ? 'Connected' : 'Failed',
    err: r.ok ? '' : r.msg,
    chk: 'just now',
    impl: v.type === 'S3' ? 'Implemented' : 'Planned',
    browse: r.ok
      ? v.type === 'Microsoft SQL Server'
        ? [['dbo.Customers', 'Table', '—'], ['dbo.Orders', 'Table', '—'], ['dbo.vw_OrderSummary', 'View', '—']]
        : v.type.startsWith('Data warehouse')
          ? [[`${sch}.fact_sales`, 'Table', '—'], [`${sch}.vw_sales_monthly`, 'View', '—'], ['sales_by_region', 'Saved query', 'Draft']]
          : v.type === 'REST API'
            ? [[v.test || '/', 'Endpoint', 'GET']]
            : [['/', 'Folder', '—']]
      : [],
    act: [['just now', actor, `${edit ? 'Edited data source' : 'Created data source'} · connection test ${r.ok ? 'succeeded' : 'failed'}`] as [string, string, string], ...(edit ? s!.act : [])],
  };
  return { rec, edit, ok: !!r.ok, newRef: v.cred === 'New reference…' ? v.newref : null };
}

export interface SourceWizardOpts {
  /** start at the name step with this type */
  preType?: string;
  /** live tenant: the source is kept in this session only (KAP cannot store this type) */
  sessionOnly?: boolean;
}

export function sourceWizard(H: IngestTenant, s: Source | null, actor: string, save: (r: SourceSaved) => void, o: SourceWizardOpts = {}): WizardSpec {
  const edit = !!s;
  const types = o.sessionOnly ? SRC_TYPES.filter((x) => x !== 'S3') : SRC_TYPES;
  return {
    title: edit ? `Edit ${s!.id}` : o.sessionOnly ? 'Create data source · session only' : 'Create data source',
    steps: ['Source type', 'Name', 'Connection', 'Credentials', 'Test', 'Review'],
    finishL: edit ? 'Save changes' : 'Create data source',
    initial: edit ? { type: s!.type, id: s!.id, desc: s!.desc, ...s!.cfg, auth: s!.auth, cred: s!.cred || 'Not needed (identity-based)', ident: s!.ident || '' } : { type: o.preType ?? types[0] },
    initialStep: !edit && o.preType ? 1 : undefined,
    fields: (step, v, set) => {
      const ty: string = v.type;
      let f: FormField[];
      if (step === 0)
        f = [
          ...(edit ? [{ k: 'type', label: 'Source type', type: 'text', ro: true } as FormField] : [{ k: 'type', label: 'Source type', type: 'select', opts: types } as FormField]),
          ...(o.sessionOnly ? [{ type: 'note', tone: 'warn', text: `${ty || 'This type'} is not available in KAP. The source is kept in this browser session only; its connection test and runs are simulated.` } as FormField] : []),
        ];
      else if (step === 1)
        f = [
          { k: 'id', label: 'Name', type: 'text', ro: edit, ph: 'e.g. sales_dwh', hint: edit ? 'The name cannot be changed because pipelines refer to it.' : 'Lower-case letters, digits and underscores.' },
          { k: 'desc', label: 'Description', type: 'text' },
        ];
      else if (step === 2)
        f = [
          ...(ty === 'File repository' ? [{ k: 'repo', label: 'Repository type', type: 'select', opts: ['SMB network share', 'NFS mount', 'SFTP server', 'SharePoint document library'] } as FormField] : []),
          ...cfgFields(ty).map(([k, l, ph]): FormField => ({ k, label: l, type: 'text', ph })),
          ...(ty === 'Microsoft SQL Server' ? [{ k: 'tls', label: 'Encryption', type: 'select', opts: ['Encrypt (TLS 1.2+), validate certificate', 'Encrypt, trust internal CA', 'No encryption'], hint: 'Unencrypted connections are not allowed.' } as FormField] : []),
        ];
      else if (step === 3) {
        const am = AUTH[ty] || ['None'];
        const refs = ['Choose a managed credential', ...H.creds, 'New reference…'];
        f = [
          { k: 'auth', label: 'Authentication method', type: 'select', opts: am },
          { k: 'cred', label: 'Managed credential', type: 'select', opts: ['Not needed (identity-based)', ...refs], hint: 'Credentials are managed in Security & Credentials.' },
          ...(v.cred === 'New reference…' ? [{ k: 'newref', label: 'New reference name', type: 'text', ph: 'e.g. sales_dwh_reader', hint: 'Creates an empty credential reference. Its value is set in Security & Credentials.' } as FormField] : []),
          ...(/identity/i.test(v.auth || '') ? [{ k: 'ident', label: 'Service identity', type: 'text', ph: 'e.g. svc-kap-ingest' } as FormField] : []),
        ];
      } else if (step === 4) {
        const r = v.__test;
        f = [
          { type: 'button', label: r ? 'Test again' : 'Test connection', click: () => set('__test', testConn(ty, v)) },
          r
            ? { type: 'note', label: r.ok ? 'Connection succeeded' : 'Connection failed', text: r.msg, tone: r.ok ? 'ok' : 'bad' }
            : { type: 'note', text: 'A source whose test failed is saved with status Failed and cannot be used by pipelines.', tone: 'info' },
        ];
      } else {
        const r = v.__test || {};
        f = [
          {
            type: 'kv',
            label: 'Summary',
            rows: [
              ['Type', ty],
              ['Name', v.id],
              ['Description', v.desc],
              ...cfgFields(ty).map(([k, l]): [string, unknown] => [l, v[k]]),
              ['Authentication', v.auth],
              ['Credential', v.cred === 'New reference…' ? `${v.newref} (new, value not set)` : v.cred],
              ['Connection test', r.ok ? 'Succeeded' : 'Failed'],
            ],
          },
          ...(r.ok ? [] : [{ type: 'note', text: 'The source will be saved with status Failed.', tone: 'bad' } as FormField]),
        ];
      }
      return withDefaults(f, v);
    },
    validate: (step, v) => (o.sessionOnly && step === 0 && v.type === 'S3' ? 'Create S3 sources in KAP.' : validateSource(H, edit, step, v)),
    finish: (v) => {
      save(sourceRecord(v, s, actor));
      return '';
    },
  };
}

// ------------------------------------------------------------------ pipeline
export const SAMPLE_FILES = ['Q3_board_minutes.pdf', 'supplier_contracts.docx', 'regional_sales_2026.csv', 'warehouse_stock.xlsx', 'site_inspections.zip'];

export interface PipeSaved {
  rec: Pipeline;
  edit: boolean;
  runNow: boolean;
}

const sid = (v: FormValues) => ((v.srcL || '').startsWith('Manual') ? 'manual' : (v.srcL || '').split(' · ')[0]);
const tyOf = (H: IngestTenant, v: FormValues) => (sid(v) === 'manual' ? 'Manual upload' : srcOf(H, sid(v))?.type ?? '');

export const pipeSrcOpts = (H: IngestTenant) => [...H.sources.filter((s) => s.st !== 'Disabled').map((s) => `${s.id} · ${s.type}`), 'Manual upload (no data source)'];

export function validatePipe(H: IngestTenant, edit: boolean, step: number, v: FormValues): string {
  const ty = tyOf(H, v);
  const kind = kindOf(H, { ...v, src: sid(v) });
  if (step === 0) {
    const id = (v.id || '').trim();
    if (!edit) {
      if (!NAME_RX.test(id)) return 'Name: 3–41 lower-case letters, digits and underscores.';
      if (H.pipelines.some((x) => x.id === id)) return 'A pipeline with this name exists.';
    }
    if (!v.srcL) return 'Choose a data source or manual upload.';
    const s = srcOf(H, sid(v));
    if (s && s.st === 'Failed') return `${s.id} failed its last connection test. Fix and test it before using it in a pipeline.`;
  }
  if (step === 1) {
    if (isFile(ty) && ty !== 'Manual upload') {
      if (!(v.path || '').trim()) return 'Enter a path, prefix or file.';
      if (!(v.pat || '').trim()) return 'Enter a file pattern such as *.csv.';
      if (v.sel === 'Single file' && /\/$|\\$/.test(v.path)) return 'A single file path cannot end with a slash.';
      if (v.zip === 'Yes' && v.sel === 'Single file' && !/\.zip$/i.test(v.path)) return 'ZIP extraction with a single file needs a .zip file.';
    }
    if (ty === 'Manual upload' && !(v.files || []).length) return 'Select at least one file.';
    if (isDb(ty)) {
      const n = (v.objs || []).length;
      const q = v.query && v.query !== 'None';
      if (!n && !q) return 'Select at least one table or view, or a saved query.';
      if (n && q) return 'Use either tables/views or a saved query, not both.';
      if ((v.ext || '').includes('watermark') && !(v.wm || '').trim()) return 'Enter the watermark column.';
    }
    if (ty === 'REST API' && !/^\//.test(v.path || '')) return 'The endpoint path must start with /.';
  }
  if (step === 2) {
    const first = firstStep(ty);
    if (((v.uSteps || []).includes(ENT_U) || (v.sSteps || []).includes(ENT_S)) && !(v.entTypes || []).length) return 'Select at least one entity type to extract.';
    if (kind !== 'Unstructured') {
      const s = v.sSteps || [];
      if (!s.includes(first) || !s.includes('Load structured records')) return `The structured path needs ${first} and Load structured records.`;
    }
    if (kind !== 'Structured') {
      const miss = UNS_REQ.filter((x) => !(v.uSteps || []).includes(x));
      if (miss.length) return `The document path needs ${miss.join(', ')}.`;
    }
  }
  if (step === 3 && kind !== 'Unstructured') {
    if (!/^[a-z{][a-z0-9_{}]{1,60}$/.test((v.dsName || '').trim())) return 'Enter a dataset name (lower-case, digits, underscores, optional {file} or {table}).';
    if ((v.mode || '').startsWith('Incremental') && !(v.keys || '').trim()) return 'Incremental update needs key columns.';
  }
  if (step === 4) {
    if (v.trig === 'Schedule' && !v.sched) return 'Choose a schedule.';
    if (v.trig === 'Event' && !v.ev) return 'Choose the event.';
  }
  return '';
}

/** Sensible defaults for the processing steps once the input is known (prototype: after step 1). */
export function processingDefaults(H: IngestTenant, v: FormValues) {
  const ty = tyOf(H, v);
  const first = firstStep(ty);
  v.chg = v.chg || (ty === 'S3' ? 'Object version / ETag' : 'Last-modified timestamp');
  if (!(v.sSteps || []).length) v.sSteps = STR_ALL(first).filter((x) => x !== ENT_S);
  if (!(v.uSteps || []).length) v.uSteps = UNS_ALL.filter((x) => x !== 'Antivirus scan' && x !== 'Translation' && x !== ENT_U);
}

export function pipeRecord(H: IngestTenant, v: FormValues, p: Pipeline | null): PipeSaved {
  const edit = !!p;
  const src = sid(v);
  const kind = kindOf(H, { ...v, src });
  const ty = tyOf(H, v);
  const cfg: PipeCfg = {
    src, sel: v.sel, path: v.path, pat: v.pat, rec: v.rec, zip: v.zip, which: v.which, chg: v.chg, files: v.files, objs: v.objs, query: v.query, ext: v.ext, wm: v.wm,
    params: v.params, page: v.page, inc: v.inc, resp: v.resp,
    sSteps: kind === 'Unstructured' ? [] : v.sSteps || [], uSteps: kind === 'Structured' ? [] : v.uSteps || [],
    chunk: v.chunk, entTypes: v.entTypes || [], entConf: v.entConf || '0.70',
    dsName: kind === 'Unstructured' ? '' : (v.dsName || '').trim(), mode: v.mode, keys: v.keys, colls: v.colls || [], trig: v.trig, sched: v.sched, ev: v.ev,
  };
  const rec: Pipeline = {
    id: edit ? p!.id : v.id.trim(),
    on: v.onL === 'Enabled',
    impl: edit ? p!.impl : ty === 'S3' && kind !== 'Mixed' && v.zip !== 'Yes' ? 'Implemented' : 'Planned',
    desc: (v.desc || '').trim(),
    v: cfg,
  };
  return { rec, edit, runNow: v.first === 'Save and run now' && rec.on };
}

export function pipeWizard(H: IngestTenant, p: Pipeline | null, save: (r: PipeSaved) => void, preSource?: Source, sessionOnly?: boolean): WizardSpec {
  const edit = !!p;
  // live tenant: a session-only pipeline reads from session-only sources (KAP pipelines get their files through collections)
  const srcOpts = sessionOnly ? pipeSrcOpts({ ...H, sources: H.sources.filter((s) => (s as { sess?: boolean }).sess) }) : pipeSrcOpts(H);
  const colls = H.pub.colls.map((c) => c.id);
  const ONTO = H.onto;
  const initial: FormValues = edit
    ? { ...p!.v, id: p!.id, desc: p!.desc, srcL: p!.v.src === 'manual' ? 'Manual upload (no data source)' : `${p!.v.src} · ${srcOf(H, p!.v.src)?.type}`, onL: p!.on ? 'Enabled' : 'Disabled', first: 'Save only' }
    : { onL: 'Enabled', sel: 'Folder / prefix', rec: 'No', zip: 'No', which: 'New or changed files only', chg: '', sSteps: [], uSteps: [], entTypes: [], entConf: '0.70', chunk: 'By heading · 800 tokens · 100 overlap', mode: 'Full refresh (replace)', colls: [], trig: 'Manual only', ext: 'Full refresh', page: 'None', inc: 'Full refresh', resp: 'Records (structured)', query: 'None', first: 'Save only', srcL: preSource ? `${preSource.id} · ${preSource.type}` : srcOpts[0] };

  const stepFields = (step: number, v: FormValues): FormField[] => {
    const ty = tyOf(H, v);
    const vv = { ...v, src: sid(v) };
    const kind = kindOf(H, vv);
    if (step === 0)
      return [
        { k: 'id', label: 'Pipeline name', type: 'text', ro: edit, ph: 'e.g. sales_dwh_daily', hint: edit ? 'The name cannot be changed because runs refer to it.' : 'Lower-case letters, digits and underscores.' },
        { k: 'desc', label: 'Description', type: 'text' },
        { k: 'srcL', label: 'Data source', type: 'select', opts: srcOpts, hint: 'Disabled sources are not listed.' },
        { k: 'onL', label: 'State', type: 'select', opts: ['Enabled', 'Disabled'] },
      ];
    if (step === 1) {
      if (isFile(ty) && ty !== 'Manual upload')
        return [
          { k: 'sel', label: 'Select', type: 'select', opts: ['Folder / prefix', 'Single file'] },
          { k: 'path', label: 'Path, prefix or file', type: 'text', ph: 'e.g. exports/2026/ or exports/delivery.zip' },
          { k: 'pat', label: 'File pattern', type: 'text', ph: '*.csv, *.pdf', hint: 'Comma-separated. Inside a ZIP archive the pattern selects the extracted files.' },
          { k: 'rec', label: 'Scan subfolders', type: 'select', opts: ['No', 'Yes'] },
          { k: 'zip', label: 'Extract ZIP archives', type: 'select', opts: ['No', 'Yes'] },
          { k: 'which', label: 'Files to process', type: 'select', opts: ['New or changed files only', 'All matching files'] },
          {
            k: 'chg',
            label: 'Change detection',
            type: 'select',
            opts: ty === 'S3' ? ['Object version / ETag', 'Last-modified timestamp', 'Checksum inventory'] : ['Last-modified timestamp', 'Checksum inventory'],
            hint: ty === 'S3' ? 'Object versions require versioning on the bucket.' : 'File repositories have no object versions; a maintained checksum inventory is the most reliable option.',
          },
        ];
      if (ty === 'Manual upload')
        return [
          { k: 'files', label: 'Files to upload', type: 'chips', opts: [...SAMPLE_FILES, ...(v.files || [])].filter((x, i, a) => a.indexOf(x) === i) },
          { k: 'zip', label: 'Extract ZIP archives', type: 'select', opts: ['Yes', 'No'] },
        ];
      if (isDb(ty)) {
        const B = srcOf(H, sid(v))?.browse ?? [];
        const objs = B.filter((b) => b[1] === 'Table' || b[1] === 'View').map((b) => b[0]);
        const qs = B.filter((b) => b[1] === 'Saved query').map((b) => b[0]);
        return [
          { k: 'objs', label: 'Tables or views', type: 'chips', opts: objs, hint: 'Discovered from the data source.' },
          ...(ty.startsWith('Data warehouse') ? [{ k: 'query', label: 'Or a saved query', type: 'select', opts: ['None', ...qs], hint: 'Only queries reviewed by a tenant administrator are offered; free SQL is not allowed.' } as FormField] : []),
          {
            k: 'ext',
            label: 'Extraction',
            type: 'select',
            opts: ['Full refresh', 'Incremental (watermark column)', ...(ty === 'Microsoft SQL Server' ? ['Incremental (change tracking)'] : [])],
            hint: ty === 'Microsoft SQL Server' ? 'Change tracking must be enabled on the source tables.' : 'Change tracking is not available for warehouses; use a watermark column.',
          },
          ...((v.ext || '').includes('watermark') ? [{ k: 'wm', label: 'Watermark column', type: 'text', ph: 'e.g. updated_at', hint: 'Must increase on every insert and update. Deleted rows are not detected.' } as FormField] : []),
        ];
      }
      if (ty === 'REST API')
        return [
          { k: 'path', label: 'Endpoint path', type: 'text', ph: '/records' },
          { k: 'params', label: 'Request parameters', type: 'text', ph: 'e.g. status=active&lang=en' },
          { k: 'page', label: 'Pagination', type: 'select', opts: ['None', 'Page number', 'Cursor / next link', 'Offset and limit'] },
          { k: 'inc', label: 'Incremental retrieval', type: 'select', opts: ['Full refresh', 'Since last run (updated_since parameter)'], hint: 'Only if the API supports filtering by modification time.' },
          { k: 'resp', label: 'Response contains', type: 'select', opts: ['Records (structured)', 'Documents (unstructured)'] },
        ];
      return [{ type: 'note', text: 'Select a data source first.', tone: 'warn' }];
    }
    if (step === 2) {
      const first = firstStep(ty);
      const f: FormField[] = [{ type: 'kv', rows: [['Detected input', kind === 'Mixed' ? 'Mixed · CSV, XLSX, JSON and Parquet as datasets; PDF, DOCX, HTML, TXT and e-mail as documents' : kind]] }];
      if (kind !== 'Unstructured') f.push({ k: 'sSteps', label: 'Structured path · steps in order', type: 'chips', opts: STR_ALL(first), hint: `${first} and Load structured records are required.` });
      if (kind !== 'Structured')
        f.push(
          { k: 'uSteps', label: 'Document path · steps in order', type: 'chips', opts: UNS_ALL, hint: 'Text extraction, chunking, embeddings and indexing are required for search.' },
          { k: 'chunk', label: 'Chunking', type: 'select', opts: ['By heading · 800 tokens · 100 overlap', 'By paragraph · 500 tokens · 50 overlap', 'Fixed size · 1,000 tokens · 0 overlap'] },
        );
      if ((v.uSteps || []).includes(ENT_U) || (v.sSteps || []).includes(ENT_S))
        f.push(
          { k: 'entTypes', label: 'Entity types to extract', type: 'chips', opts: ONTO, hint: ONTO.length ? 'From the tenant ontology in Business Entities.' : 'Define entity types in Business Entities first.' },
          { k: 'entConf', label: 'Minimum confidence', type: 'select', opts: ['0.60', '0.70', '0.80', '0.90'] },
        );
      return f;
    }
    if (step === 3) {
      const f: FormField[] = [];
      if (kind !== 'Unstructured')
        f.push(
          { k: 'dsName', label: 'Structured Data · dataset name', type: 'text', ph: 'e.g. regional_sales or {file}', hint: '{file} or {table} creates one dataset per input file or table.' },
          { k: 'mode', label: 'Write mode', type: 'select', opts: ['Full refresh (replace)', 'Append', 'Incremental update (upsert on keys)'], hint: 'Append adds every record again on a re-run; use it only for event-style data.' },
        );
      if (kind !== 'Unstructured' && (v.mode || '').startsWith('Incremental')) f.push({ k: 'keys', label: 'Key columns', type: 'text', ph: 'e.g. order_id' });
      f.push({ k: 'colls', label: 'Collections (optional)', type: 'chips', opts: colls, hint: 'Optional.' });
      return f;
    }
    if (step === 4) {
      const evOpt = ty === 'S3' ? ['Bucket event notification (object created)'] : ty === 'Manual upload' ? ['On upload'] : [];
      const f: FormField[] = [
        {
          k: 'trig',
          label: 'Run',
          type: 'select',
          hint: ty === 'Manual upload' ? 'Uploads start a run when they are submitted.' : !evOpt.length ? `Event triggers are not available for ${ty || 'this source'}.` : '',
          opts: ['Manual only', 'Schedule', ...(ty === 'Manual upload' ? ['On upload'] : []), ...(evOpt.length && ty !== 'Manual upload' ? ['Event'] : [])],
        },
      ];
      if (v.trig === 'Schedule') f.push({ k: 'sched', label: 'Schedule', type: 'select', opts: ['Hourly', 'Every 6 hours', 'Daily 02:00 AST', 'Weekly Sunday 03:00 AST', 'Monthly, 1st at 01:00 AST'], hint: "Runs start within the tenant's bulk window and allocation." });
      if (v.trig === 'Event') f.push({ k: 'ev', label: 'Event', type: 'select', opts: evOpt, hint: 'Requires bucket notifications to the KAP queue.' });
      return f;
    }
    const input =
      ty === 'Manual upload'
        ? (v.files || []).join(', ')
        : isDb(ty)
          ? `${(v.objs || []).join(', ') || v.query} · ${v.ext}${v.wm ? ` (${v.wm})` : ''}`
          : ty === 'REST API'
            ? `${v.path} · ${v.page} · ${v.inc}`
            : `${v.sel}: ${v.path} · ${v.pat}${v.zip === 'Yes' ? ' · extract ZIP' : ''} · ${v.which}`;
    return [
      {
        type: 'kv',
        label: 'Summary',
        rows: [
          ['Pipeline', v.id],
          ['Data source', v.srcL],
          ['State', v.onL],
          ['Input', input],
          ['Processing', kind + (kind !== 'Unstructured' ? ` · structured: ${(v.sSteps || []).join(' → ')}` : '') + (kind !== 'Structured' ? ` · documents: ${(v.uSteps || []).join(' → ')}` : '')],
          ['Publishes to', outOf(H, vv) + (kind !== 'Unstructured' ? ` · ${v.dsName} · ${v.mode}` : '')],
          ['Collections', (v.colls || []).join(', ') || 'None (optional)'],
          ['Run', v.trig === 'Schedule' ? v.sched : v.trig === 'Event' ? v.ev : v.trig],
        ],
      },
      { k: 'first', label: 'After saving', type: 'select', opts: ['Save only', 'Save and run now'] },
    ];
  };

  return {
    title: edit ? `Edit ${p!.id}` : sessionOnly ? 'Create pipeline · session only' : 'Create pipeline',
    steps: ['General', 'Input', 'Processing', 'Output', 'Execution', 'Review'],
    finishL: edit ? 'Save changes' : 'Save pipeline',
    initial,
    fields: (step, v) => {
      const ff = withDefaults(stepFields(step, v), v);
      if (step === 0) return ff;
      const ty = tyOf(H, v);
      if (!ty) return ff;
      const vv = { ...v, src: sid(v) } as PipeCfg;
      return [{ type: 'dgm', label: 'Pipeline flow', dgm: { ...pipeDgm(vv, ty, kindOf(H, vv), { compact: step < 2, per: 4 }), minScale: 0.7 } }, ...ff];
    },
    validate: (step, v) => {
      const e = validatePipe(H, edit, step, v);
      if (!e && step === 1) processingDefaults(H, v);
      return e;
    },
    finish: (v) => {
      save(pipeRecord(H, v, p));
      return '';
    },
  };
}

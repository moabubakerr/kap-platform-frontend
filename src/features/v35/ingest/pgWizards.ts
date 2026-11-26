/**
 * Wizards for the live tenant's PostgreSQL records (platform API): the data
 * source (connection) and the dataset (what to export, where, how often).
 * Bodies and checks are in `pgView.ts`; `finish` sends them.
 */
import type { FormField, FormValues, WizardSpec } from '@/engine/dialogs';
import { PgApiError, type PgColumn, type PgColumns, type PgDataset, type PgMapping, type PgMappingPreview, type PgRecords, type PgRecordsPreview, type PgSource, type PgTable } from '@/api/platformPg';
import {
  cellText, checkQueries, datasetValues, FILE_NAME, fmtCount, MAPPED_HINT, PG_FILES, pgSourceValues, PRESET_CUSTOM, PRESET_MAPPED, PRESET_OPTS, PRESET_RECORDS, PRESET_SCAI, previewFiles, RECORDS_HINT, REQUIRED_COLUMNS, SCAI_HINT, scheduleOpts, SSL_HINT, SSL_MODES,
  toPgDatasetPatch, toPgSourcePatch, validateDataset, validatePgSource, type DatasetCheckCtx,
} from './pgView';
import {
  cardExcerpt, COST_NOTE, DEFAULT_MAX, exampleTitle, fieldKey, humanise, idOptions, isLongColumn, LANG_OPTS, labelDefaults, ORDER_OPTS, recordDefaults, recordsKey, recordsSummary, recordWarnings, sectionKey, sectionOptions, toRecords, validateRecordStep, type RecStep,
} from './pgRecords';
import {
  colNames, colOf, columnDefaults, exampleId, FILTER_ROWS, FREQ_COLUMN, FREQ_LABEL, FREQ_OPTS, FREQS, KIND_AUTO, kindOf, loadedColumns, mappingKey, mappingSummary, mappingWarnings, MAX_FILTERS, MODE_COLUMN, MODE_FIXED, MODES, namesFirst, NO_FILTER, NONE, OP_OPTS, opNeedsValue, opOf,
  PERIOD_KINDS, periodKind, prefixOf, toMapping, typeHint, validateMapStep, type MapStep,
} from './pgMapping';

const YES_NO = ['Yes', 'No'];

function withDefaults(fields: FormField[], v: FormValues): FormField[] {
  fields.forEach((f) => {
    if (f.type === 'select' && (v[f.k] == null || v[f.k] === '') && f.opts.length) v[f.k] = f.opts[0];
  });
  return fields;
}

// ------------------------------------------------------------------ data source
export interface PgSourceWizardArgs {
  src: PgSource | null;
  /** names of the tenant's data sources (all kinds) */
  existing: string[];
  finish: (v: FormValues) => Promise<string>;
}

/** Fields that change the connection (a new test is worth running after an edit). */
export const CONNECTION_KEYS = ['host', 'port', 'database', 'username', 'password', 'sslmode'];

export function pgSourceWizard({ src, existing, finish }: PgSourceWizardArgs): WizardSpec {
  const edit = !!src;
  return {
    title: edit ? `Edit ${src!.name}` : 'Create data source',
    steps: ['Source type', 'Connection', 'Credentials', 'Review'],
    finishL: edit ? 'Save changes' : 'Create and test',
    initial: pgSourceValues(src),
    initialStep: 1,
    fields: (step, v) => {
      let f: FormField[];
      if (step === 0) f = [{ type: 'kv', rows: [['Source type', 'PostgreSQL (read by the platform, exported to KAP)']] }];
      else if (step === 1)
        f = [
          { k: 'name', label: 'Name', type: 'text', ro: edit, ph: 'e.g. askai_db', hint: edit ? 'The name cannot change.' : '3–64 letters, digits, hyphens and underscores.' },
          { k: 'host', label: 'Host', type: 'text', ph: 'e.g. scai-chatbot-postgres-1' },
          { k: 'port', label: 'Port', type: 'num', ph: '5432' },
          { k: 'database', label: 'Database', type: 'text', ph: 'e.g. scai_indicators' },
          { k: 'sslmode', label: 'SSL mode', type: 'select', opts: SSL_MODES, hint: SSL_HINT[v.sslmode || 'disable'] },
          { type: 'note', tone: 'info', text: 'On the test stand: host scai-chatbot-postgres-1, port 5432, database scai_indicators. The platform reaches the database from its own network, not from your browser.' },
        ];
      else if (step === 2)
        f = [
          { k: 'username', label: 'User name', type: 'text', ph: 'e.g. kap_platform_ro' },
          { k: 'password', label: 'Password', type: 'text', secret: true, hint: edit ? 'Leave empty to keep the stored password.' : 'Stored by the platform and never shown again.' },
          { type: 'note', tone: 'info', text: 'Use a read-only database user (on the test stand: kap_platform_ro). The platform only runs SELECT queries; it never writes to the database.' },
        ];
      else {
        const patch = edit ? toPgSourcePatch(src!, v) : null;
        f = [
          {
            type: 'kv',
            label: 'Summary',
            rows: [
              ['Type', 'PostgreSQL'],
              ['Name', v.name],
              ['Host', `${v.host}:${v.port}`],
              ['Database', v.database],
              ['User name', v.username],
              ['Password', v.password ? 'New password (hidden)' : edit ? 'Unchanged' : '—'],
              ['SSL mode', v.sslmode],
              ...(edit ? ([['Changes', patch ? Object.keys(patch).join(', ') : 'None']] as [string, unknown][]) : []),
            ],
          },
          edit
            ? patch
              ? ({ type: 'note', tone: 'info', text: Object.keys(patch).some((k) => CONNECTION_KEYS.includes(k)) ? 'The connection is tested again after saving.' : 'Saved in the platform.' } as FormField)
              : ({ type: 'note', tone: 'info', text: 'Nothing changed: the platform keeps the source as it is.' } as FormField)
            : ({ type: 'note', tone: 'info', text: 'After saving, the platform tests the connection: the server version and the tables this user can read are shown on the data source.' } as FormField),
        ];
      }
      return withDefaults(f, v);
    },
    validate: (step, v) => (step === 1 ? validatePgSource(v, existing, edit, 'connection') : step === 2 ? validatePgSource(v, existing, edit, 'credentials') : ''),
    finish: (v) => validatePgSource(v, existing, edit) || finish(v),
  };
}

// ------------------------------------------------------------------ dataset
/** What the column-mapping steps need from the platform (bound to the tenant and the source). */
export interface PgMappingDeps {
  /** tables of the last successful connection test; null when none is known */
  tables: () => PgTable[] | null;
  /** runs a connection test (stores its tables); '' or the error */
  test: () => Promise<string>;
  columns: (table: string) => Promise<PgColumns>;
  preview: (m: PgMapping) => Promise<PgMappingPreview>;
  /** records → documents preview (sample cards); without it the preview step says it is not available */
  recordsPreview?: (r: PgRecords, name?: string) => Promise<PgRecordsPreview>;
}

export interface PgDatasetWizardArgs {
  ds: PgDataset | null;
  source: PgSource;
  check: DatasetCheckCtx;
  finish: (v: FormValues) => Promise<string>;
  /** column mapping (preset `mapped`); without it the mapping steps say they cannot load */
  mapping?: PgMappingDeps;
}

const columnsHint = (f: 'registry' | 'observations' | 'narratives') => `${FILE_NAME[f]} columns: ${REQUIRED_COLUMNS[f].join(', ')}.`;

const BASE_STEPS = ['General', 'Data'];
const TAIL_STEPS = ['Target collection', 'Schedule', 'Review'];
const MAP_STEPS: [string, MapStep | 'preview'][] = [
  ['Table', 'table'],
  ['Series & period', 'series'],
  ['Values', 'values'],
  ['Labels', 'labels'],
  ['Filters', 'filters'],
  ['Preview', 'preview'],
];
const REC_STEPS: [string, RecStep][] = [
  ['Table', 'table'],
  ['Record', 'record'],
  ['Content', 'content'],
  ['Filters & size', 'filters'],
];
const REC_PREVIEW = 'Preview';
/**
 * The wizard's steps for a Mapping choice: the column mapping adds six steps after Data;
 * records add four after Data and a preview after the schedule.
 */
export const datasetSteps = (preset: string | undefined) =>
  preset === PRESET_MAPPED
    ? [...BASE_STEPS, ...MAP_STEPS.map(([l]) => l), ...TAIL_STEPS]
    : preset === PRESET_RECORDS
      ? [...BASE_STEPS, ...REC_STEPS.map(([l]) => l), 'Target collection', 'Schedule', REC_PREVIEW, 'Review']
      : [...BASE_STEPS, ...TAIL_STEPS];
const mapStepOf = (label: string, preset?: string) => (preset === PRESET_MAPPED ? MAP_STEPS.find(([l]) => l === label)?.[1] : undefined);
const recStepOf = (label: string, preset?: string): RecStep | 'preview' | undefined =>
  preset === PRESET_RECORDS ? (label === REC_PREVIEW ? 'preview' : REC_STEPS.find(([l]) => l === label)?.[1]) : undefined;

const warnNote = (w: string[], label = 'Check'): FormField[] => (w.length ? [{ type: 'note', tone: 'warn', label, text: w.join(' ') }] : []);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface ColEntry {
  columns?: PgColumn[];
  error?: string;
}
interface PreviewEntry {
  data?: PgMappingPreview;
  error?: string;
  /** the platform has no mapping preview yet: saving is still allowed */
  missing?: boolean;
}
interface RecPreviewEntry {
  data?: PgRecordsPreview;
  error?: string;
  missing?: boolean;
}

export function pgDatasetWizard({ ds, source, check, finish, mapping: deps }: PgDatasetWizardArgs): WizardSpec {
  const edit = !!ds;
  const initial = datasetValues(ds);
  // a stored mapping keeps its choices: no column guesses for its own table
  if (ds?.preset === 'mapped' && ds.mapping) initial._defaultsFor = ds.mapping.table;
  if (ds?.preset === 'records' && ds.records) initial._rdefaultsFor = ds.records.table;

  // ---- session state of the column mapping (loaded columns, previews); a change re-renders through a `_…At` value
  const colCache = new Map<string, ColEntry>();
  const pvCache = new Map<string, PreviewEntry>();
  const busy = new Set<string>();
  const later = (fn: () => void) => void Promise.resolve().then(fn);

  /** the form values with the loaded columns of the chosen table (`_cols`, see pgMapping) */
  const withCols = (v: FormValues): FormValues => {
    const t = String(v.m_table ?? '');
    const e = colCache.get(t);
    return { ...v, _cols: t ? (e ? { table: t, ...e } : { table: t, loading: true }) : undefined };
  };
  const loadColumns = (table: string, set: (k: string, val: any) => void, force = false) => {
    if (!table || busy.has(`c:${table}`) || (colCache.has(table) && !force)) return;
    if (!deps) {
      colCache.set(table, { error: 'column mapping is not available here.' });
      return later(() => set('_colsAt', Date.now()));
    }
    busy.add(`c:${table}`);
    colCache.delete(table);
    deps.columns(table).then(
      (r) => colCache.set(table, { columns: r?.columns ?? [] }),
      (e) => colCache.set(table, { error: errMsg(e) }),
    ).finally(() => {
      busy.delete(`c:${table}`);
      set('_colsAt', Date.now());
    });
  };
  const loadPreview = (m: PgMapping, set: (k: string, val: any) => void, force = false) => {
    const key = mappingKey(m);
    if (busy.has(`p:${key}`) || (pvCache.has(key) && !force)) return;
    if (!deps) {
      pvCache.set(key, { error: 'column mapping is not available here.' });
      return later(() => set('_pvAt', Date.now()));
    }
    busy.add(`p:${key}`);
    pvCache.delete(key);
    deps.preview(m).then(
      (data) => pvCache.set(key, { data }),
      (e) => pvCache.set(key, e instanceof PgApiError && e.routeMissing ? { missing: true, error: e.message } : { error: errMsg(e) }),
    ).finally(() => {
      busy.delete(`p:${key}`);
      set('_pvAt', Date.now());
    });
  };

  const rvCache = new Map<string, RecPreviewEntry>();
  const loadRecPreview = (r: PgRecords, name: string, set: (k: string, val: any) => void, force = false) => {
    const key = recordsKey(r);
    if (busy.has(`r:${key}`) || (rvCache.has(key) && !force)) return;
    if (!deps?.recordsPreview) {
      rvCache.set(key, { error: 'the records preview is not available here.' });
      return later(() => set('_pvAt', Date.now()));
    }
    busy.add(`r:${key}`);
    rvCache.delete(key);
    deps.recordsPreview(r, name || undefined).then(
      (data) => rvCache.set(key, { data }),
      (e) => rvCache.set(key, e instanceof PgApiError && e.routeMissing ? { missing: true, error: e.message } : { error: errMsg(e) }),
    ).finally(() => {
      busy.delete(`r:${key}`);
      set('_pvAt', Date.now());
    });
  };

  const tableFields = (v: FormValues, set: (k: string, val: any) => void): FormField[] => {
    const known = deps?.tables() ?? null;
    const names = (known ?? []).map((t) => `${t.schema}.${t.name}`);
    const cur = String(v.m_table ?? '');
    const opts = cur && !names.includes(cur) ? [cur, ...names] : names;
    const testBtn: FormField = {
      type: 'button',
      label: v._testing ? 'Testing the connection…' : 'Test connection',
      hint: v._testErr ? `The test failed: ${v._testErr}` : 'Lists the tables this database user can read.',
      click: () => {
        if (v._testing || !deps) return;
        set('_testing', true);
        deps.test().then((e) => {
          set('_testing', false);
          set('_testErr', e);
        });
      },
    };
    if (!opts.length)
      return [{ type: 'note', tone: 'info', text: `The tables of ${source.name} are not known yet: they come from a connection test.` }, testBtn];
    if (!cur) v.m_table = opts[0];
    const table = String(v.m_table);
    loadColumns(table, set);
    const e = colCache.get(table);
    const cols = e?.columns ?? [];
    const rows = (known ?? []).find((t) => `${t.schema}.${t.name}` === table)?.rows_estimate;
    return [
      {
        k: 'm_table',
        label: 'Table',
        type: 'select',
        opts,
        hint: `${v.preset === PRESET_RECORDS ? 'A table or view; each row becomes one document.' : 'Each row of the table must be one value of one series in one period.'} ${rows != null && rows >= 0 ? `About ${rows.toLocaleString('en-US')} rows.` : ''}`.trim(),
      },
      !e
        ? ({ type: 'note', tone: 'info', text: `Loading the columns of ${table}…` } as FormField)
        : e.error
          ? ({ type: 'note', tone: 'bad', label: 'Could not read the columns', text: e.error } as FormField)
          : ({ type: 'kv', label: `Columns of ${table} (${cols.length})`, rows: cols.map((c) => [c.name, `${c.type}${c.nullable ? '' : ' · always set'}`]) } as FormField),
      ...(e?.error ? [{ type: 'button', label: 'Load the columns again', click: () => loadColumns(table, set, true) } as FormField] : []),
      ...(known ? [] : [testBtn]),
    ];
  };

  const seriesFields = (v: FormValues, cols: PgColumn[]): FormField[] => {
    const names = colNames(cols);
    const fromCol = v.m_freq === FREQ_COLUMN;
    const pk = kindOf(cols, v.m_period);
    const kind = periodKind(v, cols);
    const kindHint =
      v.m_period_kind === KIND_AUTO
        ? `Automatic: ${v.m_period || 'the period column'} is ${pk === 'date' ? 'a date' : pk ? `of type ${colOf(cols, v.m_period)?.type}` : 'not chosen'}, so it is read as ${kind === 'date' ? 'a date' : 'text'}.`
        : kind === 'date'
          ? 'The platform turns each date into the period of the frequency (year, quarter or month).'
          : 'The values must already look like 2024, 2024-Q1 or 2024-03.';
    const m = toMapping(v);
    return [
      { k: 'm_series', label: 'Series columns', type: 'chips', opts: names, hint: 'The columns whose values tell one series from another, e.g. region_code. Each distinct value (or combination) becomes one KAP indicator.' },
      { k: 'm_prefix', label: 'ID prefix', type: 'text', ph: 'e.g. sales', hint: `KAP ids look like ${exampleId(m)}. 1–24 lower-case letters, digits and underscores.` },
      { k: 'm_period', label: 'Period column', type: 'select', opts: namesFirst(cols, ['date']), hint: typeHint(cols, v.m_period) },
      { k: 'm_period_kind', label: 'Period values', type: 'select', opts: PERIOD_KINDS, hint: kindHint },
      { k: 'm_freq', label: 'Frequency', type: 'select', opts: FREQ_OPTS, hint: fromCol ? 'A column says the frequency of each row; type which of its values mean annual, quarterly and monthly.' : 'The same frequency for every series.' },
      ...(fromCol
        ? ([
            { k: 'm_freq_col', label: 'Frequency column', type: 'select', opts: namesFirst(cols, ['text']), hint: typeHint(cols, v.m_freq_col) },
            ...FREQS.map((f) => ({ k: `m_freq_${f}`, label: `Values meaning ${FREQ_LABEL[f].replace(/^\w/, (c) => c.toLowerCase())}`, type: 'text', ph: f === 'A' ? 'e.g. yearly, annual' : f === 'Q' ? 'e.g. quarterly, Q' : 'e.g. monthly, M' }) as FormField),
            { type: 'note', tone: 'info', text: 'Type the values exactly as they are in the column, separated by commas. The console cannot list them for you; the preview shows what comes out.' },
          ] as FormField[])
        : []),
      ...warnNote(mappingWarnings('series', v, cols)),
    ];
  };

  const valueFields = (v: FormValues, cols: PgColumn[]): FormField[] => {
    const nums = namesFirst(cols, ['number']);
    const dim = v.m_dimension && v.m_dimension !== NONE;
    return [
      { k: 'm_value', label: 'Value column', type: 'select', opts: nums, hint: typeHint(cols, v.m_value) || 'The number of each row.' },
      { k: 'm_target', label: 'Target column (optional)', type: 'select', opts: [NONE, ...nums], hint: v.m_target && v.m_target !== NONE ? typeHint(cols, v.m_target) : 'A target value per row, if the table has one.' },
      { k: 'm_dimension', label: 'Dimension column (optional)', type: 'select', opts: [NONE, ...namesFirst(cols, ['text'])], hint: 'A column that breaks a series down (e.g. nationality). Each of its values gets its own KAP id.' },
      ...(dim
        ? ([{ k: 'm_domestic', label: 'Values meaning the main series', type: 'text', ph: 'e.g. National / Overall, Qatar', hint: `Values of ${v.m_dimension} that are the overall figure (ids ending in .overall), separated by commas, exactly as in the column.` }] as FormField[])
        : []),
      ...warnNote(mappingWarnings('values', v, cols)),
    ];
  };

  const labelFields = (v: FormValues, cols: PgColumn[]): FormField[] => {
    const texts = namesFirst(cols, ['text']);
    const mode = (k: 'unit' | 'source', label: string, ph: string): FormField[] => [
      { k: `m_${k}`, label, type: 'select', opts: MODES },
      ...(v[`m_${k}`] === MODE_FIXED ? ([{ k: `m_${k}_text`, label: `${label} (the same for every series)`, type: 'text', ph }] as FormField[]) : []),
      ...(v[`m_${k}`] === MODE_COLUMN ? ([{ k: `m_${k}_col`, label: `${label} column`, type: 'select', opts: texts, hint: typeHint(cols, v[`m_${k}_col`]) }] as FormField[]) : []),
    ];
    return [
      { k: 'm_name_en', label: 'Name column (English)', type: 'select', opts: [NONE, ...texts] },
      { k: 'm_name_ar', label: 'Name column (Arabic)', type: 'select', opts: [NONE, ...texts] },
      ...mode('unit', 'Unit', 'e.g. QAR million'),
      ...mode('source', 'Source', 'e.g. Planning and Statistics Authority'),
      { k: 'm_definition', label: 'Definition column', type: 'select', opts: [NONE, ...texts] },
      { type: 'note', tone: 'info', text: 'All optional: what KAP shows about each series. Leave None when the table has no such column.' },
    ];
  };

  const filterFields = (v: FormValues, cols: PgColumn[]): FormField[] => {
    const names = colNames(cols);
    const f: FormField[] = [{ type: 'note', tone: 'info', text: `Optional: export only the rows of ${v.m_table} that match every filter (e.g. status equals final). Up to ${MAX_FILTERS}.` }];
    const set = (i: number) => !!v[`m_f${i}_col`] && v[`m_f${i}_col`] !== NO_FILTER;
    for (const i of FILTER_ROWS) {
      if (i > 1 && !set(i - 1) && !set(i)) break;
      f.push({ k: `m_f${i}_col`, label: `Filter ${i} · column`, type: 'select', opts: [NO_FILTER, ...names], hint: set(i) ? typeHint(cols, v[`m_f${i}_col`]) : undefined });
      if (!set(i)) continue;
      f.push({ k: `m_f${i}_op`, label: `Filter ${i} · condition`, type: 'select', opts: OP_OPTS });
      if (opNeedsValue(opOf(v[`m_f${i}_op`] || OP_OPTS[0]))) f.push({ k: `m_f${i}_val`, label: `Filter ${i} · value`, type: 'text', ph: 'e.g. final' });
    }
    return [...f, ...warnNote(mappingWarnings('filters', v, cols))];
  };

  const previewFields = (v: FormValues, set: (k: string, val: any) => void): FormField[] => {
    const m = toMapping(v);
    loadPreview(m, set);
    const e = pvCache.get(mappingKey(m));
    const again: FormField = { type: 'button', label: 'Preview again', click: () => loadPreview(m, set, true) };
    const head: FormField = { type: 'note', tone: 'info', label: 'The mapping', text: mappingSummary(m) };
    if (!e) return [head, { type: 'note', tone: 'info', text: `Running the mapping on ${m.table}…` }];
    if (e.missing) return [head, { type: 'note', tone: 'warn', label: 'No preview', text: `${e.error} The mapping can still be saved; the dataset page previews it after saving.` }];
    if (e.error || !e.data) return [head, { type: 'note', tone: 'bad', label: 'The preview failed', text: `${e.error ?? 'No answer.'} Go back and fix the mapping.` }, again];
    const p = e.data;
    const files = previewFiles(p, 1);
    const first = (file: 'registry' | 'observations'): FormField[] => {
      const x = files.find((y) => y.file === file);
      const row = x?.rows[0];
      if (!x || !row) return [];
      const rows = x.columns.map((c, i) => [c, cellText(row[i])] as [string, string]).filter(([, t]) => t !== '').slice(0, 10);
      return [{ type: 'kv', label: `First row of ${x.name}`, rows }];
    };
    return [
      head,
      { type: 'kv', label: 'What will be exported', rows: PG_FILES.map((f) => [FILE_NAME[f], p.files[f] ? `${fmtCount(p.files[f]!.count)} ${p.files[f]!.count === 1 ? 'row' : 'rows'}` : 'Not written']) },
      ...first('registry'),
      ...first('observations'),
      ...(p.problems.length ? ([{ type: 'note', tone: 'warn', label: `${p.problems.length} ${p.problems.length === 1 ? 'problem' : 'problems'} found`, text: p.problems.join(' · ') }] as FormField[]) : [{ type: 'note', tone: 'ok', text: 'No problems found.' } as FormField]),
      { type: 'note', tone: 'info', text: 'The generated SQL and the first rows of each file are shown on the dataset page after saving.' },
      again,
    ];
  };

  /** '' or the problem of a mapping step (`v` with `_cols`); may correct values (defaults after the columns load). */
  const validateMap = (label: string, v: FormValues, set: (k: string, val: any) => void): string => {
    const st = mapStepOf(label, v.preset);
    if (!st) return '';
    const vv = withCols(v);
    const cols = loadedColumns(vv);
    if (st === 'preview') {
      const e = pvCache.get(mappingKey(toMapping(vv)));
      if (!e) return 'The preview is still running. Wait a moment.';
      if (e.error && !e.missing) return `The preview failed: ${e.error} Go back and fix the mapping.`;
      return '';
    }
    const err = validateMapStep(st, vv, cols);
    if (err) return err;
    // guesses from the column types, once per chosen table (a later "(none)" stays the user's choice)
    if (st === 'table' && v._defaultsFor !== v.m_table) {
      for (const [k, val] of Object.entries(columnDefaults(vv, cols))) set(k, val);
      set('_defaultsFor', v.m_table);
    }
    if (st === 'table' && !String(v.m_prefix ?? '').trim()) set('m_prefix', prefixOf(v.name));
    return '';
  };

  // ---- records → searchable documents
  const recordFields = (v: FormValues, cols: PgColumn[]): FormField[] => {
    const names = colNames(cols);
    const ex = exampleTitle(v.r_title, cols);
    return [
      { k: 'r_id', label: 'ID column', type: 'select', opts: idOptions(cols), hint: `${typeHint(cols, v.r_id)}${v.r_id ? '. ' : ''}Different in every row: it names the record’s document and tells new, changed and removed records apart.` },
      {
        k: 'r_title',
        label: 'Title',
        type: 'text',
        ph: 'e.g. Ticket {ticket_id}',
        hint: `${ex ? `Example: ${ex}. ` : ''}Put column names in braces; each document’s title is filled from its row.`,
      },
      { k: 'r_order', label: 'Order by (optional)', type: 'select', opts: [NONE, ...namesFirst(cols, ['date', 'number'])], hint: 'Which records come first when there are more than the maximum.' },
      ...(v.r_order && v.r_order !== NONE ? ([{ k: 'r_order_dir', label: 'Order', type: 'select', opts: ORDER_OPTS }] as FormField[]) : []),
      ...(names.length ? [] : ([{ type: 'note', tone: 'warn', text: 'The columns are not loaded: go back to Table.' }] as FormField[])),
      ...warnNote(recordWarnings('record', v, cols)),
    ];
  };

  const contentFields = (v: FormValues, cols: PgColumn[]): FormField[] => {
    // a chip just added gets a humanised label (the engine's chips have no per-chip editor)
    Object.assign(v, labelDefaults(v));
    const shortFirst = [...cols.filter((c) => !isLongColumn(c)), ...cols.filter(isLongColumn)].map((c) => c.name).filter((n) => n !== v.r_id);
    const labelField = (c: string, key: string, what: string): FormField => ({ k: key, label: `${what} label · ${c}`, type: 'text', ph: humanise(c), hint: typeHint(cols, c) });
    return [
      { k: 'r_fields', label: 'Fields', type: 'chips', opts: shortFirst, hint: 'Short values shown as “Label: value” lines under the title (status, customer, dates…).' },
      ...((v.r_fields ?? []) as string[]).map((c) => labelField(c, fieldKey(c), 'Field')),
      { k: 'r_sections', label: 'Sections', type: 'chips', opts: sectionOptions(cols).filter((n) => n !== v.r_id), hint: 'Long text, each under its label as a heading (description, notes, resolution…). Text columns are listed first.' },
      ...((v.r_sections ?? []) as string[]).map((c) => labelField(c, sectionKey(c), 'Section')),
      ...warnNote(recordWarnings('content', v, cols)),
    ];
  };

  const recFilterFields = (v: FormValues, cols: PgColumn[]): FormField[] => [
    ...filterFields(v, cols),
    { k: 'r_max', label: 'Max records', type: 'num', ph: String(DEFAULT_MAX), hint: `At most ${(50000).toLocaleString('en-US')}. With Order by, the first records in that order are kept.` },
    { k: 'r_lang', label: 'Language (optional)', type: 'select', opts: LANG_OPTS },
    { type: 'note', tone: 'info', label: 'Cost', text: COST_NOTE },
    ...warnNote(recordWarnings('filters', v, cols)),
  ];

  const recPreviewFields = (v: FormValues, set: (k: string, val: any) => void): FormField[] => {
    const r = toRecords(v);
    loadRecPreview(r, String(v.name ?? '').trim(), set);
    const e = rvCache.get(recordsKey(r));
    const again: FormField = { type: 'button', label: 'Preview again', click: () => loadRecPreview(r, String(v.name ?? '').trim(), set, true) };
    const head: FormField = { type: 'note', tone: 'info', label: 'The documents', text: recordsSummary(r) };
    if (!e) return [head, { type: 'note', tone: 'info', text: `Reading ${r.table} and writing sample documents…` }];
    if (e.missing) return [head, { type: 'note', tone: 'warn', label: 'No preview', text: `${e.error} The dataset can still be saved; the dataset page previews it after saving.` }];
    if (e.error || !e.data) return [head, { type: 'note', tone: 'bad', label: 'The preview failed', text: `${e.error ?? 'No answer.'} Go back and fix the settings.` }, again];
    const p = e.data;
    const n = p.documents?.count ?? 0;
    const sample = (p.documents?.sample ?? []).slice(0, 2);
    return [
      head,
      { type: 'kv', label: 'What will be exported', rows: [['Documents', `${fmtCount(n)} ${n === 1 ? 'document' : 'documents'}`]] },
      ...(p.problems.length
        ? ([{ type: 'note', tone: 'warn', label: `${p.problems.length} ${p.problems.length === 1 ? 'problem' : 'problems'} found`, text: p.problems.join(' · ') }] as FormField[])
        : ([{ type: 'note', tone: 'ok', text: 'No problems found.' }] as FormField[])),
      ...sample.map((d, i) => ({ type: 'note', tone: 'info', label: `Document ${i + 1} · ${d.title}`, text: cardExcerpt(d.text) }) as FormField),
      { type: 'note', tone: 'info', text: 'The generated SQL and up to five sample documents, laid out as documents, are shown on the dataset page after saving.' },
      again,
    ];
  };

  /** '' or the problem of a records step; applies the column defaults once per chosen table. */
  const validateRec = (label: string, v: FormValues, set: (k: string, val: any) => void): string => {
    const st = recStepOf(label, v.preset);
    if (!st) return '';
    const vv = withCols(v);
    const cols = loadedColumns(vv);
    if (st === 'preview') {
      const e = rvCache.get(recordsKey(toRecords(vv)));
      if (!e) return 'The preview is still running. Wait a moment.';
      if (e.error && !e.missing) return `The preview failed: ${e.error} Go back and fix the settings.`;
      return '';
    }
    const err = validateRecordStep(st, vv, cols);
    if (err) return err;
    if (st === 'table' && v._rdefaultsFor !== v.m_table) {
      for (const [k, val] of Object.entries(recordDefaults(vv, cols))) set(k, val);
      set('_rdefaultsFor', v.m_table);
    }
    return '';
  };

  const stepValidate = (label: string, v: FormValues, set: (k: string, val: any) => void): string => {
    if (label === 'General') return validateDataset(0, v, check);
    if (label === 'Data') return validateDataset(1, v, check);
    if (label === 'Target collection') return validateDataset(2, v, check);
    if (v.preset === PRESET_RECORDS) return validateRec(label, v, set);
    return validateMap(label, v, set);
  };

  /** the values the last render saw: the step list follows the Mapping choice */
  let cur: FormValues = initial;

  return {
    title: edit ? `Edit ${ds!.name}` : `New dataset · ${source.name}`,
    get steps() {
      return datasetSteps(cur.preset);
    },
    finishL: edit ? 'Save changes' : 'Save and preview',
    initial,
    fields: (step, v, set) => {
      cur = v;
      const label = datasetSteps(v.preset)[step];
      const mapped = v.preset === PRESET_MAPPED;
      const records = v.preset === PRESET_RECORDS;
      const mst = mapStepOf(label, v.preset);
      const rst = recStepOf(label, v.preset);
      let f: FormField[];
      if (rst) {
        const vv = withCols(v);
        const cols = loadedColumns(vv);
        f =
          rst === 'table'
            ? tableFields(v, set)
            : rst === 'record'
              ? recordFields(vv, cols)
              : rst === 'content'
                ? contentFields(v, cols)
                : rst === 'filters'
                  ? recFilterFields(vv, cols)
                  : recPreviewFields(vv, set);
      } else if (mst) {
        const cols = loadedColumns(withCols(v));
        f =
          mst === 'table'
            ? tableFields(v, set)
            : mst === 'series'
              ? seriesFields(withCols(v), cols)
              : mst === 'values'
                ? valueFields(withCols(v), cols)
                : mst === 'labels'
                  ? labelFields(v, cols)
                  : mst === 'filters'
                    ? filterFields(withCols(v), cols)
                    : previewFields(withCols(v), set);
      } else if (label === 'General')
        f = [
          { k: 'name', label: 'Dataset name', type: 'text', ph: 'e.g. SCEAI indicators' },
          { type: 'kv', rows: [['Data source', `${source.name} · ${source.host}:${source.port} / ${source.database}`]] },
          {
            type: 'note',
            tone: 'info',
            text: 'A dataset is what the platform exports from this database to KAP: three indicator files (registry, observations, narratives) loaded into one KAP indicator collection, or one document per record loaded into a document collection that agents search.',
          },
        ];
      else if (label === 'Data') {
        const custom = v.preset === PRESET_CUSTOM;
        const warn = custom ? checkQueries({ registry: v.registry, observations: v.observations, narratives: v.narratives }).warnings : [];
        f = [
          { k: 'preset', label: 'Mapping', type: 'select', opts: PRESET_OPTS, hint: custom ? 'Three SQL queries that return the columns KAP expects.' : mapped ? MAPPED_HINT : records ? RECORDS_HINT : SCAI_HINT },
          ...(records
            ? ([
                {
                  type: 'note',
                  tone: 'info',
                  text: `Next: choose a table or view of ${source.database}, its ID column and document title, the columns that become fields and sections, and filters. KAP gets a document collection that agents search with hybrid_search. The last step previews sample documents before anything is saved.`,
                },
              ] as FormField[])
            : mapped
            ? ([
                {
                  type: 'note',
                  tone: 'info',
                  text: `Next: choose a table of ${source.database}, then its series, period and value columns, labels and filters. The last mapping step previews the files before anything is saved.`,
                },
              ] as FormField[])
            : custom
            ? ([
                { k: 'registry', label: 'Registry query (registry.csv)', type: 'textarea', rows: 9, hint: columnsHint('registry') },
                { k: 'observations', label: 'Observations query (observations.csv)', type: 'textarea', rows: 9, hint: columnsHint('observations') },
                { k: 'narratives', label: 'Narratives query (narratives.csv, optional)', type: 'textarea', rows: 7, hint: columnsHint('narratives') },
                ...(warn.length ? [{ type: 'note', tone: 'warn', label: 'Check the queries', text: warn.join(' ') } as FormField] : []),
                { type: 'note', tone: 'info', text: 'A hint only: the console looks for the column names in the SQL text. The preview after saving runs the queries and reports real problems.' },
              ] as FormField[])
            : ([
                { k: 'published', label: 'Only published indicators', type: 'select', opts: YES_NO, hint: 'Yes: indicators that are not published in the Ask AI database are left out.' },
              ] as FormField[])),
        ];
      } else if (label === 'Target collection') {
        const n = String(v.collection || '').trim() || '<name>';
        f = edit
          ? [
              { type: 'kv', rows: [['Target collection', ds!.collection_name], ['KAP connector', ds!.kap?.connector ?? `${ds!.collection_name}_pg`], ['KAP pipeline', ds!.kap?.pipeline ?? `${ds!.collection_name}_pipeline`], ['Created in KAP', ds!.kap?.provisioned_at ? 'Yes' : 'At the first run']] },
              { type: 'note', tone: 'info', text: 'The target collection cannot change. Create another dataset to export into a new collection.' },
            ]
          : records
            ? [
                { k: 'collection', label: 'Target collection (new)', type: 'text', ph: 'e.g. support_tickets', hint: '4–29 letters, digits and underscores. A new KAP document collection.' },
                {
                  type: 'note',
                  tone: 'info',
                  text: `KAP gets a document collection ${n}, searchable by agents with hybrid_search (one search result per record), an S3 connector ${n}_pg and a document pipeline ${n}_pipeline that parses, summarises and embeds each document (created once, at the first run).`,
                },
              ]
            : [
                { k: 'collection', label: 'Target collection (new)', type: 'text', ph: 'e.g. askai_indicators', hint: '4–29 letters, digits and underscores. A new KAP indicator collection.' },
                { type: 'note', tone: 'info', text: `KAP gets an indicator collection ${n}, an S3 connector ${n}_pg and a pipeline ${n}_pipeline (created once, at the first run). Agents read the collection with the indicator tools, such as find_indicator.` },
              ];
      } else if (label === 'Schedule')
        f = [
          { k: 'schedule', label: 'Schedule', type: 'select', opts: scheduleOpts(ds?.schedule_minutes) },
          {
            type: 'note',
            tone: 'info',
            text: records
              ? 'The platform runs scheduled exports. Each export writes only new and changed records and removes deleted ones; KAP summarises and loads them on its next scan. You can always run an export by hand.'
              : 'The platform runs scheduled exports. Each export replaces the files in the bucket; KAP loads them on its next scan. You can always run an export by hand.',
          },
        ];
      else {
        const vv = withCols(v);
        const patch = edit ? toPgDatasetPatch(ds!, vv) : null;
        const custom = v.preset === PRESET_CUSTOM;
        const m = mapped ? toMapping(vv) : null;
        const r = records ? toRecords(vv) : null;
        f = [
          {
            type: 'kv',
            label: 'Summary',
            rows: [
              ['Dataset', v.name],
              ['Data source', source.name],
              ['Mapping', custom ? 'Custom SQL (3 queries)' : m ? `Map columns · ${m.table}` : r ? `Records → documents · ${r.table}` : PRESET_SCAI],
              ...(custom || m || r ? [] : ([['Only published indicators', v.published]] as [string, unknown][])),
              ...(r ? ([['Document title', r.title], ['KAP collection', 'Document collection, searched with hybrid_search']] as [string, unknown][]) : []),
              ...(m ? ([['KAP ids', exampleId(m)]] as [string, unknown][]) : []),
              ['Target collection', edit ? ds!.collection_name : v.collection],
              ['Schedule', v.schedule],
              ...(edit ? ([['Changes', patch ? Object.keys(patch).join(', ') : 'None']] as [string, unknown][]) : []),
            ],
          },
          ...(m ? ([{ type: 'note', tone: 'info', label: 'The mapping', text: mappingSummary(m) }] as FormField[]) : []),
          ...(r ? ([{ type: 'note', tone: 'info', label: 'The documents', text: recordsSummary(r) }] as FormField[]) : []),
          edit && !patch
            ? ({ type: 'note', tone: 'info', text: 'Nothing changed: the platform keeps the dataset as it is.' } as FormField)
            : r
              ? ({ type: 'note', tone: 'info', text: `After saving, the dataset page shows sample documents. ${COST_NOTE}` } as FormField)
              : ({ type: 'note', tone: 'info', text: 'After saving, the console previews the three files (row counts, first rows and problems). You can run the export from the preview.' } as FormField),
        ];
      }
      return withDefaults(f, v);
    },
    validate: (step, v, set) => {
      cur = v;
      return stepValidate(datasetSteps(v.preset)[step], v, set);
    },
    finish: (v) => {
      const vals = { ...v };
      const set = (k: string, val: any) => {
        vals[k] = val;
      };
      for (const s of datasetSteps(v.preset)) {
        const e = stepValidate(s, vals, set);
        if (e) return e;
      }
      return finish(withCols(vals));
    },
  };
}

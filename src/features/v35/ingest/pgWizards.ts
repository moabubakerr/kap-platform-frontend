/**
 * Wizards for the live tenant's PostgreSQL records (platform API): the data
 * source (connection) and the dataset (what to export, where, how often).
 * Bodies and checks are in `pgView.ts`; `finish` sends them.
 */
import type { FormField, FormValues, WizardSpec } from '@/engine/dialogs';
import type { PgDataset, PgSource } from '@/api/platformPg';
import {
  checkQueries, datasetValues, FILE_NAME, pgSourceValues, PRESET_CUSTOM, PRESET_SCAI, REQUIRED_COLUMNS, SCAI_HINT, scheduleOpts, SSL_HINT, SSL_MODES, toPgDatasetPatch, toPgSourcePatch, validateDataset, validatePgSource,
  type DatasetCheckCtx,
} from './pgView';

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
export interface PgDatasetWizardArgs {
  ds: PgDataset | null;
  source: PgSource;
  check: DatasetCheckCtx;
  finish: (v: FormValues) => Promise<string>;
}

const columnsHint = (f: 'registry' | 'observations' | 'narratives') => `${FILE_NAME[f]} columns: ${REQUIRED_COLUMNS[f].join(', ')}.`;

export function pgDatasetWizard({ ds, source, check, finish }: PgDatasetWizardArgs): WizardSpec {
  const edit = !!ds;
  return {
    title: edit ? `Edit ${ds!.name}` : `New dataset · ${source.name}`,
    steps: ['General', 'Data', 'Target collection', 'Schedule', 'Review'],
    finishL: edit ? 'Save changes' : 'Save and preview',
    initial: datasetValues(ds),
    fields: (step, v) => {
      let f: FormField[];
      if (step === 0)
        f = [
          { k: 'name', label: 'Dataset name', type: 'text', ph: 'e.g. SCEAI indicators' },
          { type: 'kv', rows: [['Data source', `${source.name} · ${source.host}:${source.port} / ${source.database}`]] },
          { type: 'note', tone: 'info', text: 'A dataset is what the platform exports from this database to KAP: three indicator files (registry, observations, narratives) loaded into one KAP indicator collection.' },
        ];
      else if (step === 1) {
        const custom = v.preset === PRESET_CUSTOM;
        const warn = custom ? checkQueries({ registry: v.registry, observations: v.observations, narratives: v.narratives }).warnings : [];
        f = [
          { k: 'preset', label: 'Mapping', type: 'select', opts: [PRESET_SCAI, PRESET_CUSTOM], hint: custom ? 'Three SQL queries that return the columns KAP expects.' : SCAI_HINT },
          ...(custom
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
      } else if (step === 2) {
        const n = String(v.collection || '').trim() || '<name>';
        f = edit
          ? [
              { type: 'kv', rows: [['Target collection', ds!.collection_name], ['KAP connector', ds!.kap?.connector ?? `${ds!.collection_name}_pg`], ['KAP pipeline', ds!.kap?.pipeline ?? `${ds!.collection_name}_pipeline`], ['Created in KAP', ds!.kap?.provisioned_at ? 'Yes' : 'At the first run']] },
              { type: 'note', tone: 'info', text: 'The target collection cannot change. Create another dataset to export into a new collection.' },
            ]
          : [
              { k: 'collection', label: 'Target collection (new)', type: 'text', ph: 'e.g. askai_indicators', hint: '4–29 letters, digits and underscores. A new KAP indicator collection.' },
              { type: 'note', tone: 'info', text: `KAP gets an indicator collection ${n}, an S3 connector ${n}_pg and a pipeline ${n}_pipeline (created once, at the first run). Agents read the collection with the indicator tools, such as find_indicator.` },
            ];
      } else if (step === 3)
        f = [
          { k: 'schedule', label: 'Schedule', type: 'select', opts: scheduleOpts(ds?.schedule_minutes) },
          { type: 'note', tone: 'info', text: 'The platform runs scheduled exports. Each export replaces the files in the bucket; KAP loads them on its next scan. You can always run an export by hand.' },
        ];
      else {
        const patch = edit ? toPgDatasetPatch(ds!, v) : null;
        const custom = v.preset === PRESET_CUSTOM;
        f = [
          {
            type: 'kv',
            label: 'Summary',
            rows: [
              ['Dataset', v.name],
              ['Data source', source.name],
              ['Mapping', custom ? 'Custom SQL (3 queries)' : PRESET_SCAI],
              ...(custom ? [] : ([['Only published indicators', v.published]] as [string, unknown][])),
              ['Target collection', edit ? ds!.collection_name : v.collection],
              ['Schedule', v.schedule],
              ...(edit ? ([['Changes', patch ? Object.keys(patch).join(', ') : 'None']] as [string, unknown][]) : []),
            ],
          },
          edit && !patch
            ? ({ type: 'note', tone: 'info', text: 'Nothing changed: the platform keeps the dataset as it is.' } as FormField)
            : ({ type: 'note', tone: 'info', text: 'After saving, the console previews the three files (row counts, first rows and problems). You can run the export from the preview.' } as FormField),
        ];
      }
      return withDefaults(f, v);
    },
    validate: (step, v) => validateDataset(step, v, check),
    finish: (v) => {
      for (const s of [0, 1, 2]) {
        const e = validateDataset(s, v, check);
        if (e) return e;
      }
      return finish(v);
    },
  };
}

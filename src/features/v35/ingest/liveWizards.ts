/**
 * Wizards for the live tenant's KAP records: S3 connectors (data sources) and
 * KAP pipelines. Same dialogs as the design's wizards, with the fields KAP
 * takes. Bodies are built in `fromKap.ts`; `finish` sends them.
 */
import type { FormField, FormValues, WizardSpec } from '@/engine/dialogs';
import {
  connectorValues, DOC_EXTS, IMG_EXTS, intervalL, INTERVALS, KEEP_KEYS, KEYS_REF, KEYS_TYPED, NEW_KEYS, NO_MODEL, pipelineValues, TASKS, toKapConnectorPatch, toKapPipelinePatch, unsupportedExts, validateConnector, validatePipeline,
  type KapConnector, type KapModel, type KapPipeline,
} from './fromKap';
import { SRC_TYPES } from './logic';

function withDefaults(fields: FormField[], v: FormValues): FormField[] {
  fields.forEach((f) => {
    if (f.type === 'select' && (v[f.k] == null || v[f.k] === '') && f.opts.length) v[f.k] = f.opts[0];
  });
  return fields;
}

// ------------------------------------------------------------------ source type (live tenant)
export const KAP_TYPE = 'S3 · stored in KAP';
export const sessType = (t: string) => `${t} · not available in KAP (session only)`;
export const SOURCE_TYPE_OPTS = [KAP_TYPE, ...SRC_TYPES.filter((t) => t !== 'S3').map(sessType)];
/** The design's type for a choice of `SOURCE_TYPE_OPTS` (null = S3 in KAP). */
export const typeOfChoice = (o: string): string | null => (o === KAP_TYPE ? null : o.replace(/ · not available in KAP \(session only\)$/, ''));

export const sourceTypeFields = (): FormField[] => [
  { k: 'type', label: 'Source type', type: 'select', opts: SOURCE_TYPE_OPTS },
  { type: 'note', tone: 'info', text: 'KAP connectors read S3 buckets. Other source types are not available in KAP: you can still sketch them, but they are kept in this browser session only and their tests and runs are simulated.' },
];

// ------------------------------------------------------------------ S3 connector
export type ConnMode = 'create' | 'edit' | 'restore';

export interface ConnWizardArgs {
  conn: KapConnector | null;
  mode: ConnMode;
  /** names of KAP connectors (active and deactivated) */
  existing: string[];
  finish: (v: FormValues) => Promise<string>;
}

const yesNo = ['Yes', 'No'];

export function connectorWizard({ conn, mode, existing, finish }: ConnWizardArgs): WizardSpec {
  const edit = mode !== 'create';
  const needKeys = mode !== 'edit';
  return {
    title: mode === 'create' ? 'Create data source' : mode === 'restore' ? `Reactivate ${conn!.name}` : `Edit ${conn!.name}`,
    steps: ['Source type', 'Name', 'Connection', 'Credentials', 'Check', 'Review'],
    finishL: mode === 'create' ? 'Create data source' : mode === 'restore' ? 'Reactivate' : 'Save changes',
    initial: { ...connectorValues(conn), keys: needKeys ? NEW_KEYS : KEEP_KEYS },
    initialStep: 1,
    fields: (step, v) => {
      let f: FormField[];
      if (step === 0) f = [{ type: 'kv', rows: [['Source type', 'S3 (KAP connector)']] }];
      else if (step === 1)
        f = [
          { k: 'name', label: 'Name', type: 'text', ro: edit, ph: 'e.g. sales_bucket', hint: edit ? 'Collections refer to the connector by name.' : '4–32 letters, digits and underscores. Collections refer to the connector by name.' },
          ...(mode === 'restore' ? [{ type: 'note', tone: 'info', text: 'Creating a connector under the name of a deactivated one brings it back with its scanned objects and collection links. KAP needs the keys again.' } as FormField] : []),
        ];
      else if (step === 2)
        f = [
          { k: 'endpoint_url', label: 'Endpoint URL', type: 'text', ph: 'https://s3.example.internal' },
          { k: 'region', label: 'Region (optional)', type: 'text', ph: 'e.g. me-central-1' },
          { k: 'bucket_name', label: 'Bucket', type: 'text', ph: 'bucket-name' },
          { k: 'prefix', label: 'Prefix (optional)', type: 'text', ph: 'e.g. exports/', hint: 'Only objects whose key starts with the prefix are selected.' },
          { k: 'include', label: 'Include patterns (optional)', type: 'text', ph: '**/*.pdf, **/*.docx', hint: 'Comma-separated globs. Empty selects every object.' },
          ...(unsupportedExts(v.include).length
            ? [{ type: 'note', tone: 'warn', text: `KAP pipelines cannot read ${unsupportedExts(v.include).map((x) => `.${x}`).join(', ')} files, so they will be skipped. Documents: PDF, DOC, DOCX; images go through a vision model; indicator packages: CSV.` } as FormField]
            : []),
          { k: 'exclude', label: 'Exclude patterns (optional)', type: 'text', ph: '*.log, temp/*' },
          { k: 'interval', label: 'Sync interval', type: 'select', opts: [...new Set([...INTERVALS, v.interval].filter(Boolean))], hint: `${intervalL(v.interval)}. KAP scans the bucket on this interval and processes new or changed files.` },
          { k: 'use_ssl', label: 'Use SSL', type: 'select', opts: yesNo },
          { k: 'verify_tls', label: 'Verify TLS certificates', type: 'select', opts: yesNo },
          { k: 'addressing_style', label: 'Addressing style', type: 'select', opts: ['auto', 'path', 'virtual'] },
        ];
      else if (step === 3) {
        const set = needKeys || v.keys === NEW_KEYS;
        f = [
          ...(needKeys ? [] : [{ k: 'keys', label: 'Access key and secret key', type: 'select', opts: [KEEP_KEYS, NEW_KEYS] } as FormField]),
          ...(set ? [{ k: 'key_mode', label: 'How to give the keys', type: 'select', opts: [KEYS_TYPED, KEYS_REF] } as FormField] : []),
          ...(set && v.key_mode !== KEYS_REF
            ? [
                { k: 'ak_value', label: 'Access key', type: 'text', secret: true } as FormField,
                { k: 'sk_value', label: 'Secret key', type: 'text', secret: true } as FormField,
                { type: 'note', tone: 'warn', text: 'For a KAP without a secret store (SECRET_PROVIDER_MODE=disabled, as on the test stand). The values go to KAP once and are never shown again. A KAP that requires a secret store rejects typed values; use a secret store reference there.' } as FormField,
              ]
            : []),
          ...(set && v.key_mode === KEYS_REF
            ? [
                { k: 'backend', label: 'Secret store', type: 'select', opts: ['vault', 'azure_key_vault'] } as FormField,
                { k: 'ak_id', label: 'Access key · secret id', type: 'text', ph: '00000000-0000-0000-0000-000000000000' } as FormField,
                { k: 'ak_ver', label: 'Access key · version', type: 'text', ph: '1' } as FormField,
                { k: 'sk_id', label: 'Secret key · secret id', type: 'text', ph: '00000000-0000-0000-0000-000000000000' } as FormField,
                { k: 'sk_ver', label: 'Secret key · version', type: 'text', ph: '1' } as FormField,
                { type: 'note', tone: 'info', text: 'Exact-version references to secrets in the tenant secret store. Write the values to the secret store first. KAP returns only whether each key is set.' } as FormField,
              ]
            : []),
        ];
      } else if (step === 4)
        f = [
          { k: 'check', label: 'Check the connection after saving', type: 'select', opts: yesNo },
          { type: 'note', tone: 'info', text: 'KAP checks a stored connector: it reaches the endpoint and bucket, authorizes the keys, then writes and removes a temporary object. The result is shown on the data source.' },
        ];
      else {
        const patch = mode === 'edit' && conn ? toKapConnectorPatch(conn, v) : null;
        f = [
          {
            type: 'kv',
            label: 'Summary',
            rows: [
              ['Type', 'S3 (KAP connector)'],
              ['Name', v.name],
              ['Endpoint', v.endpoint_url],
              ['Bucket', v.bucket_name],
              ['Region', v.region || '—'],
              ['Prefix', v.prefix || '—'],
              ['Include', v.include || 'All objects'],
              ['Exclude', v.exclude || 'None'],
              ['Sync', intervalL(v.interval)],
              ['TLS', `SSL ${v.use_ssl} · verify ${v.verify_tls} · ${v.addressing_style} addressing`],
              ['Keys', needKeys || v.keys === NEW_KEYS ? (v.key_mode === KEYS_REF ? `New references in ${v.backend}` : 'New key values (hidden)') : 'Unchanged'],
              ['Connection check', v.check === 'Yes' ? 'After saving' : 'Not now'],
              ...(mode === 'edit' ? ([['Changes', patch ? Object.keys(patch).join(', ') : 'None']] as [string, unknown][]) : []),
            ],
          },
          ...(mode === 'edit' && !patch ? [{ type: 'note', tone: 'info', text: 'Nothing changed: KAP keeps the connector as it is.' } as FormField] : []),
        ];
      }
      return withDefaults(f, v);
    },
    validate: (step, v) => validateConnector(step, v, existing, edit, needKeys),
    finish: (v) => {
      for (const s of [1, 2, 3]) {
        const e = validateConnector(s, v, existing, edit, needKeys);
        if (e) return e;
      }
      return finish(v);
    },
  };
}

// ------------------------------------------------------------------ pipeline
export interface PipeWizardArgs {
  pipe: KapPipeline | null;
  /** names of KAP pipelines (active and deleted) */
  existing: string[];
  models: KapModel[];
  /** collections that reference the pipeline (reprocessed on a stage change) */
  usedBy: string[];
  finish: (v: FormValues) => Promise<string>;
}

const modelOpts = (models: KapModel[], type: string, cur?: string, none = false) => [
  ...(none ? [NO_MODEL] : []),
  ...new Set([...models.filter((m) => m.model_type === type).map((m) => m.name), ...(cur && cur !== NO_MODEL ? [cur] : [])]),
];

/** Wizard values: a new document pipeline summarizes with `chat_default`, or the first chat model when there is none of that name. */
export function initialPipe(pipe: KapPipeline | null, models: KapModel[]): FormValues {
  const v = pipelineValues(pipe);
  if (pipe) return v;
  const chats = models.filter((m) => m.model_type === 'chat').map((m) => m.name);
  if (chats.length && !chats.includes(v.chat)) v.chat = chats[0];
  return v;
}

export function kapPipeWizard({ pipe, existing, models, usedBy, finish }: PipeWizardArgs): WizardSpec {
  const edit = !!pipe;
  return {
    title: edit ? `Edit ${pipe!.name}` : 'Create pipeline',
    steps: ['General', 'Stages', 'Review'],
    finishL: edit ? 'Save changes' : 'Save pipeline',
    initial: initialPipe(pipe, models),
    fields: (step, v) => {
      let f: FormField[];
      const ind = v.kind === 'indicators';
      if (step === 0)
        f = [
          { k: 'name', label: 'Pipeline name', type: 'text', ro: edit, ph: 'e.g. contracts_docs', hint: edit ? 'Collections refer to the pipeline by name.' : '4–64 letters, digits and underscores.' },
          edit ? { type: 'kv', rows: [['Kind', ind ? 'Indicators (CSV packages)' : 'Documents']] } : { k: 'kind', label: 'Kind', type: 'select', opts: ['document', 'indicators'], hint: 'document: parse, optionally summarize, then embed files. indicators: load CSV indicator packages.' },
          { type: 'note', tone: 'info', text: 'A pipeline gets its files through the collections that reference it. KAP runs it when you run it over a collection, or when a connector syncs. Pipeline schedules and event triggers are not available in KAP.' },
          ...(edit ? [{ type: 'note', tone: 'warn', text: `Changing the stages reprocesses every collection that uses this pipeline: ${usedBy.length ? usedBy.join(', ') : 'none right now'}.` } as FormField] : []),
        ];
      else if (step === 1) {
        const emb = modelOpts(models, 'embedding', v.embed);
        const noEmb = !emb.length ? [{ type: 'note', tone: 'warn', text: 'KAP has no embedding model provider in this tenant. Add one under model providers first.' } as FormField] : [];
        if (ind)
          f = [
            { k: 'mode', label: 'Mode', type: 'select', opts: ['delta', 'snapshot'], hint: 'snapshot: a package is the complete state and rows missing from it are deleted. delta: additions and updates only.' },
            { k: 'embed', label: 'Embedding model', type: 'select', opts: emb, hint: 'Used to index indicator cards for search.' },
            ...noEmb,
            { k: 'registry', label: 'Registry file pattern', type: 'text', ph: 'registry*.csv' },
            { k: 'observations', label: 'Observations file pattern', type: 'text', ph: 'observations*.csv' },
          ];
        else
          f = [
            { k: 'exts', label: 'Parse documents', type: 'chips', opts: DOC_EXTS, hint: 'Each file type gets its parser (markdown output).' },
            { k: 'imgs', label: 'Parse images with a vision model (optional)', type: 'chips', opts: IMG_EXTS },
            ...((v.imgs || []).length ? [{ k: 'vision', label: 'Vision model', type: 'select', opts: modelOpts(models, 'chat', v.vision, true) } as FormField] : []),
            { k: 'tasks', label: 'Summarize and other transformer tasks', type: 'chips', opts: TASKS, hint: 'summary: KAP summarizes each document group, which agents search with hybrid_search. Summary and metadata need a chat model.' },
            ...((v.tasks || []).length ? [{ k: 'chat', label: 'Chat model', type: 'select', opts: modelOpts(models, 'chat', v.chat, true) } as FormField] : []),
            ...((v.tasks || []).includes('summary')
              ? [{ k: 'prompt', label: 'Summary prompt', type: 'textarea', rows: 4, hint: 'Used for the initial, refine and merge steps. Collections can set their own summary prompt for their document groups.' } as FormField]
              : [{ type: 'note', tone: 'warn', label: 'No summary step', text: 'Agents will not be able to search collections that use this pipeline: hybrid_search needs the document group summaries.' } as FormField]),
            { k: 'embed', label: 'Embedding model', type: 'select', opts: emb },
            ...noEmb,
            { k: 'chunk', label: 'Chunk size (tokens)', type: 'num', ph: '800', hint: '50–4096' },
            { k: 'overlap', label: 'Overlap (tokens)', type: 'num', ph: '120', hint: '0–1024' },
          ];
      } else {
        const patch = edit ? toKapPipelinePatch(pipe!, v) : null;
        const restage = !!patch && 'stages' in patch;
        f = [
          {
            type: 'kv',
            label: 'Summary',
            rows: ind
              ? [['Pipeline', v.name], ['Kind', 'Indicators'], ['Mode', v.mode], ['Embedding model', v.embed], ['Files', `${v.registry} → registry · ${v.observations} → observations`]]
              : [
                  ['Pipeline', v.name],
                  ['Kind', 'Documents'],
                  ['Parser', [...(v.exts || []), ...((v.imgs || []).length ? [`${v.imgs.join(', ')} via ${v.vision}`] : [])].join(', ')],
                  ['Transformer', (v.tasks || []).length ? `${v.tasks.join(', ')} · ${v.chat}` : 'None'],
                  ['Searchable by agents', (v.tasks || []).includes('summary') ? 'Yes, with collections that group their documents' : 'No (no summary step)'],
                  ['Embedding', `${v.embed} · ${v.chunk} tokens, ${v.overlap} overlap`],
                ],
          },
          ...(edit && !patch ? [{ type: 'note', tone: 'info', text: 'Nothing changed: KAP keeps the pipeline as it is.' } as FormField] : []),
          ...(restage
            ? [{ type: 'note', tone: 'bad', label: 'Every collection that uses this pipeline is reprocessed from scratch', text: `${usedBy.length ? usedBy.join(', ') : 'No collection uses it now'}. Their stored files, file versions and vectors are cleared and every item goes back to pending.` } as FormField]
            : []),
        ];
      }
      return withDefaults(f, v);
    },
    validate: (step, v) => validatePipeline(step, v, existing, edit),
    finish: (v) => {
      for (const s of [0, 1]) {
        const e = validatePipeline(s, v, existing, edit);
        if (e) return e;
      }
      return finish(v);
    },
  };
}

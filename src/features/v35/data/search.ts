/**
 * Agent document search (KAP `hybrid_search`) — pure rules shared by the
 * Business Data Hub (collection form, "Searchable by agents" status and Fix),
 * the Data Ingestion Hub (Summarize stage of document pipelines) and the Agent
 * Factory (search instructions in the system prompt).
 *
 * What the test stand showed (25 Nov 2026): `hybrid_search` searches document
 * groups (KAP "entities") and their summaries. A collection is searchable when
 *   - its `entity` block is enabled with a folder boundary, an identity
 *     template and a summary model, and
 *   - its pipeline has a transformer stage with an enabled `summary` task
 *     (between parse and embed).
 * Only the template variables `{collection_id}` and `{relative_folder_path}`
 * are known to work, so only the folder strategy is offered.
 */
import type { KapEntitySpec } from './fromKap';

// ------------------------------------------------------------------ defaults
/**
 * Folder (document group) summary prompt for the collection. hybrid_search returns this one
 * summary per folder, so it must keep every document: a "concise" prompt dropped two of three
 * documents on the stand (25 Nov 2026); this one kept all three.
 */
export const SUMMARY_PROMPT =
  'Combine the document summaries into one Markdown text with one section per document, headed by its reference and title. Never drop a document and never merge two documents into one section. Keep every fact exactly as written: names, roles, dates, figures, units, table rows, decisions, risks and control phrases. When documents disagree, keep both claims and name their documents. Do not add facts, calculations or comparisons.';
/** Per-document summary prompt for the pipeline's Summarize step (input to the folder summary). */
export const DOC_SUMMARY_PROMPT =
  'Summarise this document in Markdown. Start with its reference and title. Keep every fact exactly as written: all names, roles, dates, figures, units, table rows (including empty or "not yet reported" values), decisions, risks and any control phrase. Do not shorten lists. Do not add facts, calculations or comparisons.';
export const DEFAULT_CHAT = 'chat_default';
export const GROUP_TEMPLATE = '{collection_id}:{relative_folder_path}';
/** generic grouping type of the sandbox tenant ("Generic source-document grouping without extracted metadata") */
export const PREFERRED_TYPE = 'indicator_document_context';
/** created when the tenant has no generic grouping type */
export const FALLBACK_TYPE = { name: 'document_group', description: 'Generic document grouping for agent search', schema: { type: 'object', properties: {} } };
export const SUMMARIZE_STAGE = 'summarize_document';
export const DEPTH_MIN = 1;
export const DEPTH_MAX = 20;

// ------------------------------------------------------------------ collection entity block
export interface SearchSettings {
  on: boolean;
  /** entity type name; '' = choose automatically (`pickEntityType`, else create FALLBACK_TYPE) */
  typeRef: string;
  root: string;
  depth: number;
  model: string;
  prompt: string;
}

const obj = (x: unknown): Record<string, any> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, any>) : {});

/** Settings shown in the collection form, from the collection's current entity block (or defaults). */
export function searchSettingsOf(e: KapEntitySpec | null | undefined, model = DEFAULT_CHAT, onByDefault = true): SearchSettings {
  const b = obj(e?.boundary);
  const s = obj(e?.summary);
  return {
    on: e ? !!e.enabled : onByDefault,
    typeRef: (e?.enabled && e.entity_type_ref) || '',
    root: typeof b.collection_root === 'string' && b.collection_root ? b.collection_root : '/',
    depth: Number.isInteger(b.folder_depth) ? b.folder_depth : 1,
    model: typeof s.model_ref === 'string' && s.model_ref ? s.model_ref : model,
    prompt: typeof s.initial_prompt === 'string' && s.initial_prompt ? s.initial_prompt : SUMMARY_PROMPT,
  };
}

/** '' or what is wrong with the search settings. */
export function checkSearchSettings(s: SearchSettings): string {
  if (!s.on) return '';
  if (!Number.isInteger(s.depth) || s.depth < DEPTH_MIN || s.depth > DEPTH_MAX) return `Folder depth: a whole number from ${DEPTH_MIN} to ${DEPTH_MAX}.`;
  if (!String(s.root).trim().startsWith('/')) return 'Collection root: a path that starts with "/".';
  if (!String(s.model).trim()) return 'Choose a summary model.';
  if (!String(s.prompt).trim()) return 'Enter the summary prompt.';
  return '';
}

/**
 * The collection's `entity` block for agent search (folder grouping, identity
 * template, summary). `prev` keeps what the console does not edit (recursive,
 * identity template, metadata) and the refine/merge prompts when the prompt is
 * unchanged. Off: the previous block, disabled.
 */
export function entityBlock(s: SearchSettings, typeRef: string, prev?: KapEntitySpec | null): KapEntitySpec {
  if (!s.on) return prev ? { ...prev, enabled: false } : { enabled: false };
  const pb = obj(prev?.boundary);
  const ps = obj(prev?.summary);
  const pi = obj(prev?.identity);
  const prompt = s.prompt.trim();
  const samePrompt = ps.initial_prompt === prompt;
  return {
    enabled: true,
    entity_type_ref: typeRef,
    summary: {
      model_ref: s.model.trim(),
      initial_prompt: prompt,
      refine_prompt: samePrompt && typeof ps.refine_prompt === 'string' ? ps.refine_prompt : prompt,
      merge_prompt: samePrompt && typeof ps.merge_prompt === 'string' ? ps.merge_prompt : prompt,
    },
    boundary: { strategy: 'folder', collection_root: s.root.trim() || '/', folder_depth: s.depth, recursive: typeof pb.recursive === 'boolean' ? pb.recursive : false },
    identity: { entity_id_template: typeof pi.entity_id_template === 'string' && pi.entity_id_template ? pi.entity_id_template : GROUP_TEMPLATE },
    metadata: prev?.metadata ?? null,
  };
}

const canon = (x: unknown): unknown => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon((x as any)[k])])) : x);
/** Same entity block (key order and missing-vs-undefined ignored). */
export const sameEntity = (a: KapEntitySpec | null | undefined, b: KapEntitySpec | null | undefined) => JSON.stringify(canon(a ?? { enabled: false })) === JSON.stringify(canon(b ?? { enabled: false }));

/** Entity type for document groups: the preferred generic one, else a generic one without required attributes, else null (create FALLBACK_TYPE). */
export function pickEntityType(types: { name: string; description?: string; schema?: Record<string, any> | null }[]): string | null {
  if (types.some((t) => t.name === PREFERRED_TYPE)) return PREFERRED_TYPE;
  if (types.some((t) => t.name === FALLBACK_TYPE.name)) return FALLBACK_TYPE.name;
  const generic = types.find((t) => {
    const req = Array.isArray(t.schema?.required) ? t.schema!.required : [];
    return !req.length && /document|generic|group/i.test(`${t.name} ${t.description ?? ''}`);
  });
  return generic?.name ?? null;
}

// ------------------------------------------------------------------ pipeline summarize stage
/** A pipeline stage as KAP returns it (only the parts read here are typed). */
export interface LooseStage {
  name?: string;
  type?: string;
  config?: any;
  [k: string]: unknown;
}
interface LooseTask { name: string; enabled?: boolean; config?: any }

const tasksOf = (s: LooseStage): LooseTask[] => (Array.isArray(s.config?.tasks) ? s.config.tasks : []);
const isSummary = (t: LooseTask) => t.name === 'summary' && t.enabled !== false;

/** The pipeline has a transformer stage with an enabled summary task. */
export const hasSummaryTask = (stages: LooseStage[] | null | undefined) => (stages ?? []).some((s) => s.type === 'transformer' && tasksOf(s).some(isSummary));

export const summaryTask = (prompt: string): LooseTask => ({ name: 'summary', enabled: true, config: { initial_prompt: prompt, refine_prompt: prompt, merge_prompt: prompt } });

/**
 * Stages with a summary task (idempotent). An existing transformer stage gets
 * the summary task (others kept); otherwise a `summarize_document` transformer
 * is inserted before the embedding stage. Parser routes and every other stage
 * are kept as they are.
 */
export function withSummarizeStage(stages: LooseStage[], model: string, prompt: string): { stages: LooseStage[]; changed: boolean } {
  if (hasSummaryTask(stages)) return { stages, changed: false };
  const out: LooseStage[] = structuredClone(stages);
  const tr = out.find((s) => s.type === 'transformer');
  if (tr) {
    const tasks = tasksOf(tr);
    const off = tasks.find((t) => t.name === 'summary');
    const next = off
      ? tasks.map((t) => (t === off ? { ...t, enabled: true, config: t.config && Object.keys(t.config).length ? t.config : summaryTask(prompt).config } : t))
      : [...tasks, summaryTask(prompt)];
    tr.config = { ...obj(tr.config), model_ref: tr.config?.model_ref || model, tasks: next };
    return { stages: out, changed: true };
  }
  const names = new Set(out.map((s) => s.name));
  let name = SUMMARIZE_STAGE;
  for (let i = 2; names.has(name); i++) name = `${SUMMARIZE_STAGE}_${i}`;
  const stage: LooseStage = { name, type: 'transformer', config: { model_ref: model, tasks: [summaryTask(prompt)] } };
  const emb = out.findIndex((s) => s.type === 'embedding');
  if (emb >= 0) out.splice(emb, 0, stage);
  else {
    const lastParser = out.map((s) => s.type).lastIndexOf('parser');
    out.splice(lastParser + 1, 0, stage);
  }
  return { stages: out, changed: true };
}

// ------------------------------------------------------------------ searchable status
export interface Searchable {
  ok: boolean;
  /** entity grouping is on with a folder boundary and an identity template */
  grouping: boolean;
  /** the pipeline has a summary task; null = pipeline not readable */
  summary: boolean | null;
  /** what is missing, in words */
  missing: string[];
}

export function searchableStatus(e: KapEntitySpec | null | undefined, pipeline: { stages?: LooseStage[] | null } | null | undefined): Searchable {
  const missing: string[] = [];
  const b = obj(e?.boundary);
  const id = obj(e?.identity);
  const sm = obj(e?.summary);
  let grouping = !!e?.enabled;
  if (!e?.enabled) missing.push('document grouping (entity) is off');
  else {
    if (!e.entity_type_ref) missing.push('no entity type for the document groups');
    if (!b.strategy) missing.push('no grouping boundary');
    if (!id.entity_id_template) missing.push('no group id template');
    if (!sm.model_ref) missing.push('no summary model on the collection');
    grouping = !!(e.entity_type_ref && b.strategy && id.entity_id_template && sm.model_ref);
  }
  const summary = pipeline ? hasSummaryTask(pipeline.stages) : null;
  if (summary === false) missing.push('the pipeline has no summary step');
  if (summary === null) missing.push('the pipeline could not be read');
  return { ok: grouping && summary === true, grouping, summary, missing };
}

// ------------------------------------------------------------------ group ids
export interface GroupIds {
  ids: string[];
  /** files directly in the collection root (their group id is not confirmed) */
  rootFiles: number;
  /** files outside the collection root (not grouped) */
  outside: number;
  /** the template uses only the known variables */
  known: boolean;
  template: string;
}

const KNOWN_VARS = new Set(['collection_id', 'relative_folder_path']);

/**
 * Group (entity) ids of a collection, derived from the identity template and
 * the folders of its files' `source_path` (relative to the connector prefix as
 * KAP reports it): `samples/qa.pdf` with depth 1 → `<collection id>:samples`.
 * Derived, not read from KAP.
 */
export function groupIds(collectionId: string, e: KapEntitySpec | null | undefined, sourcePaths: string[]): GroupIds {
  const b = obj(e?.boundary);
  const template = (obj(e?.identity).entity_id_template as string) || GROUP_TEMPLATE;
  const vars = [...template.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  const known = vars.every((v) => KNOWN_VARS.has(v));
  const depth = Number.isInteger(b.folder_depth) && b.folder_depth > 0 ? b.folder_depth : 1;
  const root = String(b.collection_root ?? '/').replace(/^\/+|\/+$/g, '');
  const ids = new Set<string>();
  let rootFiles = 0;
  let outside = 0;
  for (const sp of sourcePaths) {
    let p = sp.replace(/\\/g, '/').replace(/^\/+/, '');
    if (root) {
      if (!p.startsWith(`${root}/`)) {
        outside++;
        continue;
      }
      p = p.slice(root.length + 1);
    }
    const segs = p.split('/').filter(Boolean).slice(0, -1);
    if (!segs.length) {
      rootFiles++;
      continue;
    }
    const rel = segs.slice(0, depth).join('/');
    ids.add(template.split('{collection_id}').join(collectionId).split('{relative_folder_path}').join(rel));
  }
  return { ids: [...ids].sort(), rootFiles, outside, known, template };
}

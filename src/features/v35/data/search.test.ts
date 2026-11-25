import { describe, expect, it } from 'vitest';
import { kColl, kPipe, kType, fixtureCache } from './fromKap.fixtures';
import { collectionSearch, searchFix, toKapCollectionCreate, toKapCollectionPatch, type KapEntitySpec } from './fromKap';
import {
  checkSearchSettings, entityBlock, FALLBACK_TYPE, GROUP_TEMPLATE, groupIds, hasSummaryTask, pickEntityType, PREFERRED_TYPE, searchableStatus, searchSettingsOf, SUMMARY_PROMPT, withSummarizeStage,
  type LooseStage, type SearchSettings,
} from './search';

const ON: SearchSettings = { on: true, typeRef: PREFERRED_TYPE, root: '/', depth: 1, model: 'chat_default', prompt: SUMMARY_PROMPT };

/** sandbox_documents as KAP returned it on the test stand */
const SANDBOX: KapEntitySpec = {
  enabled: true,
  entity_type_ref: PREFERRED_TYPE,
  summary: { model_ref: 'chat_default', initial_prompt: SUMMARY_PROMPT, refine_prompt: SUMMARY_PROMPT, merge_prompt: SUMMARY_PROMPT },
  boundary: { strategy: 'folder', collection_root: '/', folder_depth: 1, recursive: false },
  identity: { entity_id_template: GROUP_TEMPLATE },
  metadata: null,
};

const parse: LooseStage = { name: 'parse', type: 'parser', routes: [{ match: { extensions: ['pdf'] }, parser: { provider: 'pdf', output: 'markdown', config: { preserve_tables: true } } }] };
const embed: LooseStage = { name: 'embed', type: 'embedding', config: { model_ref: 'embed_default', chunking: { chunk_size: 800, overlap: 120 } } };

describe('entity block', () => {
  it('builds the full block the test stand accepted', () => {
    expect(entityBlock(ON, PREFERRED_TYPE)).toEqual(SANDBOX);
  });

  it('keeps what the console does not edit, and refine/merge prompts while the prompt is unchanged', () => {
    const prev: KapEntitySpec = { ...SANDBOX, summary: { model_ref: 'chat_default', initial_prompt: SUMMARY_PROMPT, refine_prompt: 'R', merge_prompt: 'M' }, boundary: { strategy: 'folder', collection_root: '/', folder_depth: 1, recursive: true }, identity: { entity_id_template: '{collection_id}/{relative_folder_path}' }, metadata: { x: 1 } };
    const b = entityBlock({ ...ON, depth: 2 }, PREFERRED_TYPE, prev);
    expect(b.summary).toEqual({ model_ref: 'chat_default', initial_prompt: SUMMARY_PROMPT, refine_prompt: 'R', merge_prompt: 'M' });
    expect(b.boundary).toEqual({ strategy: 'folder', collection_root: '/', folder_depth: 2, recursive: true });
    expect(b.identity).toEqual({ entity_id_template: '{collection_id}/{relative_folder_path}' });
    expect(b.metadata).toEqual({ x: 1 });
    expect(entityBlock({ ...ON, prompt: 'New' }, PREFERRED_TYPE, prev).summary).toEqual({ model_ref: 'chat_default', initial_prompt: 'New', refine_prompt: 'New', merge_prompt: 'New' });
    expect(entityBlock({ ...ON, on: false }, PREFERRED_TYPE, prev)).toEqual({ ...prev, enabled: false });
    expect(entityBlock({ ...ON, on: false }, PREFERRED_TYPE)).toEqual({ enabled: false });
  });

  it('reads settings back and validates them', () => {
    expect(searchSettingsOf(SANDBOX)).toEqual(ON);
    expect(searchSettingsOf(null)).toEqual({ ...ON, typeRef: '' });
    expect(searchSettingsOf({ enabled: false }, 'chat_x', false)).toMatchObject({ on: false, model: 'chat_x' });
    expect(checkSearchSettings({ ...ON, depth: 0 })).toMatch(/Folder depth/);
    expect(checkSearchSettings({ ...ON, depth: 21 })).toMatch(/Folder depth/);
    expect(checkSearchSettings({ ...ON, root: 'docs' })).toMatch(/root/);
    expect(checkSearchSettings({ ...ON, model: '' })).toMatch(/model/);
    expect(checkSearchSettings({ ...ON, on: false, depth: 0 })).toBe('');
    expect(checkSearchSettings(ON)).toBe('');
  });

  it('chooses the entity type for document groups', () => {
    expect(pickEntityType([kType('Customer', { required: ['id'] }), kType(PREFERRED_TYPE, {})])).toBe(PREFERRED_TYPE);
    expect(pickEntityType([kType('Customer', {}), kType('generic_docs', { type: 'object' })])).toBe('generic_docs');
    expect(pickEntityType([kType('document_contract', { required: ['contract_id'] })])).toBeNull();
    expect(pickEntityType([])).toBeNull();
  });

  it('sends the block from the collection form (create and patch)', () => {
    expect(toKapCollectionCreate({ name: 'docs_x', pipeline: 'p', connectors: ['c'], search: ON }).entity).toEqual(SANDBOX);
    const c = kColl('docs_x', 'p', { entity: SANDBOX });
    expect(toKapCollectionPatch(c, { search: ON })).toBeNull();
    expect(toKapCollectionPatch(c, { search: { ...ON, depth: 2 } })).toEqual({ entity: { ...SANDBOX, boundary: { ...(SANDBOX.boundary as object), folder_depth: 2 } } });
    expect(toKapCollectionPatch(c, { search: { ...ON, on: false } })).toEqual({ entity: { ...SANDBOX, enabled: false } });
    // empty type: the collection's own type is kept
    expect(toKapCollectionPatch(c, { search: { ...ON, typeRef: '' } })).toBeNull();
  });
});

describe('summarize stage', () => {
  it('inserts a summarize stage before embedding and keeps the parser routes', () => {
    const { stages, changed } = withSummarizeStage([parse, embed], 'chat_default', SUMMARY_PROMPT);
    expect(changed).toBe(true);
    expect(stages.map((s) => s.name)).toEqual(['parse', 'summarize_document', 'embed']);
    expect(stages[0]).toEqual(parse);
    expect(stages[1]).toEqual({ name: 'summarize_document', type: 'transformer', config: { model_ref: 'chat_default', tasks: [{ name: 'summary', enabled: true, config: { initial_prompt: SUMMARY_PROMPT, refine_prompt: SUMMARY_PROMPT, merge_prompt: SUMMARY_PROMPT } }] } });
    expect(hasSummaryTask(stages)).toBe(true);
  });

  it('is idempotent', () => {
    const once = withSummarizeStage([parse, embed], 'chat_default', SUMMARY_PROMPT).stages;
    const twice = withSummarizeStage(once, 'chat_default', SUMMARY_PROMPT);
    expect(twice.changed).toBe(false);
    expect(twice.stages).toEqual(once);
  });

  it('adds the summary task to an existing transformer, or enables a disabled one', () => {
    const meta: LooseStage = { name: 'transform', type: 'transformer', config: { model_ref: 'chat_big', tasks: [{ name: 'metadata', enabled: true }] } };
    const r = withSummarizeStage([parse, meta, embed], 'chat_default', 'P');
    expect(r.stages.map((s) => s.name)).toEqual(['parse', 'transform', 'embed']);
    expect(r.stages[1].config).toEqual({ model_ref: 'chat_big', tasks: [{ name: 'metadata', enabled: true }, { name: 'summary', enabled: true, config: { initial_prompt: 'P', refine_prompt: 'P', merge_prompt: 'P' } }] });
    const off: LooseStage = { name: 'transform', type: 'transformer', config: { model_ref: 'chat_big', tasks: [{ name: 'summary', enabled: false, config: { initial_prompt: 'Old' } }] } };
    expect(withSummarizeStage([parse, off, embed], 'chat_default', 'P').stages[1].config.tasks).toEqual([{ name: 'summary', enabled: true, config: { initial_prompt: 'Old' } }]);
    // the input is not changed
    expect(meta.config.tasks).toHaveLength(1);
  });

  it('places the stage after the parser when there is no embedding stage, and avoids name clashes', () => {
    const r = withSummarizeStage([parse, { name: 'summarize_document', type: 'custom' }], 'm', 'P');
    expect(r.stages.map((s) => s.name)).toEqual(['parse', 'summarize_document_2', 'summarize_document']);
  });
});

describe('searchable status', () => {
  const pipeWith = (stages: LooseStage[]) => ({ stages });
  it('is searchable with grouping and a summary step', () => {
    const summarized = withSummarizeStage([parse, embed], 'chat_default', SUMMARY_PROMPT).stages;
    expect(searchableStatus(SANDBOX, pipeWith(summarized))).toEqual({ ok: true, grouping: true, summary: true, missing: [] });
  });
  it('names what is missing', () => {
    expect(searchableStatus({ enabled: false }, pipeWith([parse, embed])).missing).toEqual(['document grouping (entity) is off', 'the pipeline has no summary step']);
    const s = searchableStatus({ enabled: true, entity_type_ref: 'Customer', boundary: { strategy: 'folder' } }, null);
    expect(s.ok).toBe(false);
    expect(s.summary).toBeNull();
    expect(s.missing).toEqual(['no group id template', 'no summary model on the collection', 'the pipeline could not be read']);
  });
});

describe('group ids', () => {
  it('derives one group per top folder from the source paths', () => {
    const g = groupIds('1bbdb763', SANDBOX, ['public-documents/a.pdf', 'public-documents/sub/b.pdf', '/samples/qa_sample_doc.pdf', 'top.pdf']);
    expect(g.ids).toEqual(['1bbdb763:public-documents', '1bbdb763:samples']);
    expect(g.rootFiles).toBe(1);
    expect(g.known).toBe(true);
  });
  it('honours depth and the collection root', () => {
    const e = entityBlock({ ...ON, depth: 2, root: '/reports' }, PREFERRED_TYPE);
    const g = groupIds('c1', e, ['reports/2026/q1/a.pdf', 'reports/2025/b.pdf', 'other/c.pdf']);
    expect(g.ids).toEqual(['c1:2025', 'c1:2026/q1']);
    expect(g.outside).toBe(1);
  });
  it('flags unknown template variables', () => {
    expect(groupIds('c1', { ...SANDBOX, identity: { entity_id_template: '{collection_id}:{file_name}' } }, ['a/b.pdf']).known).toBe(false);
  });
});

describe('fix plan for a collection', () => {
  it('lists the pipeline change, the other collections and the entity block', () => {
    const c = fixtureCache();
    c.collections.push(kColl('other_docs', 'docs_pipeline'));
    c.models = [{ id: 'm1', name: 'chat_default', model_type: 'chat' }];
    const k = c.collections.find((x) => x.name === 'sandbox_docs')!;
    const fx = searchFix(c, k);
    expect(fx.err).toBe('');
    expect(fx.stages!.map((s) => s.type)).toEqual(['parser', 'transformer', 'embedding']);
    expect(fx.others).toEqual(['other_docs']);
    // keeps the collection's own type
    expect(fx.typeRef).toBe('Customer');
    expect(fx.createType).toBe(false);
    expect(fx.entity).toMatchObject({ enabled: true, entity_type_ref: 'Customer', identity: { entity_id_template: GROUP_TEMPLATE } });
  });
  it('creates the fallback type when the tenant has no generic one', () => {
    const c = fixtureCache();
    const k = kColl('plain_docs', 'docs_pipeline');
    c.collections.push(k);
    const fx = searchFix(c, k);
    expect(fx.typeRef).toBe(FALLBACK_TYPE.name);
    expect(fx.createType).toBe(true);
  });
  it('changes nothing on a searchable collection and refuses an unreadable pipeline', () => {
    const c = fixtureCache();
    const k = kColl('good_docs', 'good_pipe', { entity: SANDBOX });
    c.collections.push(k);
    c.pipelines!.push(kPipe('good_pipe', 'document', { stages: withSummarizeStage([parse, embed], 'chat_default', SUMMARY_PROMPT).stages }));
    expect(collectionSearch(c, k).status.ok).toBe(true);
    expect(searchFix(c, k)).toMatchObject({ stages: null, entity: null, err: '' });
    c.pipelines = null;
    expect(searchFix(c, k).err).toMatch(/could not be read/);
  });
});

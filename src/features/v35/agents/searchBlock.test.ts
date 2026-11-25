import { afterEach, describe, expect, it } from 'vitest';
import { kColl, kPipe } from '../data/fromKap.fixtures';
import { GROUP_TEMPLATE, PREFERRED_TYPE, SUMMARY_PROMPT, withSummarizeStage } from '../data/search';
import { searchInfo } from './live';
import { promptWithSearch, systemPromptWizard } from './liveForms';
import {
  DEFAULT_CHOICE, entityIdFor, loadChoice, needsSearch, saveChoice, searchBlock, searchTargets, searchWarnings, withSearchBlock,
  type CollSearchInfo,
} from './searchBlock';

const ONE = `How to search:
- Always call hybrid_search before answering, with exactly these fields:
  {"text": "<the question in your own words>", "collection_name": "sandbox_documents", "entity_id": "1bbdb763:public-documents", "top_k": 6}
- Never change collection_name or entity_id, never add metadata_filters, never invent IDs or collection names.
- If the first search returns nothing useful, search once more with different keywords.
How to answer:
- Answer only from what the search returned; do not guess or use outside knowledge.
- Name the document reference for every fact.
- If documents disagree, use the most recent one and say what changed.
- If the search returned nothing relevant, answer exactly: "The documents do not contain this information."`;

const info: Record<string, CollSearchInfo> = {
  sandbox_documents: { id: '1bbdb763', kind: 'document', ok: true, missing: [], groups: ['1bbdb763:public-documents', '1bbdb763:samples'] },
  qa_docs: { id: 'qa1', kind: 'document', ok: false, missing: ['the pipeline has no summary step'], groups: [] },
  sandbox_indicators: { id: 'ind1', kind: 'indicators', ok: false, missing: [], groups: [] },
};

describe('search instructions block', () => {
  it('writes one call line for one collection, exactly', () => {
    expect(searchBlock([{ collection: 'sandbox_documents', entityId: '1bbdb763:public-documents' }])).toBe(ONE);
  });

  it('writes one line per collection for two, and a placeholder for an unknown id', () => {
    const b = searchBlock([{ collection: 'a_docs', entityId: 'x' }, { collection: 'b_docs', entityId: '' }]).split('\n');
    expect(b[1]).toBe('- Always call hybrid_search before answering, once per collection, with exactly these fields:');
    expect(b[2]).toBe('  {"text": "<the question in your own words>", "collection_name": "a_docs", "entity_id": "x", "top_k": 6}');
    expect(b[3]).toBe('  {"text": "<the question in your own words>", "collection_name": "b_docs", "entity_id": "<entity id>", "top_k": 6}');
  });

  it('uses the group id (first group) or the fixed value', () => {
    expect(entityIdFor({ mode: 'group', value: 'ignored' }, ['g1', 'g2'])).toBe('g1');
    expect(entityIdFor({ mode: 'group', value: '' }, [])).toBe('');
    expect(entityIdFor({ mode: 'fixed', value: ' fixed-1 ' }, ['g1'])).toBe('fixed-1');
    expect(searchTargets(['sandbox_indicators', 'sandbox_documents'], info, { mode: 'group', value: '' })).toEqual([{ collection: 'sandbox_documents', entityId: '1bbdb763:public-documents' }]);
    expect(searchTargets(['sandbox_documents', 'qa_docs'], info, { mode: 'fixed', value: 'E' }).map((t) => t.entityId)).toEqual(['E', 'E']);
  });

  it('replaces an existing block and keeps the rest of the prompt', () => {
    const old = searchBlock([{ collection: 'old_docs', entityId: 'old' }]);
    const prompt = `You answer HR questions.\n\n${old}\n\nAlways be polite.`;
    const next = withSearchBlock(prompt, ONE);
    expect(next).toBe(`You answer HR questions.\n\n${ONE}\n\nAlways be polite.`);
    expect(withSearchBlock(next, ONE)).toBe(next);
  });

  it('appends when there is no block, or stands alone in an empty prompt', () => {
    expect(withSearchBlock('You answer HR questions.\n', ONE)).toBe(`You answer HR questions.\n\n${ONE}`);
    expect(withSearchBlock('', ONE)).toBe(ONE);
  });

  it('prefills a role line when the prompt is empty', () => {
    const p = promptWithSearch('', 'Answer questions about public documents', ['sandbox_documents'], info, { mode: 'group', value: '' });
    expect(p.split('\n')[0]).toBe("You are an assistant for: Answer questions about public documents. You answer questions from the organization's documents.");
    expect(p.endsWith(ONE)).toBe(true);
  });
});

describe('when an agent needs search and what to warn', () => {
  it('needs hybrid_search and a document collection', () => {
    expect(needsSearch(['hybrid_search'], ['sandbox_documents'], info)).toBe(true);
    expect(needsSearch(['hybrid_search'], ['sandbox_indicators'], info)).toBe(false);
    expect(needsSearch([], ['sandbox_documents'], info)).toBe(false);
  });

  it('warns about unsearchable collections, the missing tool and missing groups', () => {
    const w = searchWarnings([], ['qa_docs', 'sandbox_documents'], info, { mode: 'group', value: '' });
    expect(w[0]).toMatch(/^qa_docs is not searchable by agents yet \(the pipeline has no summary step\)/);
    expect(w[1]).toMatch(/not the hybrid_search tool/);
    const g = searchWarnings(['hybrid_search'], ['sandbox_documents'], { sandbox_documents: { ...info.sandbox_documents, groups: [] } }, { mode: 'group', value: '' });
    expect(g).toEqual([expect.stringMatching(/No document group was found for sandbox_documents/)]);
    expect(searchWarnings(['hybrid_search'], ['sandbox_documents'], info, { mode: 'fixed', value: '' })).toEqual(['The search entity id is set to a fixed value, but the value is empty.']);
    expect(searchWarnings(['hybrid_search'], ['sandbox_indicators'], info, { mode: 'group', value: '' })).toEqual([]);
  });
});

describe('per-agent entity id setting', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  it('round-trips through localStorage and survives blocked storage', () => {
    const mem: Record<string, string> = {};
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    expect(loadChoice('a1')).toEqual(DEFAULT_CHOICE);
    expect(saveChoice('a1', { mode: 'fixed', value: 'E1' })).toBe(true);
    expect(loadChoice('a1')).toEqual({ mode: 'fixed', value: 'E1' });
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadChoice('a1')).toEqual(DEFAULT_CHOICE);
    expect(saveChoice('a1', { mode: 'group', value: '' })).toBe(false);
  });
});

describe('search info and the system prompt editor', () => {
  it('derives kind, status and group ids from KAP collections', () => {
    const entity = { enabled: true, entity_type_ref: PREFERRED_TYPE, summary: { model_ref: 'chat_default' }, boundary: { strategy: 'folder', collection_root: '/', folder_depth: 1, recursive: false }, identity: { entity_id_template: GROUP_TEMPLATE } };
    const stages = withSummarizeStage([{ name: 'parse', type: 'parser' }, { name: 'embed', type: 'embedding' }], 'chat_default', SUMMARY_PROMPT).stages;
    const r = searchInfo([kColl('docs', 'doc_pipe', { id: 'c9', entity }), kColl('ind', 'indicator_pipeline')], [kPipe('doc_pipe', 'document', { stages }), kPipe('indicator_pipeline', 'indicators')], { c9: { paths: ['samples/qa_sample_doc.pdf'], total: 1 } });
    expect(r.docs).toEqual({ id: 'c9', kind: 'document', ok: true, missing: [], groups: ['c9:samples'] });
    expect(r.ind.kind).toBe('indicators');
  });

  it('inserts the block into the typed prompt', () => {
    const k = { name: 'doc_agent', description: 'Docs', collections: ['sandbox_documents'], allowed_tools: ['hybrid_search'], system_prompt_is_set: true } as unknown as Parameters<typeof systemPromptWizard>[0];
    const w = systemPromptWizard(k, info, { mode: 'group', value: '' }, () => '');
    const vals: Record<string, unknown> = { prompt: 'Be brief.' };
    const fields = w.fields(0, vals, (key, val) => { vals[key] = val; });
    const btn = fields.find((f) => f.type === 'button') as { click: () => void };
    btn.click();
    expect(vals.prompt).toBe(`Be brief.\n\n${ONE}`);
  });
});

describe('default entity id (verified on the stand, 25 Nov 2026)', () => {
  it('sends a fixed non-group value, because hybrid_search leaves the given entity out', () => {
    expect(DEFAULT_CHOICE).toEqual({ mode: 'fixed', value: 'none' });
    expect(entityIdFor(DEFAULT_CHOICE, ['d864b80f:samples'])).toBe('none');
  });
});

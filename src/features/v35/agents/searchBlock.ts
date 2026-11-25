/**
 * "How to search" instructions for agents that search documents with KAP's
 * `hybrid_search` tool. The model invents optional fields (collection_name,
 * metadata_filters, ids) unless the system prompt pins them, and `entity_id`
 * is required, so the block names exactly which values to send.
 *
 * Which `entity_id` hybrid_search expects is not confirmed yet: it is a
 * per-agent console setting (the collection's document group, or a fixed
 * value), kept in this browser's localStorage only.
 */

export const SEARCH_TOOL = 'hybrid_search';
export const BLOCK_START = 'How to search:';
export const ENTITY_PLACEHOLDER = '<entity id>';

/** What the console knows about a collection for agent search. */
export interface CollSearchInfo {
  /** KAP collection id */
  id: string;
  kind: 'document' | 'indicators';
  /** searchable by agents (grouping on and a summary step in the pipeline) */
  ok: boolean;
  /** what is missing, in words */
  missing: string[];
  /** derived document group ids */
  groups: string[];
}

export type EntityIdMode = 'group' | 'fixed';
export interface EntityIdChoice {
  mode: EntityIdMode;
  value: string;
}
export const ENTITY_MODE_L: Record<EntityIdMode, string> = { group: 'Collection document group', fixed: 'Fixed value' };
export const DEFAULT_CHOICE: EntityIdChoice = { mode: 'group', value: '' };

/** The entity id an agent sends for a collection: the fixed value, or the (first) document group. '' = unknown. */
export const entityIdFor = (choice: EntityIdChoice, groups: string[]) => (choice.mode === 'fixed' ? choice.value.trim() : groups[0] ?? '');

export interface SearchTarget {
  collection: string;
  /** '' = unknown (the placeholder is written) */
  entityId: string;
}

const line = (t: SearchTarget) => `  {"text": "<the question in your own words>", "collection_name": ${JSON.stringify(t.collection)}, "entity_id": ${JSON.stringify(t.entityId || ENTITY_PLACEHOLDER)}, "top_k": 6}`;

/** The block: one call line per document collection (KAP allows two collections per agent). */
export function searchBlock(targets: SearchTarget[]): string {
  return [
    BLOCK_START,
    targets.length > 1
      ? `- Always call ${SEARCH_TOOL} before answering, once per collection, with exactly these fields:`
      : `- Always call ${SEARCH_TOOL} before answering, with exactly these fields:`,
    ...targets.map(line),
    '- Never change collection_name or entity_id, never add metadata_filters, never invent IDs or collection names.',
    '- If the first search returns nothing useful, search once more with different keywords.',
    'How to answer:',
    '- Answer only from what the search returned; do not guess or use outside knowledge.',
    '- Name the document reference for every fact.',
    '- If documents disagree, use the most recent one and say what changed.',
    '- If the search returned nothing relevant, answer exactly: "The documents do not contain this information."',
  ].join('\n');
}

/**
 * The prompt with the search block replaced (from `How to search:` through the
 * block's last line: section headers, `- ` items and indented call lines) or
 * appended after a blank line.
 */
export function withSearchBlock(prompt: string, block: string): string {
  const lines = (prompt ?? '').replace(/\r\n/g, '\n').split('\n');
  const i = lines.findIndex((l) => l.trim() === BLOCK_START);
  if (i < 0) {
    const base = (prompt ?? '').replace(/\s+$/, '');
    return base ? `${base}\n\n${block}` : block;
  }
  let j = i + 1;
  const inBlock = (l: string) => l.trim() === 'How to answer:' || l.startsWith('- ') || /^\s+\S/.test(l);
  while (j < lines.length && inBlock(lines[j])) j++;
  return [...lines.slice(0, i), ...block.split('\n'), ...lines.slice(j)].join('\n');
}

/** Short role line for a new agent's prompt. */
export const roleLine = (purpose: string) =>
  purpose.trim() ? `You are an assistant for: ${purpose.trim().replace(/\.$/, '')}. You answer questions from the organization's documents.` : "You are an assistant that answers questions from the organization's documents.";

/** Targets for an agent's document collections. */
export function searchTargets(colls: string[], info: Record<string, CollSearchInfo>, choice: EntityIdChoice): SearchTarget[] {
  return colls.filter((c) => info[c]?.kind !== 'indicators').map((c) => ({ collection: c, entityId: entityIdFor(choice, info[c]?.groups ?? []) }));
}

/** The agent needs search instructions: it may call hybrid_search and has a document collection. */
export const needsSearch = (tools: string[], colls: string[], info: Record<string, CollSearchInfo>) => tools.includes(SEARCH_TOOL) && colls.some((c) => info[c]?.kind !== 'indicators');

/** Warnings for an agent page: document collections that are not searchable, or no hybrid_search tool. */
export function searchWarnings(tools: string[], colls: string[], info: Record<string, CollSearchInfo>, choice: EntityIdChoice): string[] {
  const docs = colls.filter((c) => info[c]?.kind === 'document');
  if (!docs.length) return [];
  const out: string[] = [];
  for (const c of docs) if (!info[c].ok) out.push(`${c} is not searchable by agents yet (${info[c].missing.join('; ') || 'unknown'}). Open the collection and use Fix.`);
  if (!tools.includes(SEARCH_TOOL)) out.push(`The agent has document collections (${docs.join(', ')}) but not the ${SEARCH_TOOL} tool, so it cannot search them. Add ${SEARCH_TOOL} under Allowed tools.`);
  else if (choice.mode === 'group') for (const c of docs) if (info[c].ok && !info[c].groups.length) out.push(`No document group was found for ${c} (no files in folders yet): the search instructions cannot name its entity id. Set a fixed search entity id or add files.`);
  if (choice.mode === 'fixed' && !choice.value.trim()) out.push('The search entity id is set to a fixed value, but the value is empty.');
  return out;
}

// ---------------------------------------------------------------- per-agent setting (this browser only)
const KEY = (agentId: string) => `kap-console:search-entity-id:${agentId}`;

export function loadChoice(agentId: string): EntityIdChoice {
  try {
    const raw = globalThis.localStorage?.getItem(KEY(agentId));
    const v = raw ? JSON.parse(raw) : null;
    if (v && (v.mode === 'group' || v.mode === 'fixed')) return { mode: v.mode, value: typeof v.value === 'string' ? v.value : '' };
  } catch {
    /* storage blocked or bad value: default */
  }
  return { ...DEFAULT_CHOICE };
}

export function saveChoice(agentId: string, c: EntityIdChoice): boolean {
  try {
    globalThis.localStorage?.setItem(KEY(agentId), JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

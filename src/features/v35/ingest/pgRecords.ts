/**
 * Records → searchable documents (dataset preset `records`): pure logic for the
 * dataset wizard, the dataset page and the run page. Each row of one table
 * becomes a small Word document ("record card": title, short "Label: value"
 * fields, long text sections) in a KAP document collection that agents search
 * with `hybrid_search`.
 *
 * Form keys start with `r_`; the table (`m_table`) and the filters (`m_f<i>_…`)
 * share the column mapping's keys, so its table step, column loading and filter
 * rows are reused. Field labels: `r_fl:<column>`, section labels: `r_sl:<column>`.
 */
import type { FormValues } from '@/engine/dialogs';
import type { ExportCounts, ExportRun, PgColumn, PgDataset, PgRecordPart, PgRecords } from '@/api/platformPg';
import { colNames, colOf, columnKind, emptyMappingValues, FILTER_ROWS, filterText, filtersOf, MAX_FILTERS, NO_FILTER, NONE, OP_LABEL, validateMapStep, type ColKind } from './pgMapping';

// ------------------------------------------------------------------ labels
export const DEFAULT_MAX = 5000;
export const MAX_MAX = 50000;
export const ORDER_ASC = 'Oldest / smallest first';
export const ORDER_DESC = 'Newest / largest first';
export const ORDER_OPTS = [ORDER_DESC, ORDER_ASC];
export const LANG_NONE = 'Not set (detected by KAP)';
export const LANG_LABEL: Record<'en' | 'ar', string> = { en: 'English', ar: 'Arabic' };
export const LANG_OPTS = [LANG_NONE, LANG_LABEL.en, LANG_LABEL.ar];

export const COST_NOTE = 'KAP summarises every new or changed record with the model; thousands of records take a while on the first load.';
export const KAP_LOAD_NOTE = 'KAP summarises each new or changed record with the model, then embeds it for search. Unchanged records are skipped.';

export const fieldKey = (col: string) => `r_fl:${col}`;
export const sectionKey = (col: string) => `r_sl:${col}`;

// ------------------------------------------------------------------ words
const ACRONYMS: Record<string, string> = { id: 'ID', url: 'URL', uri: 'URI', sku: 'SKU', sla: 'SLA', api: 'API', vat: 'VAT', faq: 'FAQ', uuid: 'UUID', ip: 'IP', kpi: 'KPI', ar: 'AR', en: 'EN', crm: 'CRM', po: 'PO' };

/** `ticket_id` → "Ticket ID", `createdAt` → "Created at", `SLA_due` → "SLA due". */
export function humanise(col: string | null | undefined): string {
  const words = String(col ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  if (!words.length) return '';
  return words
    .map((w, i) => ACRONYMS[w] ?? (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** `tickets` → `ticket`, `categories` → `category`, `addresses` → `address` (good enough for a default title). */
export function singular(word: string): string {
  const w = String(word ?? '');
  if (/ies$/i.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
  if (/(ss|us|is)$/i.test(w)) return w;
  if (/(ses|xes|zes|ches|shes)$/i.test(w)) return w.slice(0, -2);
  if (/s$/i.test(w) && w.length > 3) return w.slice(0, -1);
  return w;
}

const tableBase = (table: string) => String(table ?? '').split('.').pop() ?? '';

// ------------------------------------------------------------------ column choices
/** Long text: `text`, json and xml, or varchar longer than 255 characters. */
export function isLongText(type: string | null | undefined): boolean {
  const t = String(type ?? '').toLowerCase().trim();
  if (/^(text|jsonb?|xml|citext)\b/.test(t)) return true;
  const m = t.match(/^(character varying|varchar)\s*\((\d+)\)/);
  return !!m && Number(m[2]) > 255;
}

/** A column that holds long text: a long text type, unless it is named like a short value (status, category …). */
export const isLongColumn = (c: PgColumn | undefined) => !!c && isLongText(c.type) && !SHORT_RX.test(c.name);

const SECTION_RX = /(description|body|content|text|notes?|summary|details?|comments?|resolution|message|answer|question|terms|clause|remarks|abstract|instructions?|reason|feedback)$/i;
const SHORT_RX = /(^|_)(status|state|type|kind|category|priority|severity|channel|name|title|subject|owner|assignee|customer|client|vendor|product|sku|price|amount|currency|country|city|region|department|team|tags?|email|phone|date|at)$/i;
const ID_RX = /^(id|uuid|key|code|number|no)$|(_id|_uuid|_key|_code|_number|_no)$/i;
const TITLE_RX = /^(title|subject|name|headline|question|summary_title|label)(_en)?$/i;
/** Default order: the first of these date columns, newest first. */
const ORDER_PREF = ['updated_at', 'modified_at', 'last_modified', 'created_at', 'opened_at', 'date'];

/** Columns whose name and type look like a unique row id (not nullable; a number, text or uuid named like an id). */
export function looksUnique(c: PgColumn | undefined): boolean {
  if (!c) return false;
  const k = columnKind(c.type);
  if (k === 'bool' || k === 'date') return false;
  return !c.nullable && (ID_RX.test(c.name) || /^uuid\b/i.test(c.type));
}

/** Column names for the ID choice: unique-looking first. */
export const idOptions = (cols: PgColumn[]) => [...cols.filter(looksUnique), ...cols.filter((c) => !looksUnique(c))].map((c) => c.name);
/** Column names for sections: long text first, then other text, then the rest. */
export function sectionOptions(cols: PgColumn[]): string[] {
  const long = cols.filter(isLongColumn);
  const text = cols.filter((c) => !long.includes(c) && columnKind(c.type) === 'text');
  return [...long, ...text, ...cols.filter((c) => !long.includes(c) && !text.includes(c))].map((c) => c.name);
}

/** "Ticket {ticket_id}" from the table name and the ID column; adds ": {subject}" when a title-like column exists. */
export function defaultTitle(table: string, idCol: string, cols: PgColumn[] = []): string {
  const noun = humanise(singular(tableBase(table))) || 'Record';
  const t = cols.find((c) => TITLE_RX.test(c.name) && c.name !== idCol && columnKind(c.type) === 'text');
  return `${noun} {${idCol}}${t ? `: {${t.name}}` : ''}`;
}

/**
 * Values to set after the columns of the table are loaded: the ID column, the title,
 * fields (short columns), sections (long text) and the order. Choices that are columns
 * of this table are kept; others are replaced by a guess.
 */
export function recordDefaults(v: FormValues, cols: PgColumn[]): FormValues {
  const names = new Set(colNames(cols));
  const has = (x: unknown) => typeof x === 'string' && names.has(x);
  const out: FormValues = {};
  const id = has(v.r_id)
    ? (v.r_id as string)
    : (cols.find((c) => looksUnique(c) && /^id$/i.test(c.name)) ?? cols.find((c) => looksUnique(c) && c.name.toLowerCase() === `${singular(tableBase(v.m_table)).toLowerCase()}_id`) ?? cols.find(looksUnique) ?? cols[0])?.name ?? '';
  if (id !== v.r_id) out.r_id = id;
  if (!String(v.r_title ?? '').trim() || titleProblems(v.r_title, cols).length) out.r_title = defaultTitle(v.m_table, id, cols);
  const titleCols = placeholders(out.r_title ?? v.r_title);

  // a `text` column named like a short value (status, category …) is a field, not a section
  const long = isLongColumn;
  let sections: string[] = (v.r_sections ?? []).filter(has);
  if (!sections.length) sections = cols.filter((c) => c.name !== id && (long(c) || (columnKind(c.type) === 'text' && SECTION_RX.test(c.name)))).map((c) => c.name).slice(0, 4);
  let fields: string[] = (v.r_fields ?? []).filter(has);
  if (!fields.length)
    fields = cols
      .filter((c) => c.name !== id && !sections.includes(c.name) && !titleCols.includes(c.name) && !long(c) && (SHORT_RX.test(c.name) || columnKind(c.type) !== 'text'))
      .map((c) => c.name)
      .slice(0, 6);
  if (JSON.stringify(sections) !== JSON.stringify(v.r_sections ?? [])) out.r_sections = sections;
  if (JSON.stringify(fields) !== JSON.stringify(v.r_fields ?? [])) out.r_fields = fields;
  for (const c of fields) if (!String(v[fieldKey(c)] ?? '').trim()) out[fieldKey(c)] = humanise(c);
  for (const c of sections) if (!String(v[sectionKey(c)] ?? '').trim()) out[sectionKey(c)] = humanise(c);

  if (v.r_order && v.r_order !== NONE && !has(v.r_order)) out.r_order = NONE;
  if (!v.r_order || (v.r_order === NONE && !v._rOrderSet)) {
    const o = ORDER_PREF.map((n) => cols.find((c) => c.name.toLowerCase() === n && columnKind(c.type) === 'date')).find(Boolean);
    if (o) Object.assign(out, { r_order: o.name, r_order_dir: ORDER_DESC });
  }
  for (const i of FILTER_ROWS) {
    const c = v[`m_f${i}_col`];
    if (c && c !== NO_FILTER && !has(c)) out[`m_f${i}_col`] = NO_FILTER;
  }
  return out;
}

/** Fill in a humanised label for every chosen field and section that has none (after a chip is added). */
export function labelDefaults(v: FormValues): FormValues {
  const out: FormValues = {};
  for (const c of v.r_fields ?? []) if (v[fieldKey(c)] == null || v[fieldKey(c)] === '') out[fieldKey(c)] = humanise(c);
  for (const c of v.r_sections ?? []) if (v[sectionKey(c)] == null || v[sectionKey(c)] === '') out[sectionKey(c)] = humanise(c);
  return out;
}

// ------------------------------------------------------------------ title template
/** The `{column}` names of a title template, in order, without repeats. */
export function placeholders(tpl: string | null | undefined): string[] {
  return [...new Set([...String(tpl ?? '').matchAll(/\{([^{}]*)\}/g)].map((m) => m[1].trim()))];
}

/** Problems of a title template against the columns of the table ([] = fine). */
export function titleProblems(tpl: string | null | undefined, cols: PgColumn[]): string[] {
  const t = String(tpl ?? '').trim();
  if (!t) return ['Type a title, e.g. Ticket {ticket_id}.'];
  const out: string[] = [];
  let depth = 0;
  for (const ch of t) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth < 0 || depth > 1) {
      out.push('Title: every { needs a matching } (placeholders cannot be nested).');
      break;
    }
  }
  if (!out.length && depth !== 0) out.push('Title: every { needs a matching } (placeholders cannot be nested).');
  if (out.length) return out;
  const names = new Set(colNames(cols));
  const ph = placeholders(t);
  if (ph.some((p) => !p)) out.push('Title: {} is empty: put a column name between the braces.');
  const bad = ph.filter((p) => p && !names.has(p));
  if (bad.length) out.push(`Title: ${bad.map((b) => `{${b}}`).join(', ')} ${bad.length === 1 ? 'is not a column' : 'are not columns'} of the table.`);
  if (t.length > 200) out.push('Title: at most 200 characters.');
  return out;
}

const SAMPLE: Record<ColKind, string> = { number: '1042', date: '2024-05-01', bool: 'true', text: '' };
/** The title with each placeholder replaced by a stand-in: "Ticket 1042: ‹subject›". */
export function exampleTitle(tpl: string | null | undefined, cols: PgColumn[]): string {
  return String(tpl ?? '').replace(/\{([^{}]*)\}/g, (_, name: string) => {
    const c = colOf(cols, name.trim());
    if (!c) return `{${name}}`;
    return SAMPLE[columnKind(c.type)] || `‹${c.name}›`;
  });
}

// ------------------------------------------------------------------ form ⇄ records
/** Empty form values for a new records setting (with the mapping's table and filter keys). */
export function emptyRecordsValues(): FormValues {
  return {
    ...emptyMappingValues(),
    r_id: '',
    r_title: '',
    r_fields: [],
    r_sections: [],
    r_order: NONE,
    r_order_dir: ORDER_DESC,
    r_max: String(DEFAULT_MAX),
    r_lang: LANG_NONE,
  };
}

/** Form values of a stored records setting (edit). */
export function recordsValues(r: PgRecords | null | undefined): FormValues {
  const v = emptyRecordsValues();
  if (!r) return v;
  Object.assign(v, {
    m_table: r.table,
    r_id: r.id_column ?? '',
    r_title: r.title ?? '',
    r_fields: (r.fields ?? []).map((f) => f.column),
    r_sections: (r.sections ?? []).map((f) => f.column),
    r_order: r.order_by?.column || NONE,
    r_order_dir: r.order_by && !r.order_by.desc ? ORDER_ASC : ORDER_DESC,
    r_max: String(r.max_records ?? DEFAULT_MAX),
    r_lang: r.language ? LANG_LABEL[r.language] ?? LANG_NONE : LANG_NONE,
    _rOrderSet: true,
  });
  for (const f of r.fields ?? []) v[fieldKey(f.column)] = f.label;
  for (const f of r.sections ?? []) v[sectionKey(f.column)] = f.label;
  (r.filters ?? []).slice(0, MAX_FILTERS).forEach((f, i) => {
    v[`m_f${i + 1}_col`] = f.column;
    v[`m_f${i + 1}_op`] = OP_LABEL[f.op] ?? OP_LABEL['='];
    v[`m_f${i + 1}_val`] = f.value ?? '';
  });
  return v;
}

const parts = (cols: string[] | undefined, key: (c: string) => string, v: FormValues): PgRecordPart[] =>
  (cols ?? []).map((column) => ({ column, label: String(v[key(column)] ?? '').trim() || humanise(column) }));

/** Max records as a number (the default when empty or not a number). */
export function maxOf(v: FormValues): number {
  const s = String(v.r_max ?? '').replace(/[,\s]/g, '');
  const n = Number(s);
  return s && Number.isFinite(n) ? Math.trunc(n) : DEFAULT_MAX;
}

/** The platform's `records` from the form. Optional parts are left out when not set. */
export function toRecords(v: FormValues): PgRecords {
  const r: PgRecords = {
    table: String(v.m_table ?? '').trim(),
    id_column: String(v.r_id ?? ''),
    title: String(v.r_title ?? '').trim(),
    fields: parts(v.r_fields, fieldKey, v),
    sections: parts(v.r_sections, sectionKey, v),
    max_records: maxOf(v),
  };
  const filters = filtersOf(v);
  if (filters.length) r.filters = filters;
  if (v.r_order && v.r_order !== NONE) r.order_by = { column: String(v.r_order), desc: v.r_order_dir !== ORDER_ASC };
  const lang = (Object.keys(LANG_LABEL) as ('en' | 'ar')[]).find((k) => LANG_LABEL[k] === v.r_lang);
  if (lang) r.language = lang;
  return r;
}

/** A canonical text of a records setting (sorted keys; null, undefined and empty lists dropped), to compare two. */
export function recordsKey(r: PgRecords | null | undefined): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object')
      return Object.fromEntries(
        Object.keys(x)
          .sort()
          .map((k) => [k, (x as Record<string, unknown>)[k]] as const)
          .filter(([, val]) => val != null && !(Array.isArray(val) && !val.length))
          .map(([k, val]) => [k, norm(val)]),
      );
    return x;
  };
  return r ? JSON.stringify(norm(r)) : '';
}

// ------------------------------------------------------------------ checks
export type RecStep = 'table' | 'record' | 'content' | 'filters';

/** '' or the first problem of a records step, in plain words. `cols`: the columns of the chosen table. */
export function validateRecordStep(step: RecStep, v: FormValues, cols: PgColumn[]): string {
  if (step === 'table') return validateMapStep('table', v, cols);
  const names = new Set(colNames(cols));
  const known = (x: unknown) => typeof x === 'string' && names.has(x);
  if (step === 'record') {
    if (!known(v.r_id)) return 'Choose the ID column: a column whose value is different in every row.';
    const tp = titleProblems(v.r_title, cols);
    if (tp.length) return tp[0];
    if (v.r_order && v.r_order !== NONE && !known(v.r_order)) return `Order by: ${v.r_order} is not a column of ${v.m_table}.`;
    return '';
  }
  if (step === 'content') {
    const fields: string[] = v.r_fields ?? [];
    const sections: string[] = v.r_sections ?? [];
    if (!fields.length && !sections.length) return 'Choose at least one field or section: a document needs some content to search.';
    const bad = [...fields, ...sections].filter((c) => !known(c));
    if (bad.length) return `Not a column of ${v.m_table}: ${bad.join(', ')}.`;
    const both = fields.filter((c) => sections.includes(c));
    if (both.length) return `${both.join(', ')} ${both.length === 1 ? 'is' : 'are'} both a field and a section: choose one.`;
    const labels = [...parts(fields, fieldKey, v), ...parts(sections, sectionKey, v)].map((p) => p.label.toLowerCase());
    const dup = labels.find((l, i) => labels.indexOf(l) !== i);
    if (dup) return `Two parts have the label “${dup}”: give each its own label.`;
    return '';
  }
  const fe = validateMapStep('filters', v, cols);
  if (fe) return fe;
  const s = String(v.r_max ?? '').replace(/[,\s]/g, '');
  const n = Number(s);
  if (!s || !Number.isInteger(n) || n < 1 || n > MAX_MAX) return `Max records: a whole number from 1 to ${MAX_MAX.toLocaleString('en-US')}.`;
  return '';
}

/** Hints that never block: an ID column that does not look unique, a title without a placeholder … */
export function recordWarnings(step: RecStep, v: FormValues, cols: PgColumn[]): string[] {
  const w: string[] = [];
  if (step === 'record') {
    const c = colOf(cols, v.r_id);
    if (c && !looksUnique(c))
      w.push(`${c.name} does not look unique${c.nullable ? ' (it may be empty)' : ''}: rows with the same ID overwrite each other's document. Choose the table's primary key if it has one.`);
    if (String(v.r_title ?? '').trim() && !placeholders(v.r_title).length) w.push('The title has no {column}: every document gets the same title.');
  }
  if (step === 'content') {
    const short = (v.r_sections ?? []).filter((x: string) => {
      const c = colOf(cols, x);
      return c && columnKind(c.type) !== 'text';
    });
    if (short.length) w.push(`${short.join(', ')} ${short.length === 1 ? 'is not text' : 'are not text'}: a short value reads better as a field.`);
    const long = (v.r_fields ?? []).filter((x: string) => isLongColumn(colOf(cols, x)));
    if (long.length) w.push(`${long.join(', ')} may hold long text: long text reads better as a section.`);
    if (!(v.r_sections ?? []).length) w.push('No sections: agents can only search the title and the fields.');
  }
  if (step === 'filters' && maxOf(v) > 10000) w.push(`${maxOf(v).toLocaleString('en-US')} records: the first load can take hours.`);
  return w;
}

// ------------------------------------------------------------------ summary
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const partText = (p: PgRecordPart) => (p.label && p.label !== humanise(p.column) ? `${p.label} (${p.column})` : p.label || p.column);

/**
 * "Each row of public.tickets becomes a document titled 'Ticket {ticket_id}' with 4 fields
 * and 2 sections; up to 5,000 records."
 */
export function recordsSummary(r: PgRecords): string {
  let s = `Each row of ${r.table} becomes a document titled '${r.title}' with ${plural(r.fields?.length ?? 0, 'field')} and ${plural(r.sections?.length ?? 0, 'section')}; up to ${plural(r.max_records ?? DEFAULT_MAX, 'record')}.`;
  if (r.filters?.length) s += ` Only rows where ${r.filters.map(filterText).join(' and ')}.`;
  if (r.order_by) s += ` ${r.order_by.desc ? 'Newest' : 'Oldest'} first by ${r.order_by.column}.`;
  return s;
}

/** The setting as label/value rows (dataset page, review step). */
export function recordsRows(r: PgRecords): [string, string][] {
  return [
    ['Table', r.table],
    ['ID column', r.id_column],
    ['Title', r.title],
    ['Fields', r.fields?.length ? r.fields.map(partText).join(', ') : 'None'],
    ['Sections', r.sections?.length ? r.sections.map(partText).join(', ') : 'None'],
    ['Filters', r.filters?.length ? r.filters.map(filterText).join(' and ') : 'None (every row)'],
    ['Order', r.order_by ? `${r.order_by.column} · ${r.order_by.desc ? 'descending' : 'ascending'}` : 'As the database returns them'],
    ['Max records', (r.max_records ?? DEFAULT_MAX).toLocaleString('en-US')],
    ['Language', r.language ? LANG_LABEL[r.language] : 'Not set'],
  ];
}

/** At most `max` characters of a card's text for a dialog note. */
export function cardExcerpt(text: string, max = 700): string {
  const t = String(text ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')} …` : t;
}

// ------------------------------------------------------------------ sample cards
export interface CardView {
  title: string;
  fields: [string, string][];
  sections: { label: string; body: string }[];
  /** lines that did not fit a field or section */
  rest: string;
}

/**
 * A card's plain text split back into its parts with the labels of the setting:
 * "Label: value" lines of known fields, and sections under a heading line equal to
 * a section label (optionally with leading #'s or a trailing colon).
 */
export function parseCard(doc: { title: string; text: string }, r: Pick<PgRecords, 'fields' | 'sections'> | null | undefined): CardView {
  const fieldLabels = new Set((r?.fields ?? []).map((f) => f.label.toLowerCase()));
  const sectionLabels = new Map((r?.sections ?? []).map((f) => [f.label.toLowerCase(), f.label] as const));
  const lines = String(doc.text ?? '').replace(/\r\n/g, '\n').split('\n');
  const out: CardView = { title: doc.title, fields: [], sections: [], rest: '' };
  const rest: string[] = [];
  let cur: { label: string; body: string[] } | null = null;
  const close = () => {
    if (cur) out.sections.push({ label: cur.label, body: cur.body.join('\n').trim() });
    cur = null;
  };
  let first = true;
  for (const raw of lines) {
    const line = raw.trim();
    if (first && line) {
      first = false;
      if (line.replace(/^#+\s*/, '') === doc.title) continue;
    }
    const heading = line.replace(/^#+\s*/, '').replace(/:$/, '').trim().toLowerCase();
    if (line && sectionLabels.has(heading)) {
      close();
      cur = { label: sectionLabels.get(heading)!, body: [] };
      continue;
    }
    if (cur) {
      (cur as { body: string[] }).body.push(raw);
      continue;
    }
    const m = line.match(/^([^:]{1,80}):\s*(.*)$/);
    if (m && fieldLabels.has(m[1].trim().toLowerCase())) {
      out.fields.push([m[1].trim(), m[2]]);
      continue;
    }
    if (line) rest.push(line);
  }
  close();
  out.rest = rest.join('\n');
  return out;
}

// ------------------------------------------------------------------ runs
/** A records run: the dataset is a records dataset, or the counts are document counts. */
export const isRecordsRun = (x: Pick<ExportRun, 'counts'>, ds?: Pick<PgDataset, 'preset'> | null) => ds?.preset === 'records' || x.counts?.documents != null;

export const RECORD_COUNTS: [keyof ExportCounts, string, string][] = [
  ['documents', 'Documents', 'Records read and written as documents'],
  ['new', 'New', 'Not in the collection before'],
  ['changed', 'Changed', 'Content differs from the last run'],
  ['removed', 'Removed', 'No longer returned by the table and filters'],
  ['unchanged', 'Unchanged', 'Same as the last run: KAP skips them'],
];

/** The five counts of a records run for the run page (`null` value = not reported yet). */
export function recordCountRows(c: ExportCounts | null | undefined): { key: string; label: string; value: number | null; hint: string }[] {
  return RECORD_COUNTS.map(([key, label, hint]) => ({ key, label, value: c?.[key] ?? null, hint }));
}

/** "1,204 documents · 12 new · 3 changed · 1 removed · 1,188 unchanged". */
export function recordCountsText(c: ExportCounts | null | undefined): string {
  if (!c) return '—';
  const p: string[] = [];
  if (c.documents != null) p.push(plural(c.documents, 'document'));
  for (const k of ['new', 'changed', 'removed', 'unchanged'] as const) if (c[k] != null) p.push(`${c[k]!.toLocaleString('en-US')} ${k}`);
  return p.join(' · ') || '—';
}

/**
 * The "create an agent" call to action: a records dataset with a successful run (its
 * collection exists in KAP). null when it should not be shown.
 */
export function agentCta(ds: PgDataset | null | undefined, runs: Pick<ExportRun, 'dataset_id' | 'status'>[]): { collection: string; text: string; how: string } | null {
  if (!ds || ds.preset !== 'records') return null;
  const ok = ds.last_run?.status === 'succeeded' || runs.some((r) => r.dataset_id === ds.id && r.status === 'succeeded');
  // a succeeded run has created the collection in KAP (the dataset's `kap` may not be reloaded yet)
  if (!ok) return null;
  const coll = ds.kap?.collection || ds.collection_name;
  return {
    collection: coll,
    text: `Create an agent that searches ${coll}`,
    how: `In Agents, create an agent, add the collection ${coll} and the hybrid_search tool: the agent wizard writes the search instructions.`,
  };
}

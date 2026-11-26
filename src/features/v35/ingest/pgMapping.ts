/**
 * Column mapping without SQL (dataset preset `mapped`): pure logic for the
 * dataset wizard and the dataset page. Form values ⇄ the platform's `mapping`,
 * step checks with plain messages, type hints from the column list, defaults
 * from column types, the frequency map editor and the summary text.
 *
 * Form keys start with `m_`. Wizard-only state (loaded columns, preview) starts
 * with `_` and never reaches the platform.
 */
import type { FormValues } from '@/engine/dialogs';
import type { PgColumn, PgFilterOp, PgFreq, PgMapping, PgMappingFilter, PgValueOrColumn } from '@/api/platformPg';

// ------------------------------------------------------------------ labels
export const NONE = '(none)';
export const NO_FILTER = '(no filter)';

export const KIND_AUTO = 'Automatic (from the column type)';
export const KIND_DATE = 'Date or timestamp';
export const KIND_TEXT = 'Text (YYYY, YYYY-Qn or YYYY-MM)';
export const PERIOD_KINDS = [KIND_AUTO, KIND_DATE, KIND_TEXT];

export const FREQ_COLUMN = 'From a column';
export const FREQ_LABEL: Record<PgFreq, string> = { A: 'Annual (A)', Q: 'Quarterly (Q)', M: 'Monthly (M)' };
export const FREQ_OPTS = [FREQ_LABEL.A, FREQ_LABEL.Q, FREQ_LABEL.M, FREQ_COLUMN];
export const FREQS: PgFreq[] = ['A', 'Q', 'M'];
const FREQ_WORD: Record<PgFreq, string> = { A: 'annual', Q: 'quarterly', M: 'monthly' };

export const MODE_NONE = 'None';
export const MODE_FIXED = 'Fixed text';
export const MODE_COLUMN = 'From a column';
export const MODES = [MODE_NONE, MODE_FIXED, MODE_COLUMN];

export const OP_LABEL: Record<PgFilterOp, string> = { '=': 'equals', '!=': 'does not equal', is_true: 'is true', is_false: 'is false', is_not_null: 'is not empty' };
export const OP_OPTS = Object.values(OP_LABEL);
export const opOf = (label: string): PgFilterOp => (Object.keys(OP_LABEL) as PgFilterOp[]).find((k) => OP_LABEL[k] === label) ?? '=';
export const opNeedsValue = (op: PgFilterOp) => op === '=' || op === '!=';
export const MAX_FILTERS = 3;
export const FILTER_ROWS = [1, 2, 3] as const;

export const PREFIX_RX = /^[a-z0-9_]{1,24}$/;

// ------------------------------------------------------------------ column types
export type ColKind = 'number' | 'date' | 'bool' | 'text';

/** The kind of a PostgreSQL type name (`numeric(12,2)`, `timestamp with time zone`, `character varying` …). */
export function columnKind(type: string | null | undefined): ColKind {
  const t = String(type ?? '').toLowerCase().trim();
  if (/^(smallint|integer|bigint|int|int2|int4|int8|decimal|numeric|real|double precision|float|float4|float8|money|smallserial|serial|bigserial)\b/.test(t)) return 'number';
  if (/^(date|timestamp|timestamptz)\b/.test(t)) return 'date';
  if (/^(boolean|bool)\b/.test(t)) return 'bool';
  return 'text';
}
const KIND_WORD: Record<ColKind, string> = { number: 'a number', date: 'a date', bool: 'true/false', text: 'text' };

export const colNames = (cols: PgColumn[]) => cols.map((c) => c.name);
export const colOf = (cols: PgColumn[], name: string | null | undefined) => cols.find((c) => c.name === name);
export const kindOf = (cols: PgColumn[], name: string | null | undefined): ColKind | null => {
  const c = colOf(cols, name);
  return c ? columnKind(c.type) : null;
};
/** Column names with the given kinds first (stable otherwise). */
export function namesFirst(cols: PgColumn[], kinds: ColKind[]): string[] {
  const hit = cols.filter((c) => kinds.includes(columnKind(c.type)));
  return [...hit, ...cols.filter((c) => !hit.includes(c))].map((c) => c.name);
}
/** "revenue · numeric, nullable" for a hint. */
export function typeHint(cols: PgColumn[], name: string | null | undefined): string {
  const c = colOf(cols, name);
  return c ? `${c.name} · ${c.type}${c.nullable ? ', may be empty' : ''}` : '';
}

// ------------------------------------------------------------------ small parts
/** Default ID prefix: the dataset name lower-cased, other characters → `_`, at most 24 characters. */
export function prefixOf(name: string | null | undefined): string {
  const s = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24)
    .replace(/_$/, '');
  return s || 'dataset';
}

/** "yearly, annual" → ['yearly', 'annual'] (trimmed, empty and repeated values dropped). */
export function splitList(s: string | null | undefined): string[] {
  return [...new Set(String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
}

/**
 * The frequency map from the raw values typed per letter: `{A: 'yearly, annual', M: 'monthly'}`
 * → `{yearly: 'A', annual: 'A', monthly: 'M'}`. Errors: no value at all, a value under two letters.
 */
export function parseFreqMap(text: Partial<Record<PgFreq, string>>): { map: Record<string, PgFreq>; errors: string[] } {
  const map: Record<string, PgFreq> = {};
  const errors: string[] = [];
  for (const f of FREQS)
    for (const raw of splitList(text[f])) {
      if (map[raw] && map[raw] !== f) errors.push(`“${raw}” is listed under both ${FREQ_WORD[map[raw]]} and ${FREQ_WORD[f]}.`);
      else map[raw] = f;
    }
  if (!Object.keys(map).length) errors.unshift('Type the values of the frequency column that mean annual, quarterly or monthly.');
  return { map, errors };
}

/** The editor's text per letter from a stored map. */
export function freqMapText(map: Record<string, PgFreq> | null | undefined): Record<PgFreq, string> {
  const out: Record<PgFreq, string> = { A: '', Q: '', M: '' };
  for (const f of FREQS)
    out[f] = Object.entries(map ?? {})
      .filter(([, v]) => v === f)
      .map(([k]) => k)
      .join(', ');
  return out;
}

const opt = (s: unknown) => (s == null || s === '' || s === NONE || s === NO_FILTER ? null : String(s));

/** `date` or `text` for the period: the chosen kind, or automatic from the column type (date/timestamp → date). */
export function periodKind(v: FormValues, cols: PgColumn[]): 'date' | 'text' {
  if (v.m_period_kind === KIND_DATE) return 'date';
  if (v.m_period_kind === KIND_TEXT) return 'text';
  return kindOf(cols, v.m_period) === 'date' ? 'date' : 'text';
}

const columnsOf = (v: FormValues): PgColumn[] => (v._cols && v._cols.table === v.m_table && Array.isArray(v._cols.columns) ? v._cols.columns : []);
/** The loaded columns of the chosen table ([] while not loaded). */
export const loadedColumns = columnsOf;

// ------------------------------------------------------------------ form ⇄ mapping
/** Empty form values for a new mapping. */
export function emptyMappingValues(): FormValues {
  return {
    m_table: '',
    m_series: [],
    m_prefix: '',
    m_period: '',
    m_period_kind: KIND_AUTO,
    m_freq: FREQ_LABEL.A,
    m_freq_col: '',
    m_freq_A: '',
    m_freq_Q: '',
    m_freq_M: '',
    m_value: '',
    m_target: NONE,
    m_dimension: NONE,
    m_domestic: '',
    m_name_en: NONE,
    m_name_ar: NONE,
    m_unit: MODE_NONE,
    m_unit_text: '',
    m_unit_col: '',
    m_source: MODE_NONE,
    m_source_text: '',
    m_source_col: '',
    m_definition: NONE,
    ...Object.fromEntries(FILTER_ROWS.flatMap((i) => [[`m_f${i}_col`, NO_FILTER], [`m_f${i}_op`, OP_LABEL['=']], [`m_f${i}_val`, '']])),
  };
}

function modeValues(key: 'unit' | 'source', x: PgValueOrColumn | null | undefined): FormValues {
  if (x && 'column' in x) return { [`m_${key}`]: MODE_COLUMN, [`m_${key}_col`]: x.column, [`m_${key}_text`]: '' };
  if (x && 'value' in x) return { [`m_${key}`]: MODE_FIXED, [`m_${key}_text`]: x.value, [`m_${key}_col`]: '' };
  return {};
}

/** Form values of a stored mapping (edit). */
export function mappingValues(m: PgMapping | null | undefined): FormValues {
  const v = emptyMappingValues();
  if (!m) return v;
  const fq = m.frequency;
  Object.assign(v, {
    m_table: m.table,
    m_series: [...(m.series_key ?? [])],
    m_prefix: m.id_prefix ?? '',
    m_period: m.period?.column ?? '',
    m_period_kind: m.period?.kind === 'date' ? KIND_DATE : KIND_TEXT,
    m_value: m.value ?? '',
    m_target: m.target || NONE,
    m_dimension: m.dimension || NONE,
    m_domestic: (m.domestic_values ?? []).join(', '),
    m_name_en: m.name_en || NONE,
    m_name_ar: m.name_ar || NONE,
    m_definition: m.definition || NONE,
    ...modeValues('unit', m.unit),
    ...modeValues('source', m.source),
  });
  if (fq && 'column' in fq) {
    const t = freqMapText(fq.map);
    Object.assign(v, { m_freq: FREQ_COLUMN, m_freq_col: fq.column, m_freq_A: t.A, m_freq_Q: t.Q, m_freq_M: t.M });
  } else if (fq && 'value' in fq) v.m_freq = FREQ_LABEL[fq.value] ?? FREQ_LABEL.A;
  (m.filters ?? []).slice(0, MAX_FILTERS).forEach((f, i) => {
    v[`m_f${i + 1}_col`] = f.column;
    v[`m_f${i + 1}_op`] = OP_LABEL[f.op] ?? OP_LABEL['='];
    v[`m_f${i + 1}_val`] = f.value ?? '';
  });
  return v;
}

function modeOf(v: FormValues, key: 'unit' | 'source'): PgValueOrColumn | null {
  const mode = v[`m_${key}`];
  if (mode === MODE_FIXED) {
    const t = String(v[`m_${key}_text`] ?? '').trim();
    return t ? { value: t } : null;
  }
  if (mode === MODE_COLUMN) {
    const c = opt(v[`m_${key}_col`]);
    return c ? { column: c } : null;
  }
  return null;
}

/** The filters that are filled in (a row needs a column). */
export function filtersOf(v: FormValues): PgMappingFilter[] {
  const out: PgMappingFilter[] = [];
  for (const i of FILTER_ROWS) {
    const column = opt(v[`m_f${i}_col`]);
    if (!column) continue;
    const op = opOf(v[`m_f${i}_op`]);
    out.push(opNeedsValue(op) ? { column, op, value: String(v[`m_f${i}_val`] ?? '') } : { column, op });
  }
  return out;
}

/** The platform's `mapping` from the form. Optional parts are left out when not set. `datasetName` gives the default ID prefix. */
export function toMapping(v: FormValues, datasetName?: string): PgMapping {
  const cols = columnsOf(v);
  const freq: PgMapping['frequency'] =
    v.m_freq === FREQ_COLUMN
      ? { column: String(v.m_freq_col ?? ''), map: parseFreqMap({ A: v.m_freq_A, Q: v.m_freq_Q, M: v.m_freq_M }).map }
      : { value: FREQS.find((f) => FREQ_LABEL[f] === v.m_freq) ?? 'A' };
  const m: PgMapping = {
    table: String(v.m_table ?? '').trim(),
    series_key: [...(v.m_series ?? [])],
    id_prefix: String(v.m_prefix ?? '').trim() || prefixOf(datasetName ?? v.name),
    period: { column: String(v.m_period ?? ''), kind: periodKind(v, cols) },
    frequency: freq,
    value: String(v.m_value ?? ''),
  };
  const target = opt(v.m_target);
  const dimension = opt(v.m_dimension);
  const nameEn = opt(v.m_name_en);
  const nameAr = opt(v.m_name_ar);
  const definition = opt(v.m_definition);
  const unit = modeOf(v, 'unit');
  const source = modeOf(v, 'source');
  const domestic = dimension ? splitList(v.m_domestic) : [];
  const filters = filtersOf(v);
  if (target) m.target = target;
  if (nameEn) m.name_en = nameEn;
  if (nameAr) m.name_ar = nameAr;
  if (unit) m.unit = unit;
  if (source) m.source = source;
  if (definition) m.definition = definition;
  if (dimension) m.dimension = dimension;
  if (domestic.length) m.domestic_values = domestic;
  if (filters.length) m.filters = filters;
  return m;
}

/** A canonical text of a mapping (sorted keys; null, undefined and empty lists dropped), to compare two mappings. */
export function mappingKey(m: PgMapping | null | undefined): string {
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
  return m ? JSON.stringify(norm(m)) : '';
}

// ------------------------------------------------------------------ defaults from columns
const pick = (cols: PgColumn[], rx: RegExp, kinds?: ColKind[]) => cols.find((c) => rx.test(c.name) && (!kinds || kinds.includes(columnKind(c.type))))?.name;

/**
 * Values to set after the columns of the table are loaded: column choices that are
 * empty or not columns of this table get a guess from names and types (period → the
 * first date column, value → a numeric column, …); everything else is kept.
 */
export function columnDefaults(v: FormValues, cols: PgColumn[]): FormValues {
  const names = new Set(colNames(cols));
  const out: FormValues = {};
  const has = (x: unknown) => typeof x === 'string' && names.has(x);
  const optional = (k: string, guess: string | undefined) => {
    if (v[k] && v[k] !== NONE && !has(v[k])) out[k] = guess ?? NONE;
    else if ((!v[k] || v[k] === NONE) && guess) out[k] = guess;
  };
  const series = (v.m_series ?? []).filter((x: string) => names.has(x));
  if (!series.length) {
    const g = pick(cols, /(^|_)(code|key|series|series_id|indicator_id|indicator_code)$/i, ['text', 'number']);
    out.m_series = g ? [g] : [];
  } else if (series.length !== (v.m_series ?? []).length) out.m_series = series;
  if (!has(v.m_period)) out.m_period = pick(cols, /.*/, ['date']) ?? pick(cols, /(period|date|month|quarter|year|time)/i) ?? '';
  const value = pick(cols, /^(value|amount|val|obs_value|actual|actual_value)$/i, ['number']) ?? pick(cols, /.*/, ['number']);
  if (!has(v.m_value)) out.m_value = value ?? '';
  const valueNow = out.m_value ?? v.m_value;
  optional('m_target', pick(cols, /target/i, ['number']));
  optional('m_dimension', undefined);
  optional('m_name_en', pick(cols, /^(name|name_en|title|title_en|label|label_en|indicator_name|indicator_name_en)$/i, ['text']));
  optional('m_name_ar', pick(cols, /(^|_)ar$/i, ['text']));
  optional('m_definition', pick(cols, /^(definition|definition_en|description|description_en)$/i, ['text']));
  if (v.m_freq_col && !has(v.m_freq_col)) out.m_freq_col = '';
  if (!v.m_freq_col || out.m_freq_col === '') {
    const g = pick(cols, /^(freq|frequency|periodicity)$/i);
    if (g) out.m_freq_col = g;
  }
  for (const k of ['unit', 'source'] as const) {
    const col = v[`m_${k}_col`];
    if (col && !has(col)) out[`m_${k}_col`] = '';
    if (v[`m_${k}`] === MODE_NONE && !col) {
      const g = pick(cols, k === 'unit' ? /^(unit|units|unit_en|uom)$/i : /^(source|source_en|data_source)$/i, ['text']);
      if (g) Object.assign(out, { [`m_${k}`]: MODE_COLUMN, [`m_${k}_col`]: g });
    }
  }
  for (const i of FILTER_ROWS) {
    const c = v[`m_f${i}_col`];
    if (c && c !== NO_FILTER && !has(c)) out[`m_f${i}_col`] = NO_FILTER;
  }
  if (out.m_target && out.m_target === valueNow) out.m_target = NONE;
  return out;
}

// ------------------------------------------------------------------ checks
export type MapStep = 'table' | 'series' | 'values' | 'labels' | 'filters';

/** '' or the first problem of a mapping step, in plain words. `cols`: the columns of the chosen table. */
export function validateMapStep(step: MapStep, v: FormValues, cols: PgColumn[]): string {
  const names = new Set(colNames(cols));
  const known = (x: unknown) => typeof x === 'string' && names.has(x);
  if (step === 'table') {
    const t = String(v.m_table ?? '').trim();
    if (!t) return 'Choose a table.';
    const st = v._cols;
    if (!st || st.table !== t || st.loading) return `Loading the columns of ${t}… try again in a moment.`;
    if (st.error) return `Could not read the columns of ${t}: ${st.error}`;
    if (!cols.length) return `${t} has no columns this user can read.`;
    return '';
  }
  if (step === 'series') {
    const series: string[] = v.m_series ?? [];
    if (!series.length) return 'Choose at least one series column: its values tell the series apart (e.g. region_code).';
    const bad = series.filter((x) => !names.has(x));
    if (bad.length) return `Not a column of ${v.m_table}: ${bad.join(', ')}.`;
    const p = String(v.m_prefix ?? '').trim();
    if (!PREFIX_RX.test(p)) return 'ID prefix: 1–24 lower-case letters, digits and underscores (e.g. sales).';
    if (!known(v.m_period)) return 'Choose the period column.';
    if (series.includes(v.m_period)) return `${v.m_period} is the period: it cannot also be a series column.`;
    if (v.m_freq === FREQ_COLUMN) {
      if (!known(v.m_freq_col)) return 'Choose the column that holds the frequency.';
      const { errors } = parseFreqMap({ A: v.m_freq_A, Q: v.m_freq_Q, M: v.m_freq_M });
      if (errors.length) return errors[0];
    }
    return '';
  }
  if (step === 'values') {
    if (!known(v.m_value)) return 'Choose the value column.';
    const target = opt(v.m_target);
    if (target && !known(target)) return `Not a column of ${v.m_table}: ${target}.`;
    if (target && target === v.m_value) return 'The target must be another column than the value.';
    const dim = opt(v.m_dimension);
    if (dim && !known(dim)) return `Not a column of ${v.m_table}: ${dim}.`;
    if (dim && (v.m_series ?? []).includes(dim)) return `${dim} is a series column: choose another dimension, or none.`;
    if (dim && dim === v.m_value) return `${dim} is the value column: choose another dimension, or none.`;
    return '';
  }
  if (step === 'labels') {
    for (const k of ['m_name_en', 'm_name_ar', 'm_definition']) {
      const c = opt(v[k]);
      if (c && !known(c)) return `Not a column of ${v.m_table}: ${c}.`;
    }
    for (const [k, w] of [['unit', 'Unit'], ['source', 'Source']] as const) {
      if (v[`m_${k}`] === MODE_FIXED && !String(v[`m_${k}_text`] ?? '').trim()) return `${w}: type the fixed text, or choose None.`;
      if (v[`m_${k}`] === MODE_COLUMN && !known(v[`m_${k}_col`])) return `${w}: choose the column.`;
    }
    return '';
  }
  for (const i of FILTER_ROWS) {
    const c = opt(v[`m_f${i}_col`]);
    if (!c) continue;
    if (!known(c)) return `Filter ${i}: ${c} is not a column of ${v.m_table}.`;
    if (opNeedsValue(opOf(v[`m_f${i}_op`])) && !String(v[`m_f${i}_val`] ?? '').trim()) return `Filter ${i}: type the value to compare ${c} with.`;
  }
  return '';
}

/** Hints from the column types (never block): a value that is not numeric, a period kind that does not fit … */
export function mappingWarnings(step: MapStep, v: FormValues, cols: PgColumn[]): string[] {
  const w: string[] = [];
  const k = (x: unknown) => kindOf(cols, x as string);
  if (step === 'series') {
    const pk = k(v.m_period);
    if (pk) {
      const kind = periodKind(v, cols);
      if (kind === 'date' && pk !== 'date') w.push(`${v.m_period} is ${KIND_WORD[pk]}, not a date: choose “${KIND_TEXT}” if its values already look like 2024, 2024-Q1 or 2024-03.`);
      if (kind === 'text' && pk === 'date') w.push(`${v.m_period} is a date column: “${KIND_DATE}” turns it into periods for you.`);
      if (kind === 'text' && pk === 'number') w.push(`${v.m_period} is a number: only years (e.g. 2024) work as text periods.`);
    }
    const nums = (v.m_series ?? []).filter((x: string) => k(x) === 'date');
    if (nums.length) w.push(`${nums.join(', ')} ${nums.length === 1 ? 'is a date' : 'are dates'}: a series column usually holds codes or names, not dates.`);
  }
  if (step === 'values') {
    const vk = k(v.m_value);
    if (vk && vk !== 'number') w.push(`${v.m_value} is ${KIND_WORD[vk]}, not a number: values that are not numbers will be rejected.`);
    const tk = k(opt(v.m_target));
    if (tk && tk !== 'number') w.push(`${v.m_target} (target) is ${KIND_WORD[tk]}, not a number.`);
    const dim = opt(v.m_dimension);
    if (dim && !splitList(v.m_domestic).length) w.push(`No main-series values: every row gets an id ending in its ${dim} value, and no series ends in “.overall”.`);
  }
  if (step === 'filters')
    for (const i of FILTER_ROWS) {
      const c = opt(v[`m_f${i}_col`]);
      const op = opOf(v[`m_f${i}_op`]);
      if (c && (op === 'is_true' || op === 'is_false') && k(c) && k(c) !== 'bool') w.push(`Filter ${i}: ${c} is ${KIND_WORD[k(c)!]}, not true/false.`);
    }
  return w;
}

// ------------------------------------------------------------------ summary
const valOrCol = (x: PgValueOrColumn | null | undefined) => (!x ? '' : 'column' in x ? `column ${x.column}` : `“${x.value}”`);
const quote = (s: string) => `'${s}'`;

export function filterText(f: PgMappingFilter): string {
  if (f.op === '=' || f.op === '!=') return `${f.column} ${f.op} ${quote(f.value ?? '')}`;
  return `${f.column} ${OP_LABEL[f.op]}`;
}

export function frequencyText(m: Pick<PgMapping, 'frequency'>): string {
  const f = m.frequency;
  if (!f) return '';
  if ('value' in f) return FREQ_WORD[f.value] ?? f.value;
  return `frequency from ${f.column}`;
}

/** What KAP ids look like: `sales.<region_code>.m.overall`. */
export function exampleId(m: Pick<PgMapping, 'id_prefix' | 'series_key' | 'frequency' | 'dimension'>): string {
  const f = m.frequency && 'value' in m.frequency ? m.frequency.value.toLowerCase() : '<a|q|m>';
  const key = `<${(m.series_key ?? []).join('+') || 'series'}>`;
  return [m.id_prefix || '<prefix>', key, f, m.dimension ? `<overall|${m.dimension}>` : 'overall'].join('.');
}

/**
 * One sentence: "Each row of public.monthly_sales is one value: series = region_code,
 * period = month (monthly), value = revenue, target = revenue_target …"
 */
export function mappingSummary(m: PgMapping): string {
  const parts = [
    `series = ${(m.series_key ?? []).join(' + ') || '—'}`,
    `period = ${m.period?.column ?? '—'} (${frequencyText(m)})`,
    `value = ${m.value || '—'}`,
  ];
  if (m.target) parts.push(`target = ${m.target}`);
  if (m.dimension) parts.push(`dimension = ${m.dimension}${m.domestic_values?.length ? ` (main series: ${m.domestic_values.join(', ')})` : ''}`);
  const names = [m.name_en, m.name_ar].filter(Boolean);
  if (names.length) parts.push(`names = ${names.join(' / ')}`);
  if (m.unit) parts.push(`unit = ${valOrCol(m.unit)}`);
  if (m.source) parts.push(`source = ${valOrCol(m.source)}`);
  if (m.definition) parts.push(`definition = ${m.definition}`);
  let s = `Each row of ${m.table} is one value: ${parts.join(', ')}.`;
  if (m.filters?.length) s += ` Only rows where ${m.filters.map(filterText).join(' and ')}.`;
  return s;
}

/** The mapping as label/value rows (dataset page, review step). */
export function mappingRows(m: PgMapping): [string, string][] {
  const rows: [string, string][] = [
    ['Table', m.table],
    ['Series', (m.series_key ?? []).join(', ')],
    ['Period', `${m.period?.column ?? '—'} · ${m.period?.kind === 'date' ? 'date' : 'text (YYYY, YYYY-Qn, YYYY-MM)'}`],
    ['Frequency', frequencyText(m)],
    ['Value', m.value],
    ['Target', m.target || '—'],
    ['Dimension', m.dimension ? `${m.dimension}${m.domestic_values?.length ? ` · main series: ${m.domestic_values.join(', ')}` : ''}` : '—'],
    ['Names', [m.name_en && `${m.name_en} (EN)`, m.name_ar && `${m.name_ar} (AR)`].filter(Boolean).join(' · ') || '—'],
    ['Unit', valOrCol(m.unit) || '—'],
    ['Source', valOrCol(m.source) || '—'],
    ['Definition', m.definition || '—'],
    ['Filters', m.filters?.length ? m.filters.map(filterText).join(' and ') : 'None (every row)'],
    ['KAP ids', exampleId(m)],
  ];
  if (m.frequency && 'column' in m.frequency)
    rows.splice(4, 0, ['Frequency values', FREQS.map((f) => [f, freqMapText((m.frequency as { map: Record<string, PgFreq> }).map)[f]] as const).filter(([, t]) => t).map(([f, t]) => `${t} → ${f}`).join(' · ')]);
  return rows;
}

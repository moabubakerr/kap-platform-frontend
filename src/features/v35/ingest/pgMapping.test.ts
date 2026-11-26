import { describe, expect, it, vi } from 'vitest';
import type { FormField, FormValues } from '@/engine/dialogs';
import { PgApiError, type PgColumn, type PgDataset, type PgMapping, type PgSource } from '@/api/platformPg';
import {
  columnDefaults, columnKind, emptyMappingValues, exampleId, filtersOf, FREQ_COLUMN, FREQ_LABEL, freqMapText, KIND_AUTO, KIND_DATE, KIND_TEXT, mappingKey, mappingRows, mappingSummary, mappingValues, mappingWarnings, MODE_COLUMN, MODE_FIXED, namesFirst, NONE, OP_LABEL,
  parseFreqMap, periodKind, prefixOf, splitList, toMapping, validateMapStep,
} from './pgMapping';
import { datasetValues, PRESET_MAPPED, PRESET_SCAI, presetLabel, presetName, presetOf, toPgDatasetCreate, toPgDatasetPatch } from './pgView';
import { datasetSteps, pgDatasetWizard, type PgMappingDeps } from './pgWizards';

const COLS: PgColumn[] = [
  { name: 'region_code', type: 'character varying', nullable: false },
  { name: 'month', type: 'date', nullable: false },
  { name: 'revenue', type: 'numeric(14,2)', nullable: true },
  { name: 'revenue_target', type: 'double precision', nullable: true },
  { name: 'segment', type: 'text', nullable: true },
  { name: 'name_en', type: 'text', nullable: true },
  { name: 'name_ar', type: 'text', nullable: true },
  { name: 'unit', type: 'text', nullable: true },
  { name: 'is_final', type: 'boolean', nullable: false },
  { name: 'freq', type: 'text', nullable: true },
];
const T = 'public.monthly_sales';
const loaded = (v: FormValues, columns = COLS): FormValues => ({ ...v, _cols: { table: v.m_table, columns } });

/** A complete form for public.monthly_sales. */
function filled(extra: FormValues = {}): FormValues {
  return loaded({
    ...emptyMappingValues(),
    name: 'Monthly sales',
    m_table: T,
    m_series: ['region_code'],
    m_prefix: 'sales',
    m_period: 'month',
    m_freq: FREQ_LABEL.M,
    m_value: 'revenue',
    m_target: 'revenue_target',
    ...extra,
  });
}

const MAPPING: PgMapping = {
  table: T,
  series_key: ['region_code'],
  id_prefix: 'sales',
  period: { column: 'month', kind: 'date' },
  frequency: { column: 'freq', map: { yearly: 'A', annual: 'A', monthly: 'M' } },
  value: 'revenue',
  target: 'revenue_target',
  name_en: 'name_en',
  name_ar: null,
  unit: { value: 'QAR' },
  source: { column: 'segment' },
  definition: null,
  dimension: 'segment',
  domestic_values: ['National / Overall', 'Qatar'],
  filters: [{ column: 'is_final', op: 'is_true' }, { column: 'region_code', op: '!=', value: 'XX' }],
};

describe('column types', () => {
  it('reads PostgreSQL type names', () => {
    expect(['integer', 'bigint', 'numeric(12,2)', 'double precision', 'real', 'money'].map(columnKind)).toEqual(Array(6).fill('number'));
    expect(['date', 'timestamp without time zone', 'timestamp with time zone', 'timestamptz'].map(columnKind)).toEqual(Array(4).fill('date'));
    expect(columnKind('boolean')).toBe('bool');
    expect(['text', 'character varying', 'jsonb', '', null].map(columnKind)).toEqual(Array(5).fill('text'));
    expect(columnKind('interval')).toBe('text');
  });

  it('puts numeric columns first for the value', () => {
    expect(namesFirst(COLS, ['number']).slice(0, 3)).toEqual(['revenue', 'revenue_target', 'region_code']);
  });
});

describe('small parts', () => {
  it('makes an ID prefix from the dataset name', () => {
    expect(prefixOf('Monthly Sales')).toBe('monthly_sales');
    expect(prefixOf('  Ünïcode -- KPIs 2024! ')).toBe('n_code_kpis_2024');
    expect(prefixOf('x'.repeat(40))).toHaveLength(24);
    expect(prefixOf('a very long dataset name_ here')).toMatch(/^[a-z0-9_]{1,24}$/);
    expect(prefixOf('!!!')).toBe('dataset');
  });

  it('splits comma lists', () => {
    expect(splitList(' yearly, annual ,, yearly ')).toEqual(['yearly', 'annual']);
    expect(splitList(undefined)).toEqual([]);
  });

  it('parses the frequency map and finds clashes', () => {
    expect(parseFreqMap({ A: 'yearly, annual', Q: '', M: 'monthly' })).toEqual({ map: { yearly: 'A', annual: 'A', monthly: 'M' }, errors: [] });
    expect(parseFreqMap({ A: ' ', Q: '', M: '' }).errors[0]).toMatch(/Type the values/);
    expect(parseFreqMap({ A: 'Y', M: 'Y' }).errors[0]).toMatch(/“Y” is listed under both annual and monthly/);
    expect(freqMapText({ yearly: 'A', annual: 'A', monthly: 'M' })).toEqual({ A: 'yearly, annual', Q: '', M: 'monthly' });
    expect(freqMapText(null)).toEqual({ A: '', Q: '', M: '' });
  });

  it('resolves the period kind automatically from the column type', () => {
    expect(periodKind({ m_period: 'month', m_period_kind: KIND_AUTO }, COLS)).toBe('date');
    expect(periodKind({ m_period: 'freq', m_period_kind: KIND_AUTO }, COLS)).toBe('text');
    expect(periodKind({ m_period: 'month', m_period_kind: KIND_TEXT }, COLS)).toBe('text');
    expect(periodKind({ m_period: 'freq', m_period_kind: KIND_DATE }, COLS)).toBe('date');
  });
});

describe('form ⇄ mapping', () => {
  it('builds the minimal mapping and leaves optional parts out', () => {
    expect(toMapping(filled({ m_target: NONE }))).toEqual({ table: T, series_key: ['region_code'], id_prefix: 'sales', period: { column: 'month', kind: 'date' }, frequency: { value: 'M' }, value: 'revenue' });
  });

  it('defaults the ID prefix to the dataset name', () => {
    expect(toMapping(filled({ m_prefix: '' })).id_prefix).toBe('monthly_sales');
    expect(toMapping(filled({ m_prefix: '' }), 'Other name').id_prefix).toBe('other_name');
  });

  it('round-trips a full mapping through the form', () => {
    const v = loaded(mappingValues(MAPPING));
    expect(v).toMatchObject({ m_freq: FREQ_COLUMN, m_freq_A: 'yearly, annual', m_freq_M: 'monthly', m_unit: MODE_FIXED, m_unit_text: 'QAR', m_source: MODE_COLUMN, m_source_col: 'segment', m_name_ar: NONE, m_f1_op: OP_LABEL.is_true, m_f2_val: 'XX', m_period_kind: KIND_DATE });
    const m = toMapping(v);
    expect(mappingKey(m)).toBe(mappingKey(MAPPING));
    expect(m).not.toHaveProperty('name_ar');
    expect(m.domestic_values).toEqual(['National / Overall', 'Qatar']);
  });

  it('drops main-series values without a dimension and keeps filled filters only', () => {
    const m = toMapping(filled({ m_dimension: NONE, m_domestic: 'Qatar', m_f1_col: 'is_final', m_f1_op: OP_LABEL.is_false, m_f1_val: 'ignored', m_f2_col: '(no filter)' }));
    expect(m.domestic_values).toBeUndefined();
    expect(m.filters).toEqual([{ column: 'is_final', op: 'is_false' }]);
    expect(filtersOf({ m_f3_col: 'segment', m_f3_op: OP_LABEL['='], m_f3_val: 'retail' })).toEqual([{ column: 'segment', op: '=', value: 'retail' }]);
  });

  it('compares mappings regardless of key order, nulls and empty lists', () => {
    expect(mappingKey({ ...MAPPING, filters: [] })).toBe(mappingKey({ ...MAPPING, filters: null }));
    expect(mappingKey({ value: 'x', table: 't' } as PgMapping)).toBe(mappingKey({ table: 't', value: 'x', target: null } as PgMapping));
    expect(mappingKey({ ...MAPPING, value: 'other' })).not.toBe(mappingKey(MAPPING));
  });
});

describe('defaults from columns', () => {
  it('guesses series, period, value, target, names and unit for a new table', () => {
    const v = loaded({ ...emptyMappingValues(), m_table: T });
    expect(columnDefaults(v, COLS)).toMatchObject({ m_series: ['region_code'], m_period: 'month', m_value: 'revenue', m_target: 'revenue_target', m_name_en: 'name_en', m_name_ar: 'name_ar', m_unit: MODE_COLUMN, m_unit_col: 'unit', m_freq_col: 'freq' });
  });

  it('keeps valid choices and clears columns the new table does not have', () => {
    const v = filled({ m_value: 'amount', m_series: ['region_code', 'gone'], m_f1_col: 'gone' });
    const d = columnDefaults(v, COLS);
    expect(d.m_value).toBe('revenue');
    expect(d.m_series).toEqual(['region_code']);
    expect(d.m_f1_col).toBe('(no filter)');
    expect(d).not.toHaveProperty('m_period');
  });
});

describe('step checks', () => {
  it('waits for the columns of the table', () => {
    const v = { ...emptyMappingValues(), m_table: T };
    expect(validateMapStep('table', { ...v, m_table: '' }, [])).toBe('Choose a table.');
    expect(validateMapStep('table', { ...v, _cols: { table: T, loading: true } }, [])).toMatch(/^Loading the columns/);
    expect(validateMapStep('table', { ...v, _cols: { table: T, error: 'No table' } }, [])).toMatch(/No table$/);
    expect(validateMapStep('table', { ...v, _cols: { table: T, columns: [] } }, [])).toMatch(/no columns/);
    expect(validateMapStep('table', loaded(v), COLS)).toBe('');
  });

  it('checks series, prefix, period and the frequency map', () => {
    expect(validateMapStep('series', filled(), COLS)).toBe('');
    expect(validateMapStep('series', filled({ m_series: [] }), COLS)).toMatch(/at least one series column/);
    expect(validateMapStep('series', filled({ m_prefix: 'Sales!' }), COLS)).toMatch(/^ID prefix/);
    expect(validateMapStep('series', filled({ m_prefix: 'x'.repeat(25) }), COLS)).toMatch(/^ID prefix/);
    expect(validateMapStep('series', filled({ m_series: ['month'] }), COLS)).toMatch(/is the period/);
    expect(validateMapStep('series', filled({ m_freq: FREQ_COLUMN, m_freq_col: '' }), COLS)).toMatch(/frequency/);
    expect(validateMapStep('series', filled({ m_freq: FREQ_COLUMN, m_freq_col: 'freq' }), COLS)).toMatch(/Type the values/);
    expect(validateMapStep('series', filled({ m_freq: FREQ_COLUMN, m_freq_col: 'freq', m_freq_A: 'yearly' }), COLS)).toBe('');
  });

  it('checks values, labels and filters', () => {
    expect(validateMapStep('values', filled({ m_value: '' }), COLS)).toBe('Choose the value column.');
    expect(validateMapStep('values', filled({ m_target: 'revenue' }), COLS)).toMatch(/another column/);
    expect(validateMapStep('values', filled({ m_dimension: 'region_code' }), COLS)).toMatch(/series column/);
    expect(validateMapStep('labels', filled({ m_unit: MODE_FIXED, m_unit_text: ' ' }), COLS)).toMatch(/^Unit: type the fixed text/);
    expect(validateMapStep('labels', filled({ m_source: MODE_COLUMN, m_source_col: '' }), COLS)).toMatch(/^Source: choose the column/);
    expect(validateMapStep('filters', filled({ m_f1_col: 'segment', m_f1_op: OP_LABEL['='], m_f1_val: '' }), COLS)).toMatch(/^Filter 1: type the value/);
    expect(validateMapStep('filters', filled({ m_f1_col: 'is_final', m_f1_op: OP_LABEL.is_true }), COLS)).toBe('');
  });

  it('warns from the column types without blocking', () => {
    expect(mappingWarnings('values', filled({ m_value: 'segment' }), COLS).join(' ')).toMatch(/segment is text, not a number/);
    expect(mappingWarnings('values', filled(), COLS)).toEqual([]);
    expect(mappingWarnings('values', filled({ m_dimension: 'segment', m_domestic: '' }), COLS).join(' ')).toMatch(/No main-series values/);
    expect(mappingWarnings('series', filled({ m_period: 'segment', m_period_kind: KIND_DATE }), COLS).join(' ')).toMatch(/not a date/);
    expect(mappingWarnings('series', filled({ m_period_kind: KIND_TEXT }), COLS).join(' ')).toMatch(/is a date column/);
    expect(mappingWarnings('filters', filled({ m_f1_col: 'segment', m_f1_op: OP_LABEL.is_true }), COLS).join(' ')).toMatch(/not true\/false/);
  });
});

describe('summary', () => {
  it('says what each row is, in one sentence', () => {
    const m = toMapping(filled());
    expect(mappingSummary(m)).toBe('Each row of public.monthly_sales is one value: series = region_code, period = month (monthly), value = revenue, target = revenue_target.');
    const s = mappingSummary(MAPPING);
    expect(s).toContain('period = month (frequency from freq)');
    expect(s).toContain('dimension = segment (main series: National / Overall, Qatar)');
    expect(s).toContain('unit = “QAR”, source = column segment');
    expect(s).toContain("Only rows where is_final is true and region_code != 'XX'.");
  });

  it('shows example ids and readable rows', () => {
    expect(exampleId(toMapping(filled()))).toBe('sales.<region_code>.m.overall');
    expect(exampleId(MAPPING)).toBe('sales.<region_code>.<a|q|m>.<overall|segment>');
    const rows = Object.fromEntries(mappingRows(MAPPING));
    expect(rows['Frequency values']).toBe('yearly, annual → A · monthly → M');
    expect(rows.Filters).toBe("is_final is true and region_code != 'XX'");
    expect(rows.Names).toBe('name_en (EN)');
  });
});

// ------------------------------------------------------------------ dataset form and wizard
const SRC: PgSource = { id: 's1', name: 'sales_db', host: 'h', port: 5432, database: 'sales', username: 'ro', sslmode: 'disable', password_set: true, last_test: null, created_at: '', updated_at: '' };
const DS: PgDataset = {
  id: 'd1', source_id: 's1', source_name: 'sales_db', name: 'Monthly sales', preset: 'mapped', queries: null, mapping: MAPPING, published_only: false, collection_name: 'sales_ind', schedule_minutes: null, next_run_at: null, kap: null, last_run: null, created_at: '', updated_at: '',
};

describe('mapped datasets', () => {
  it('has a third preset', () => {
    expect([presetOf(PRESET_MAPPED), presetLabel('mapped'), presetName('mapped')]).toEqual(['mapped', PRESET_MAPPED, 'Column mapping']);
  });

  it('creates with the mapping and patches it only when it changed', () => {
    const v = { ...datasetValues(null), ...filled(), preset: PRESET_MAPPED, collection: 'sales_ind', schedule: 'Manual only' };
    const body = toPgDatasetCreate(v, 's1');
    expect(body).toMatchObject({ preset: 'mapped', mapping: { table: T, frequency: { value: 'M' } } });
    expect(body).not.toHaveProperty('published_only');
    expect(toPgDatasetPatch(DS, datasetValues(DS))).toBeNull();
    expect(toPgDatasetPatch(DS, { ...datasetValues(DS), m_value: 'revenue_target', m_target: NONE })?.mapping).toMatchObject({ value: 'revenue_target' });
    expect(toPgDatasetPatch({ ...DS, preset: 'custom', mapping: null }, datasetValues(DS))).toMatchObject({ preset: 'mapped', mapping: { table: T } });
  });
});

describe('dataset wizard with column mapping', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const deps = (over: Partial<PgMappingDeps> = {}): PgMappingDeps => ({
    tables: () => [{ schema: 'public', name: 'monthly_sales', rows_estimate: 1200 }],
    test: vi.fn(async () => ''),
    columns: vi.fn(async (table: string) => ({ table, columns: COLS })),
    preview: vi.fn(async () => ({ files: { registry: { columns: ['indicator_id', 'name_en'], rows: [['sales.doha.m.overall', 'Doha']], count: 4 }, observations: { columns: ['indicator_id', 'value'], rows: [['sales.doha.m.overall', 12]], count: 48 } }, problems: ['2 rows have no value'], queries: { registry: 'SELECT 1', observations: 'SELECT 2' } })),
    ...over,
  });
  const ctx = { names: [], collections: [], edit: false };
  const labels = (f: FormField[]) => f.map((x) => ('label' in x ? x.label : '')).filter(Boolean);

  it('adds the mapping steps only for Map columns', () => {
    expect(datasetSteps(PRESET_SCAI)).toEqual(['General', 'Data', 'Target collection', 'Schedule', 'Review']);
    expect(datasetSteps(PRESET_MAPPED)).toEqual(['General', 'Data', 'Table', 'Series & period', 'Values', 'Labels', 'Filters', 'Preview', 'Target collection', 'Schedule', 'Review']);
    const w = pgDatasetWizard({ ds: null, source: SRC, check: ctx, finish: async () => '', mapping: deps() });
    expect(w.steps).toHaveLength(5);
    const v = { ...w.initial, preset: PRESET_MAPPED };
    w.fields(1, v, () => {});
    expect(w.steps).toHaveLength(11);
  });

  it('loads the columns, applies defaults, previews and finishes', async () => {
    const d = deps();
    const fin = vi.fn(async (_v: FormValues) => '');
    const w = pgDatasetWizard({ ds: null, source: SRC, check: ctx, finish: fin, mapping: d });
    const v: FormValues = { ...w.initial, name: 'Monthly sales', preset: PRESET_MAPPED, collection: 'sales_ind' };
    const set = (k: string, val: any) => {
      v[k] = val;
    };
    // Table: the first known table is chosen and its columns load
    w.fields(2, v, set);
    expect(v.m_table).toBe(T);
    expect(w.validate(2, v, set)).toMatch(/^Loading the columns/);
    await flush();
    expect(d.columns).toHaveBeenCalledTimes(1);
    expect(labels(w.fields(2, v, set))).toContain(`Columns of ${T} (${COLS.length})`);
    expect(w.validate(2, v, set)).toBe('');
    expect(v).toMatchObject({ m_series: ['region_code'], m_period: 'month', m_value: 'revenue', m_prefix: 'monthly_sales' });
    // the user's later "(none)" is not overwritten by a second pass
    v.m_target = NONE;
    w.validate(2, v, set);
    expect(v.m_target).toBe(NONE);
    // Series & period, frequency from a column
    v.m_freq = FREQ_COLUMN;
    expect(labels(w.fields(3, v, set))).toContain('Values meaning annual (A)');
    expect(w.validate(3, v, set)).toMatch(/Type the values/);
    v.m_freq_M = 'monthly';
    expect(w.validate(3, v, set)).toBe('');
    // Values: a text value column is a warning, not an error
    v.m_value = 'segment';
    expect(JSON.stringify(w.fields(4, v, set))).toContain('segment is text, not a number');
    v.m_value = 'revenue';
    for (const s of [4, 5, 6]) {
      w.fields(s, v, set);
      expect(w.validate(s, v, set)).toBe('');
    }
    // Preview
    w.fields(7, v, set);
    expect(w.validate(7, v, set)).toMatch(/still running/);
    await flush();
    const pv = JSON.stringify(w.fields(7, v, set));
    expect(pv).toContain('48 rows');
    expect(pv).toContain('sales.doha.m.overall');
    expect(pv).toContain('2 rows have no value');
    expect(w.validate(7, v, set)).toBe('');
    expect(d.preview).toHaveBeenCalledWith(expect.objectContaining({ table: T, frequency: { column: 'freq', map: { monthly: 'M' } } }));
    // Review and finish
    expect(JSON.stringify(w.fields(10, v, set))).toContain('Each row of public.monthly_sales is one value');
    expect(await w.finish({ ...v })).toBe('');
    const sent = toPgDatasetCreate(fin.mock.calls[0][0], 's1');
    expect(sent.mapping).toMatchObject({ table: T, series_key: ['region_code'], period: { column: 'month', kind: 'date' }, value: 'revenue' });
  });

  it('blocks on a failed preview, but not when the platform has no preview yet', async () => {
    const v: FormValues = { ...datasetValues(DS), preset: PRESET_MAPPED };
    const set = (k: string, val: any) => {
      v[k] = val;
    };
    const failing = pgDatasetWizard({ ds: DS, source: SRC, check: { ...ctx, edit: true }, finish: async () => '', mapping: deps({ preview: async () => Promise.reject(new PgApiError(422, 'invalid', 'Column freq does not exist')) }) });
    failing.fields(2, v, set);
    await flush();
    failing.fields(7, v, set);
    await flush();
    expect(failing.validate(7, v, set)).toMatch(/^The preview failed: Column freq does not exist/);
    const missing = pgDatasetWizard({ ds: DS, source: SRC, check: { ...ctx, edit: true }, finish: async () => '', mapping: deps({ preview: async () => Promise.reject(new PgApiError(404, 'error', 'no route', {}, true)) }) });
    missing.fields(2, v, set);
    missing.fields(7, v, set);
    await flush();
    expect(missing.validate(7, v, set)).toBe('');
  });

  it('prefills the wizard when editing and offers a connection test without known tables', () => {
    const w = pgDatasetWizard({ ds: DS, source: SRC, check: { ...ctx, edit: true }, finish: async () => '', mapping: deps({ tables: () => null }) });
    expect(w.initial).toMatchObject({ preset: PRESET_MAPPED, m_table: T, m_freq: FREQ_COLUMN, m_domestic: 'National / Overall, Qatar' });
    const f = w.fields(2, { ...w.initial }, () => {});
    expect(f.some((x) => x.type === 'button' && x.label === 'Test connection')).toBe(true);
    const fresh = pgDatasetWizard({ ds: null, source: SRC, check: ctx, finish: async () => '', mapping: deps({ tables: () => null }) });
    const nf = fresh.fields(2, { ...fresh.initial, preset: PRESET_MAPPED }, () => {});
    expect(nf.map((x) => x.type)).toEqual(['note', 'button']);
  });
});

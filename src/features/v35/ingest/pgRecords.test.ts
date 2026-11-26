import { describe, expect, it, vi } from 'vitest';
import type { FormField, FormValues } from '@/engine/dialogs';
import { PgApiError, type ExportRun, type PgColumn, type PgDataset, type PgRecords, type PgSource } from '@/api/platformPg';
import { NONE, OP_LABEL } from './pgMapping';
import {
  agentCta, cardExcerpt, defaultTitle, emptyRecordsValues, exampleTitle, fieldKey, humanise, idOptions, isLongText, isRecordsRun, LANG_LABEL, LANG_NONE, looksUnique, ORDER_ASC, ORDER_DESC, parseCard, placeholders, recordCountRows, recordCountsText, recordDefaults,
  recordsKey, recordsRows, recordsSummary, recordsValues, recordWarnings, sectionKey, sectionOptions, singular, titleProblems, toRecords, validateRecordStep,
} from './pgRecords';
import { countsText, datasetValues, exportSteps, PRESET_RECORDS, presetLabel, presetName, presetOf, toPgDatasetCreate, toPgDatasetPatch } from './pgView';
import { datasetSteps, pgDatasetWizard, type PgMappingDeps } from './pgWizards';

const T = 'public.tickets';
const COLS: PgColumn[] = [
  { name: 'ticket_id', type: 'integer', nullable: false },
  { name: 'subject', type: 'character varying(200)', nullable: false },
  { name: 'status', type: 'text', nullable: false },
  { name: 'priority', type: 'character varying', nullable: true },
  { name: 'customer_name', type: 'character varying(120)', nullable: true },
  { name: 'created_at', type: 'timestamp with time zone', nullable: false },
  { name: 'updated_at', type: 'timestamp with time zone', nullable: true },
  { name: 'description', type: 'text', nullable: true },
  { name: 'resolution_notes', type: 'text', nullable: true },
  { name: 'is_public', type: 'boolean', nullable: false },
];
const loaded = (v: FormValues, columns = COLS): FormValues => ({ ...v, _cols: { table: v.m_table, columns } });

const RECORDS: PgRecords = {
  table: T,
  id_column: 'ticket_id',
  title: 'Ticket {ticket_id}: {subject}',
  fields: [
    { column: 'status', label: 'Status' },
    { column: 'priority', label: 'Priority' },
    { column: 'customer_name', label: 'Customer' },
    { column: 'created_at', label: 'Created at' },
  ],
  sections: [
    { column: 'description', label: 'Description' },
    { column: 'resolution_notes', label: 'Resolution' },
  ],
  filters: [{ column: 'is_public', op: 'is_true' }],
  order_by: { column: 'updated_at', desc: true },
  max_records: 5000,
  language: 'en',
};

const SRC: PgSource = { id: 's1', name: 'helpdesk_db', host: 'h', port: 5432, database: 'helpdesk', username: 'ro', sslmode: 'disable', password_set: true, last_test: null, created_at: '', updated_at: '' };
const DS: PgDataset = {
  id: 'd1', source_id: 's1', source_name: 'helpdesk_db', name: 'Support tickets', preset: 'records', queries: null, mapping: null, records: RECORDS, published_only: false, collection_name: 'support_tickets', schedule_minutes: null, next_run_at: null, kap: null, last_run: null, created_at: '', updated_at: '',
};

describe('words', () => {
  it('humanises column names', () => {
    expect(['ticket_id', 'createdAt', 'customer_name', 'SLA_due', 'faq_url', ''].map(humanise)).toEqual(['Ticket ID', 'Created at', 'Customer name', 'SLA due', 'FAQ URL', '']);
  });

  it('makes a table name singular', () => {
    expect(['tickets', 'categories', 'addresses', 'status', 'faq', 'boxes'].map(singular)).toEqual(['ticket', 'category', 'address', 'status', 'faq', 'box']);
  });
});

describe('column choices', () => {
  it('spots long text and unique-looking IDs', () => {
    expect(['text', 'jsonb', 'character varying(2000)', 'character varying(200)', 'character varying', 'integer'].map(isLongText)).toEqual([true, true, true, false, false, false]);
    expect(looksUnique(COLS[0])).toBe(true);
    expect(looksUnique({ name: 'ticket_id', type: 'integer', nullable: true })).toBe(false);
    expect(looksUnique({ name: 'status', type: 'text', nullable: false })).toBe(false);
    expect(looksUnique({ name: 'ref', type: 'uuid', nullable: false })).toBe(true);
    expect(idOptions(COLS)[0]).toBe('ticket_id');
  });

  it('lists long text first for sections', () => {
    expect(sectionOptions(COLS).slice(0, 3)).toEqual(['description', 'resolution_notes', 'subject']);
    expect(sectionOptions(COLS).slice(-3)).toEqual(['created_at', 'updated_at', 'is_public']);
  });

  it('guesses the ID, title, fields, sections and order from the columns', () => {
    const v = { ...emptyRecordsValues(), m_table: T };
    const d = recordDefaults(v, COLS);
    expect(d.r_id).toBe('ticket_id');
    expect(d.r_title).toBe('Ticket {ticket_id}: {subject}');
    expect(d.r_sections).toEqual(['description', 'resolution_notes']);
    expect(d.r_fields).toEqual(['status', 'priority', 'customer_name', 'created_at', 'updated_at', 'is_public']);
    expect(d[fieldKey('customer_name')]).toBe('Customer name');
    expect(d[sectionKey('resolution_notes')]).toBe('Resolution notes');
    expect(d).toMatchObject({ r_order: 'updated_at', r_order_dir: ORDER_DESC });
  });

  it('keeps choices that are columns and drops the others', () => {
    const v = { ...emptyRecordsValues(), m_table: T, r_id: 'subject', r_title: 'Case {subject}', r_fields: ['status', 'gone'], r_sections: ['description'], r_order: 'gone', m_f1_col: 'gone' };
    const d = recordDefaults(v, COLS);
    expect(d.r_id).toBeUndefined();
    expect(d.r_title).toBeUndefined();
    expect(d.r_fields).toEqual(['status']);
    expect(d.r_sections).toBeUndefined();
    expect(d.r_order).toBe(NONE);
    expect(d.m_f1_col).toBe('(no filter)');
  });

  it('makes a default title from the table name', () => {
    expect(defaultTitle('public.contracts', 'contract_no')).toBe('Contract {contract_no}');
    expect(defaultTitle('', 'id')).toBe('Record {id}');
  });
});

describe('title template', () => {
  it('reads and checks placeholders against the columns', () => {
    expect(placeholders('Ticket {ticket_id}: {subject} ({ticket_id})')).toEqual(['ticket_id', 'subject']);
    expect(titleProblems('Ticket {ticket_id}', COLS)).toEqual([]);
    expect(titleProblems('', COLS)[0]).toMatch(/Type a title/);
    expect(titleProblems('Ticket {ticket_id', COLS)[0]).toMatch(/matching }/);
    expect(titleProblems('Ticket {{ticket_id}}', COLS)[0]).toMatch(/nested/);
    expect(titleProblems('Ticket {}', COLS)[0]).toMatch(/empty/);
    expect(titleProblems('Ticket {id} {nope}', COLS)[0]).toBe('Title: {id}, {nope} are not columns of the table.');
  });

  it('shows a live example with stand-ins per column type', () => {
    expect(exampleTitle('Ticket {ticket_id}: {subject} ({created_at})', COLS)).toBe('Ticket 1042: ‹subject› (2024-05-01)');
    expect(exampleTitle('Ticket {nope}', COLS)).toBe('Ticket {nope}');
  });
});

describe('form ⇄ records', () => {
  it('round-trips a stored setting', () => {
    const v = recordsValues(RECORDS);
    expect(v).toMatchObject({ m_table: T, r_id: 'ticket_id', r_order: 'updated_at', r_order_dir: ORDER_DESC, r_max: '5000', r_lang: LANG_LABEL.en, m_f1_col: 'is_public', m_f1_op: OP_LABEL.is_true });
    expect(v[sectionKey('resolution_notes')]).toBe('Resolution');
    expect(toRecords(v)).toEqual(RECORDS);
    expect(recordsKey(toRecords(v))).toBe(recordsKey(RECORDS));
  });

  it('leaves out optional parts and defaults labels and size', () => {
    const v = { ...emptyRecordsValues(), m_table: T, r_id: 'ticket_id', r_title: ' Ticket {ticket_id} ', r_fields: ['status'], r_sections: ['description'], r_max: '', r_lang: LANG_NONE, r_order: NONE };
    expect(toRecords(v)).toEqual({ table: T, id_column: 'ticket_id', title: 'Ticket {ticket_id}', fields: [{ column: 'status', label: 'Status' }], sections: [{ column: 'description', label: 'Description' }], max_records: 5000 });
    expect(toRecords({ ...v, r_order: 'created_at', r_order_dir: ORDER_ASC, r_max: '12,000' })).toMatchObject({ order_by: { column: 'created_at', desc: false }, max_records: 12000 });
  });
});

describe('step checks', () => {
  const base = () => loaded({ ...recordsValues(RECORDS) });

  it('checks the table step like the column mapping', () => {
    expect(validateRecordStep('table', { m_table: '' }, [])).toBe('Choose a table.');
    expect(validateRecordStep('table', base(), COLS)).toBe('');
  });

  it('checks the record step', () => {
    expect(validateRecordStep('record', base(), COLS)).toBe('');
    expect(validateRecordStep('record', { ...base(), r_id: '' }, COLS)).toMatch(/Choose the ID column/);
    expect(validateRecordStep('record', { ...base(), r_title: 'Ticket {nope}' }, COLS)).toMatch(/not a column/);
    expect(validateRecordStep('record', { ...base(), r_order: 'nope' }, COLS)).toMatch(/Order by/);
  });

  it('checks the content step', () => {
    expect(validateRecordStep('content', base(), COLS)).toBe('');
    expect(validateRecordStep('content', { ...base(), r_fields: [], r_sections: [] }, COLS)).toMatch(/at least one field or section/);
    expect(validateRecordStep('content', { ...base(), r_fields: ['status', 'description'] }, COLS)).toMatch(/both a field and a section/);
    expect(validateRecordStep('content', { ...base(), [fieldKey('priority')]: 'status' }, COLS)).toMatch(/Two parts have the label “status”/);
  });

  it('checks filters and the size', () => {
    expect(validateRecordStep('filters', base(), COLS)).toBe('');
    expect(validateRecordStep('filters', { ...base(), r_max: '60000' }, COLS)).toMatch(/1 to 50,000/);
    expect(validateRecordStep('filters', { ...base(), r_max: '0' }, COLS)).toMatch(/whole number/);
    expect(validateRecordStep('filters', { ...base(), m_f1_col: 'status', m_f1_op: OP_LABEL['='], m_f1_val: '' }, COLS)).toMatch(/Filter 1/);
  });

  it('warns without blocking', () => {
    expect(recordWarnings('record', { ...base(), r_id: 'priority' }, COLS)[0]).toMatch(/priority does not look unique \(it may be empty\)/);
    expect(recordWarnings('record', { ...base(), r_title: 'Ticket' }, COLS)[0]).toMatch(/same title/);
    expect(recordWarnings('content', { ...base(), r_sections: ['created_at'], r_fields: ['description'] }, COLS)).toEqual([
      'created_at is not text: a short value reads better as a field.',
      'description may hold long text: long text reads better as a section.',
    ]);
    expect(recordWarnings('filters', { ...base(), r_max: '20000' }, COLS)[0]).toMatch(/hours/);
  });
});

describe('summary and cards', () => {
  it('describes the setting in words and rows', () => {
    expect(recordsSummary({ ...RECORDS, title: 'Ticket {ticket_id}', filters: null, order_by: null })).toBe(
      "Each row of public.tickets becomes a document titled 'Ticket {ticket_id}' with 4 fields and 2 sections; up to 5,000 records.",
    );
    expect(recordsSummary(RECORDS)).toContain('Only rows where is_public is true. Newest first by updated_at.');
    const rows = Object.fromEntries(recordsRows(RECORDS));
    expect(rows.Fields).toBe('Status, Priority, Customer (customer_name), Created at');
    expect(rows.Sections).toBe('Description, Resolution (resolution_notes)');
    expect(rows['Max records']).toBe('5,000');
  });

  it('splits a card back into fields and sections', () => {
    const text = 'Ticket 1042: Printer jam\n\nStatus: open\nCustomer: Acme\nUnknown: x\n\n## Description\nThe printer jams.\nEvery morning.\n\nResolution:\nReplaced the roller.';
    const c = parseCard({ title: 'Ticket 1042: Printer jam', text }, RECORDS);
    expect(c.fields).toEqual([['Status', 'open'], ['Customer', 'Acme']]);
    expect(c.sections).toEqual([{ label: 'Description', body: 'The printer jams.\nEvery morning.' }, { label: 'Resolution', body: 'Replaced the roller.' }]);
    expect(c.rest).toBe('Unknown: x');
    expect(parseCard({ title: 't', text: 'just text' }, null)).toMatchObject({ fields: [], sections: [], rest: 'just text' });
  });

  it('shortens a card for a dialog note', () => {
    expect(cardExcerpt('a\r\n\n\n\nb')).toBe('a\n\nb');
    expect(cardExcerpt('word '.repeat(300), 20)).toBe('word word word word …');
  });
});

describe('runs', () => {
  const C = { documents: 1204, new: 12, changed: 3, removed: 1, unchanged: 1188 };

  it('shows the document counts', () => {
    expect(recordCountsText(C)).toBe('1,204 documents · 12 new · 3 changed · 1 removed · 1,188 unchanged');
    expect(countsText(C)).toBe(recordCountsText(C));
    expect(recordCountsText(null)).toBe('—');
    expect(recordCountRows({ documents: 5 }).map((r) => [r.label, r.value])).toEqual([['Documents', 5], ['New', null], ['Changed', null], ['Removed', null], ['Unchanged', null]]);
    expect(isRecordsRun({ counts: C })).toBe(true);
    expect(isRecordsRun({ counts: null }, DS)).toBe(true);
    expect(isRecordsRun({ counts: { registry: 1 } })).toBe(false);
  });

  it('keeps the five steps and says KAP summarises records', () => {
    const run = { status: 'waiting_for_kap' as const, kap: null, steps: [{ key: 'kap_load', title: '', state: 'running' as const, detail: null, started_at: null, finished_at: null }] };
    const s = exportSteps(run, Date.now(), true);
    expect(s.map((x) => x.key)).toEqual(['read', 'write', 'upload', 'kap_scan', 'kap_load']);
    expect(s[1].title).toBe('Write the record documents');
    expect(s[4].detail).toMatch(/summarises each new or changed record/);
    expect(exportSteps(run, Date.now())[1].title).toBe('Write the indicator files');
  });

  it('offers an agent after a successful run only', () => {
    const runs: Pick<ExportRun, 'dataset_id' | 'status'>[] = [{ dataset_id: 'd1', status: 'failed' }];
    expect(agentCta(DS, runs)).toBeNull();
    expect(agentCta({ ...DS, preset: 'mapped' }, [{ dataset_id: 'd1', status: 'succeeded' }])).toBeNull();
    const cta = agentCta({ ...DS, kap: { connector: 'support_tickets_pg', pipeline: 'support_tickets_pipeline', collection: 'support_tickets', collection_id: 'c1', pipeline_id: 'p1', provisioned_at: '2026-01-01' } }, [{ dataset_id: 'd1', status: 'succeeded' }]);
    expect(cta?.text).toBe('Create an agent that searches support_tickets');
    expect(cta?.how).toMatch(/hybrid_search/);
  });
});

describe('records datasets', () => {
  it('has a fourth preset', () => {
    expect([presetOf(PRESET_RECORDS), presetLabel('records'), presetName('records')]).toEqual(['records', PRESET_RECORDS, 'Records as documents']);
  });

  it('creates with the records and patches them only when they changed', () => {
    const v = { ...datasetValues(null), ...recordsValues(RECORDS), name: 'Support tickets', preset: PRESET_RECORDS, collection: 'support_tickets', schedule: 'Manual only' };
    const body = toPgDatasetCreate(v, 's1');
    expect(body).toMatchObject({ preset: 'records', records: RECORDS, collection_name: 'support_tickets' });
    expect(body).not.toHaveProperty('mapping');
    expect(body).not.toHaveProperty('published_only');
    expect(toPgDatasetPatch(DS, datasetValues(DS))).toBeNull();
    expect(toPgDatasetPatch(DS, { ...datasetValues(DS), r_max: '100' })?.records).toMatchObject({ max_records: 100 });
    expect(toPgDatasetPatch({ ...DS, preset: 'mapped', records: null }, datasetValues(DS))).toMatchObject({ preset: 'records', records: { table: T } });
  });
});

describe('dataset wizard with records', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const PREVIEW = {
    documents: { count: 812, sample: [{ key: 'ticket-1042', title: 'Ticket 1042: Printer jam', text: 'Ticket 1042: Printer jam\nStatus: open\n\nDescription\nThe printer jams.' }] },
    problems: ['3 rows have an empty ticket_id'],
    query: 'SELECT …',
  };
  const deps = (over: Partial<PgMappingDeps> = {}): PgMappingDeps => ({
    tables: () => [{ schema: 'public', name: 'tickets', rows_estimate: 900 }],
    test: vi.fn(async () => ''),
    columns: vi.fn(async (table: string) => ({ table, columns: COLS })),
    preview: vi.fn(async () => Promise.reject(new Error('not used'))),
    recordsPreview: vi.fn(async () => PREVIEW),
    ...over,
  });
  const ctx = { names: [], collections: [], edit: false };
  const labels = (f: FormField[]) => f.map((x) => ('label' in x ? x.label : '')).filter(Boolean);

  it('adds the records steps', () => {
    expect(datasetSteps(PRESET_RECORDS)).toEqual(['General', 'Data', 'Table', 'Record', 'Content', 'Filters & size', 'Target collection', 'Schedule', 'Preview', 'Review']);
    const w = pgDatasetWizard({ ds: null, source: SRC, check: ctx, finish: async () => '', mapping: deps() });
    const f = w.fields(1, { ...w.initial, preset: PRESET_RECORDS }, () => {});
    expect(w.steps).toHaveLength(10);
    expect(JSON.stringify(f)).toContain('Each row becomes a document agents can search — for tickets, contracts, products…');
  });

  it('loads the columns, applies defaults, previews and finishes', async () => {
    const d = deps();
    const fin = vi.fn(async (_v: FormValues) => '');
    const w = pgDatasetWizard({ ds: null, source: SRC, check: ctx, finish: fin, mapping: d });
    const v: FormValues = { ...w.initial, name: 'Support tickets', preset: PRESET_RECORDS, collection: 'support_tickets' };
    const set = (k: string, val: any) => {
      v[k] = val;
    };
    w.fields(2, v, set);
    expect(v.m_table).toBe(T);
    expect(w.validate(2, v, set)).toMatch(/^Loading the columns/);
    await flush();
    expect(w.validate(2, v, set)).toBe('');
    expect(v).toMatchObject({ r_id: 'ticket_id', r_title: 'Ticket {ticket_id}: {subject}', r_sections: ['description', 'resolution_notes'], r_order: 'updated_at' });
    // Record: a live example of the title
    expect(JSON.stringify(w.fields(3, v, set))).toContain('Example: Ticket 1042: ‹subject›');
    v.r_id = 'priority';
    expect(JSON.stringify(w.fields(3, v, set))).toContain('does not look unique');
    v.r_id = 'ticket_id';
    expect(w.validate(3, v, set)).toBe('');
    // Content: a new chip gets a humanised label field
    v.r_fields = ['status', 'customer_name'];
    expect(labels(w.fields(4, v, set))).toContain('Field label · customer_name');
    expect(v[fieldKey('customer_name')]).toBe('Customer name');
    expect(w.validate(4, v, set)).toBe('');
    // Filters & size: the cost note
    const ff = JSON.stringify(w.fields(5, v, set));
    expect(ff).toContain('KAP summarises every new or changed record');
    expect(w.validate(5, v, set)).toBe('');
    // Target collection: a document collection
    expect(JSON.stringify(w.fields(6, v, set))).toContain('document collection support_tickets, searchable by agents with hybrid_search');
    expect(w.validate(6, v, set)).toBe('');
    w.fields(7, v, set);
    // Preview
    w.fields(8, v, set);
    expect(w.validate(8, v, set)).toMatch(/still running/);
    await flush();
    const pv = JSON.stringify(w.fields(8, v, set));
    expect(pv).toContain('812 documents');
    expect(pv).toContain('3 rows have an empty ticket_id');
    expect(pv).toContain('Document 1 · Ticket 1042: Printer jam');
    expect(w.validate(8, v, set)).toBe('');
    expect(d.recordsPreview).toHaveBeenCalledWith(expect.objectContaining({ table: T, id_column: 'ticket_id' }), 'Support tickets');
    // Review and finish
    expect(JSON.stringify(w.fields(9, v, set))).toContain('Each row of public.tickets becomes a document titled');
    expect(await w.finish({ ...v })).toBe('');
    const sent = toPgDatasetCreate(fin.mock.calls[0][0], 's1');
    expect(sent.records).toMatchObject({ table: T, id_column: 'ticket_id', fields: [{ column: 'status', label: 'Status' }, { column: 'customer_name', label: 'Customer name' }] });
  });

  it('blocks on a failed preview, but not when the platform has no preview yet', async () => {
    const run = async (over: Partial<PgMappingDeps>) => {
      const v: FormValues = { ...datasetValues(DS) };
      const set = (k: string, val: any) => {
        v[k] = val;
      };
      const w = pgDatasetWizard({ ds: DS, source: SRC, check: { ...ctx, edit: true }, finish: async () => '', mapping: deps(over) });
      expect(w.initial).toMatchObject({ preset: PRESET_RECORDS, m_table: T, r_id: 'ticket_id' });
      w.fields(2, v, set);
      await flush();
      w.fields(8, v, set);
      await flush();
      return w.validate(8, v, set);
    };
    expect(await run({ recordsPreview: async () => Promise.reject(new PgApiError(422, 'invalid', 'Column subject does not exist')) })).toMatch(/^The preview failed: Column subject does not exist/);
    expect(await run({ recordsPreview: async () => Promise.reject(new PgApiError(404, 'error', 'no route', {}, true)) })).toBe('');
    expect(await run({ recordsPreview: undefined })).toMatch(/not available/);
  });
});

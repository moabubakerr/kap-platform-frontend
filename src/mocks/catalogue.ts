// Ask AI indicator catalogue (README §8.5) and indicator observations (§8.7).
// Copy and numbers follow design-ref/app.js (`cat`, `ci`, `SER`, `indList`,
// `catVers`, `pub*`). Field names loosely mirror the Ask AI ETL schema
// (indicators / indicator_details / published_data_points).

export type CatStatus = 'approved' | 'hold' | 'retired';
export type Frequency = 'Quarterly' | 'Monthly' | 'Annual';

export interface IndicatorSeries {
  /** Short period labels as drawn on the chart ('Q4 24', 'Jan 19', '2019'). */
  labels: string[];
  actual: number[];
  /** null = no target defined for this indicator. */
  target: number[] | null;
  /** Suffix used when formatting values ('%', ' days'). */
  suffix: string;
  decimals: number;
  /** Source file and the row of the first observation in `labels`. */
  file: string;
  row: number;
}

export interface QualityNote {
  tone: 'warning' | 'info';
  title: string;
  detail: string;
}

export interface Indicator {
  code: string; // external id, e.g. IND-TOU-014
  nameEn: string;
  nameAr: string;
  frequency: Frequency;
  granularity: 'quarterly' | 'monthly' | 'yearly';
  coverage: string;
  periods: string;
  unit: string; // unit_en
  polarity: 'Increase' | 'Decrease';
  dataSource: string; // data_source_en
  aliasesEn: string[];
  aliasesAr: string[];
  status: CatStatus;
  statusLabel: string;
  /** Shown in the catalogue table (false = only in the Indicators DB). */
  inCatalogue: boolean;
  questions7d: number;
  direct: number; // % resolved directly
  picker: number; // % via Indicator Picker
  series: IndicatorSeries;
  quality: QualityNote[];
}

export const CATALOGUE_COUNT = 214;
export const INDICATOR_COUNT = 186;
export const CURRENT_VERSION = 'v2026.11.3';
export const NEXT_VERSION = 'v2026.11.4';

const QTRS = ['Q1 23', 'Q2 23', 'Q3 23', 'Q4 23', 'Q1 24', 'Q2 24', 'Q3 24', 'Q4 24'];
const PSA = 'Planning and Statistics Authority';

export const INDICATORS: Indicator[] = [
  {
    code: 'IND-TOU-014',
    nameEn: 'Sector Contribution to GDP (Tourism)',
    nameAr: 'مساهمة قطاع السياحة في الناتج المحلي',
    frequency: 'Quarterly',
    granularity: 'quarterly',
    coverage: 'Qatar',
    periods: '2015-Q1 → 2024-Q4',
    unit: '% of GDP',
    polarity: 'Increase',
    dataSource: 'Qatar Tourism',
    aliasesEn: ['tourism share of GDP', 'tourism contribution', 'tourism GDP', 'travel and tourism share', 'tourism sector GDP', 'hospitality contribution'],
    aliasesAr: ['مساهمة السياحة', 'السياحة من الناتج', 'نسبة السياحة', 'قطاع السياحة'],
    status: 'approved',
    statusLabel: 'Published',
    inCatalogue: true,
    questions7d: 42,
    direct: 88,
    picker: 12,
    series: { labels: QTRS, actual: [6.4, 6.7, 7.0, 6.9, 7.2, 7.4, 7.7, 8.8], target: [7.0, 7.0, 7.0, 7.0, 7.6, 7.6, 7.6, 7.6], suffix: '%', decimals: 1, file: 'quarterly.csv', row: 2207 },
    quality: [
      { tone: 'warning', title: 'Q2 2023 value revised twice', detail: 'sceai_indicators_quarterly.csv v12 → v14 changed 6.6% → 6.7%' },
      { tone: 'info', title: 'No target defined for 2025 periods', detail: 'Agents will report actuals only until a target is ingested' },
    ],
  },
  {
    code: 'IND-PRC-002',
    nameEn: 'Consumer Price Inflation (YoY)',
    nameAr: 'معدل التضخم السنوي',
    frequency: 'Monthly',
    granularity: 'monthly',
    coverage: 'Qatar, GCC',
    periods: '2010-01 → 2024-12',
    unit: '% YoY',
    polarity: 'Decrease',
    dataSource: PSA,
    aliasesEn: ['inflation', 'CPI', 'consumer prices', 'price index', 'cost of living', 'headline inflation', 'CPI YoY', 'inflation rate', 'consumer inflation'],
    aliasesAr: ['التضخم', 'معدل التضخم', 'مؤشر الأسعار', 'أسعار المستهلك', 'غلاء المعيشة', 'الرقم القياسي', 'تضخم سنوي'],
    status: 'approved',
    statusLabel: 'Published',
    inCatalogue: true,
    questions7d: 33,
    direct: 94,
    picker: 6,
    series: { labels: ['Jun 18', 'Jul 18', 'Aug 18', 'Sep 18', 'Oct 18', 'Nov 18', 'Dec 18', 'Jan 19'], actual: [0.2, 0.1, 0.4, 0.3, -0.1, -0.3, -0.4, -0.5], target: [0.0, 0.0, 0.0, 0.0, -0.2, -0.2, -0.3, -0.3], suffix: '%', decimals: 1, file: 'monthly.csv', row: 411 },
    quality: [],
  },
  {
    code: 'IND-TRD-031',
    nameEn: 'Non-Hydrocarbon Exports (share of total exports)',
    nameAr: 'الصادرات غير الهيدروكربونية',
    frequency: 'Annual',
    granularity: 'yearly',
    coverage: 'Qatar, GCC',
    periods: '2010 → 2023',
    unit: '% of total exports',
    polarity: 'Increase',
    dataSource: PSA,
    aliasesEn: ['non-oil exports share', 'non-hydrocarbon exports', 'non-hydrocarbon export share', 'diversified exports', 'non-energy exports'],
    aliasesAr: ['الصادرات غير النفطية', 'حصة الصادرات غير الهيدروكربونية', 'الصادرات غير الهيدروكربونية'],
    status: 'approved',
    statusLabel: 'Published',
    inCatalogue: true,
    questions7d: 9,
    direct: 80,
    picker: 20,
    series: { labels: ['2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019'], actual: [24.1, 25.6, 26.9, 28.2, 28.8, 29.4, 30.8, 32.04], target: [50, 50, 50, 50, 50, 50, 50, 50], suffix: '%', decimals: 2, file: 'annual.csv', row: 70 },
    quality: [],
  },
  {
    code: 'IND-FDS-007',
    nameEn: 'Strategic Food Reserve Coverage',
    nameAr: 'تغطية المخزون الاستراتيجي للأغذية',
    frequency: 'Annual',
    granularity: 'yearly',
    coverage: 'Qatar',
    periods: '2018 → 2024',
    unit: 'days',
    polarity: 'Increase',
    dataSource: PSA,
    aliasesEn: ['food reserve', 'strategic food stock', 'food security reserve', 'food reserve days'],
    aliasesAr: ['المخزون الغذائي', 'الاحتياطي الاستراتيجي للأغذية', 'أيام تغطية المخزون'],
    status: 'approved',
    statusLabel: 'Published',
    inCatalogue: true,
    questions7d: 9,
    direct: 80,
    picker: 20,
    series: { labels: ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'], actual: [52, 58, 61, 66, 70, 74, 79, 84], target: null, suffix: ' days', decimals: 0, file: 'annual.csv', row: 134 },
    quality: [{ tone: 'info', title: 'No target defined', detail: 'Agents will report actuals only until a target is ingested' }],
  },
  {
    code: 'IND-GDP-001',
    nameEn: 'Real GDP Growth',
    nameAr: 'نمو الناتج المحلي الحقيقي',
    frequency: 'Annual',
    granularity: 'yearly',
    coverage: 'Qatar, GCC',
    periods: '2000 → 2024',
    unit: '% YoY',
    polarity: 'Increase',
    dataSource: PSA,
    aliasesEn: ['GDP growth', 'real GDP', 'economic growth', 'growth rate', 'real growth', 'GDP YoY', 'constant-price GDP growth'],
    aliasesAr: ['نمو الناتج المحلي', 'النمو الاقتصادي', 'الناتج الحقيقي', 'معدل النمو', 'نمو الناتج الإجمالي'],
    status: 'approved',
    statusLabel: 'Published',
    inCatalogue: true,
    questions7d: 9,
    direct: 80,
    picker: 20,
    series: { labels: ['2017', '2018*', '2019', '2020*', '2021', '2022*', '2023', '2024'], actual: [1.5, -3.6, 1.6, 4.9, 1.2, 1.56, 2.0, 2.4], target: [2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0], suffix: '%', decimals: 2, file: 'annual.csv', row: 12 },
    quality: [],
  },
  {
    code: 'IND-TRD-019',
    nameEn: 'Re-export Value Growth',
    nameAr: 'نمو قيمة إعادة التصدير',
    frequency: 'Quarterly',
    granularity: 'quarterly',
    coverage: 'Qatar',
    periods: '2019-Q1 → 2024-Q4',
    unit: '% YoY',
    polarity: 'Increase',
    dataSource: PSA,
    aliasesEn: ['re-exports growth', 're-export value', 're-export growth'],
    aliasesAr: ['إعادة التصدير', 'نمو إعادة التصدير'],
    status: 'hold',
    statusLabel: 'Draft · next version',
    inCatalogue: true,
    questions7d: 9,
    direct: 80,
    picker: 20,
    series: { labels: QTRS, actual: [3.1, 4.4, 2.8, 5.0, 6.2, 5.5, 7.1, 6.4], target: [5, 5, 5, 5, 5, 5, 5, 5], suffix: '%', decimals: 1, file: 'quarterly.csv', row: 1880 },
    quality: [],
  },
  {
    code: 'IND-LAB-022',
    nameEn: 'Labour Force Participation Rate',
    nameAr: 'معدل المشاركة في القوى العاملة',
    frequency: 'Quarterly',
    granularity: 'quarterly',
    coverage: 'Qatar',
    periods: '2015-Q1 → 2024-Q4',
    unit: '% of working-age population',
    polarity: 'Increase',
    dataSource: PSA,
    aliasesEn: ['labour force participation', 'participation rate', 'LFPR', 'labor force participation'],
    aliasesAr: ['المشاركة في القوى العاملة', 'معدل المشاركة'],
    status: 'approved',
    statusLabel: 'Published',
    inCatalogue: false,
    questions7d: 9,
    direct: 80,
    picker: 20,
    series: { labels: QTRS, actual: [87.9, 88.1, 88.4, 88.2, 88.6, 88.7, 88.9, 89.1], target: [88.5, 88.5, 88.5, 88.5, 88.5, 88.5, 88.5, 88.5], suffix: '%', decimals: 1, file: 'quarterly.csv', row: 2290 },
    quality: [],
  },
];

export const indicatorByCode = (code: string | undefined) => INDICATORS.find((i) => i.code.toLowerCase() === code?.toLowerCase());

/** Order of the Indicators list (design `indList`). */
export const INDICATOR_LIST = ['IND-TOU-014', 'IND-PRC-002', 'IND-TRD-031', 'IND-FDS-007', 'IND-LAB-022', 'IND-TRD-019'];

export interface CatVersion {
  version: string;
  tag: string;
  note: string;
  by: string;
  when: string;
  current: boolean;
}

export const CATALOGUE_VERSIONS: CatVersion[] = [
  { version: 'v2026.11.3', tag: 'Current', note: 'Added 4 indicators · 12 Arabic aliases', by: 'm.alkuwari', when: '3 d ago', current: true },
  { version: 'v2026.11.2', tag: '', note: 'Renamed IND-PRC-002 aliases', by: 'r.haddad', when: '11 d ago', current: false },
  { version: 'v2026.10.1', tag: '', note: 'Removed 2 duplicate GDP indicators', by: 'm.alkuwari', when: '34 d ago', current: false },
  { version: 'v2026.09.4', tag: '', note: 'Initial assistant catalogue · 206 indicators', by: 'r.haddad', when: '61 d ago', current: false },
];

/** Per-entry history (design `ci.hist`). */
export const entryHistory = (ind: Indicator) => [
  { version: 'v2026.11.3', note: 'Added 2 Arabic aliases', by: 'm.alkuwari', when: '3 d ago' },
  { version: 'v2026.10.1', note: `Unit clarified to ${ind.unit}`, by: 'r.haddad', when: '34 d ago' },
  { version: 'v2026.09.4', note: 'Entry created', by: 'r.haddad', when: '61 d ago' },
];

/** Top questions (design `ci.qs`). */
export const topQuestions = (ind: Indicator) => [
  { q: `How did ${ind.nameEn.split(' (')[0].toLowerCase()} change last period?`, n: 11 },
  { q: 'What is the latest value and is it on target?', n: 9 },
  { q: `${ind.nameAr}؟`, n: 7 },
  { q: 'Compare with the previous year', n: 5 },
];

// ---------- Publish flow (design `pub*`) ----------

export type ChangeKind = 'Added' | 'Changed' | 'Retired';

export interface PublishChange {
  kind: ChangeKind;
  name: string;
  code: string;
  field: string;
  before: string;
  after: string;
  by: string;
}

export const PUBLISH_SUMMARY: { text: string; bg: string; fg: string }[] = [
  { text: '+ 1 added', bg: 'var(--success-bg)', fg: 'var(--success-fg)' },
  { text: '~ 7 changed', bg: 'var(--info-bg)', fg: 'var(--info)' },
  { text: '− 1 retired', bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' },
  { text: '+ 12 Arabic aliases', bg: 'var(--surface-sunken)', fg: 'var(--text-body)' },
];

export const PUBLISH_CHANGES: PublishChange[] = (
  [
    ['Added', 'Re-export Value Growth', 'IND-TRD-019', 'Status', 'Draft', 'Published', 'm.alkuwari'],
    ['Changed', 'Sector Contribution to GDP (Tourism)', 'IND-TOU-014', 'Target · 2025-Q1', '—', '7.9%', 'pkg_2024Q4'],
    ['Changed', 'Non-Hydrocarbon Exports (share of total exports)', 'IND-TRD-031', 'Target · 2024', '50%', '45%', 'pkg_2024Q4'],
    ['Changed', 'Consumer Price Inflation (YoY)', 'IND-PRC-002', 'Arabic aliases', '7', '9', 'r.haddad'],
    ['Changed', 'Strategic Food Reserve Coverage', 'IND-FDS-007', 'Unit label', 'days', 'days of consumption', 'm.alkuwari'],
    ['Changed', 'Real GDP Growth', 'IND-GDP-001', 'Source organisation', 'PSA', 'National Planning Council', 'pkg_2024Q4'],
    ['Changed', 'Labour Force Participation Rate', 'IND-LAB-022', 'Latest period', '2024-Q3', '2024-Q4', 'pkg_2024Q4'],
    ['Changed', 'Sector Contribution to GDP (Tourism)', 'IND-TOU-014', 'English aliases', '6', '8', 'r.haddad'],
    ['Retired', 'GDP (nominal, old series)', 'IND-GDP-004', 'Status', 'Published', 'Retired', 'm.alkuwari'],
  ] as [ChangeKind, string, string, string, string, string, string][]
).map(([kind, name, code, field, before, after, by]) => ({ kind, name, code, field, before, after, by }));

export const PUBLISH_CHECKS: { ok: boolean; title: string; detail: string; metric: string }[] = [
  { ok: true, title: 'Names are unique', detail: 'No two indicators share a name or alias, so the Indicator Picker cannot confuse them.', metric: '215 / 215' },
  { ok: true, title: 'Every indicator has data', detail: 'Each published indicator has at least one observation in the Indicators DB.', metric: '215 / 215' },
  { ok: true, title: 'Units and periods are valid', detail: 'Frequency matches the periods present; units are set.', metric: '0 issues' },
  { ok: true, title: 'Retired entry is not referenced', detail: 'No saved questions or reports point at IND-GDP-004.', metric: '0 references' },
  { ok: true, title: 'Ask AI regression questions', detail: 'Answers to the 200 test questions match expected numbers.', metric: '198 / 200' },
  { ok: false, title: 'Arabic alias coverage', detail: '6 indicators still have fewer than 2 Arabic aliases. Arabic questions about them may need the Indicator Picker.', metric: '97% covered' },
];

export const PUBLISH_EVAL: { k: string; v: string; d: string; c: string }[] = [
  { k: 'Correct numbers', v: '99.0%', d: '+0.5 pp vs current', c: 'var(--success-fg)' },
  { k: 'Resolved directly', v: '94%', d: '+3 pp · fewer Picker calls', c: 'var(--success-fg)' },
  { k: 'Arabic questions', v: '97.5%', d: '78 / 80', c: 'var(--text-muted)' },
  { k: 'Median latency', v: '3.1 s', d: 'unchanged', c: 'var(--text-muted)' },
];

export const RELEASE_NOTES =
  'Adds Q4 2024 targets for 4 tourism and trade indicators. Adds 12 Arabic aliases. Renames Re-export Value Growth and publishes it. Retires the duplicate GDP (nominal, old series) entry.';

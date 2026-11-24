// Ask AI conversations, messages and feedback.
//
// Field names follow the Ask AI tables (scai-chatbot etl/schema.sql):
// chat_messages, message_feedback, message_citations — plus console-only
// fields the design needs (pipeline path, stages, feedback reason/status).
//
// The 14 rows visible in design-ref/screens/convs.html come first, message
// 7f21a9 reproduces conv.html exactly, and the 7 negative-feedback rows match
// feedback.html. The remaining messages are generated deterministically so the
// totals match the design summary strip: 508 messages · numeric 61% · article
// 18% · refusal/chat 17% · template fallback 8 · Arabic 38% · negative 7
// (positive 86).
import type { Tone } from '@/components/ui/badge';

export type AnswerType = 'Numeric' | 'Article' | 'Template fallback' | 'Refusal' | 'General chat' | 'Explanation';
export type Lang = 'EN' | 'AR';

/** A part of the rendered answer: plain text or a numbered number chip. */
export type MsgPart = string | { v: string; n: number; computed?: boolean };

export interface PipelineStage {
  stage: 'understanding' | 'routed' | 'resolved' | 'retrieving' | 'composing' | 'verifying' | 'replace';
  name: string;
  kind: 'ai' | 'code';
  agentId?: string;
  startS: number;
  durS: number;
  /** e.g. "AI · Qwen2.5-7B-Instruct" */
  detail: string;
  note: string;
  input: string;
  output: string;
  skipped?: boolean;
  failed?: boolean;
}

/** message_citations row + display fields for the Number provenance table. */
export interface Citation {
  message_id: string;
  position: number;
  source_table: string;
  record_id: string | null;
  indicator: string;
  data_source: string;
  period_label: string;
  country: string;
  // console
  value: string;
  source: string;
  produced_by: string;
  catalogue_version: string;
  verifier: 'Matched' | 'Unmatched';
}

/** message_feedback row + console triage fields. */
export interface Feedback {
  feedback_id: string;
  message_id: string;
  session_id: string;
  rating: number;
  comment: string | null;
  question: string;
  answer: string;
  created_at: string;
  // console
  helpful: boolean;
  reason?: string;
  status?: 'New' | 'Triaged' | 'Resolved';
  rel: string;
}

export interface ChatMessage {
  // chat_messages
  message_id: string;
  session_id: string;
  asked_at: string;
  endpoint: 'chat' | 'read';
  language: 'en' | 'ar';
  question: string;
  answer: string;
  answered: boolean;
  answer_shape: string;
  indicator: string | null;
  period_label: string | null;
  verified: boolean | null;
  readable: boolean | null;
  latency_ms: number;
  // console
  user: string;
  lang: Lang;
  rel: string;
  abs: string;
  answerType: AnswerType;
  tone: Tone;
  path: string;
  latency: string;
  sessionPos: number;
  sessionLen: number;
  channel: string;
  composer: string;
  answerParts: MsgPart[];
  followUps: string[];
  understanding: { computation: string; indicator: string; viaPicker: boolean; countries: string; periods: string; frequency: string };
  verifier: { tone: 'ok' | 'warn' | 'neutral'; text: string };
  stages: PipelineStage[];
  citations: Citation[];
  passages: { position: number; doc: string; section: string }[];
  feedback: Feedback | null;
}

// ------------------------------------------------------------------ helpers

function rng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
const NOW = Date.parse('2026-11-19T14:20:00+03:00');
const fmtAbs = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Qatar' });
const relFrom = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 24 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} d ago`);
const hoursOf = (rel: string) => {
  const m = rel.match(/(\d+)\s*(min|h|d)/);
  if (!m) return 0;
  return Number(m[1]) * { min: 1 / 60, h: 1, d: 24 }[m[2] as 'min' | 'h' | 'd'];
};
const fmtLat = (s: number) => `${s.toFixed(1)} s`;
const fmtStage = (d: number) => (d === 0 ? 'skipped' : d < 1 ? `${Math.round(d * 1000)} ms` : `${d.toFixed(2)} s`);
export { fmtStage };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const Q_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
const pLabel = (p: string, ar = false) => {
  if (/Q\d$/.test(p)) return ar ? `الربع ${Q_AR[+p.slice(-1) - 1]} ${p.slice(0, 4)}` : `Q${p.slice(-1)} ${p.slice(0, 4)}`;
  if (/^\d{4}-\d\d$/.test(p)) return `${(ar ? MONTHS_AR : MONTHS)[+p.slice(5) - 1]} ${p.slice(0, 4)}`;
  return p;
};
const sign = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

// ------------------------------------------------------------------ indicators

type IndKey = 'tourism' | 'cpi' | 'nonhydro' | 'food' | 'gdp' | 'reexp' | 'labour' | 'unemp' | 'compet';
interface Ind {
  name: string;
  short: string;
  ar: string;
  code: string;
  freq: 'Q' | 'M' | 'A';
  unit: '%' | ' days' | '';
  org: string;
  file: string;
  vals: Record<string, [number, number]>;
  peers?: { period: string; v: Record<string, number> };
}
const PSA = 'Planning and Statistics Authority';
const INDS: Record<IndKey, Ind> = {
  tourism: { name: 'Sector Contribution to GDP (Tourism)', short: "tourism's share of GDP", ar: 'مساهمة قطاع السياحة في الناتج المحلي', code: 'IND-TOU-014', freq: 'Q', unit: '%', org: 'Qatar Tourism', file: 'quarterly.csv', vals: { '2023-Q4': [6.9, 2210], '2024-Q2': [7.9, 2212], '2024-Q3': [8.1, 2213], '2024-Q4': [8.8, 2214] } },
  cpi: { name: 'Consumer Price Inflation (YoY)', short: 'consumer price inflation', ar: 'معدل التضخم السنوي', code: 'IND-PRC-002', freq: 'M', unit: '%', org: PSA, file: 'monthly.csv', vals: { '2019-01': [-0.5, 1187], '2023-12': [1.4, 1246], '2024-12': [0.9, 1258] }, peers: { period: '2023-12', v: { OMN: 0.9, ARE: 3.1, KWT: 3.4 } } },
  nonhydro: { name: 'Non-Hydrocarbon Exports (share of total exports)', short: 'the non-hydrocarbon share of exports', ar: 'الصادرات غير الهيدروكربونية', code: 'IND-TRD-031', freq: 'A', unit: '%', org: PSA, file: 'annual.csv', vals: { '2017': [29.4, 410], '2018': [30.6, 411], '2019': [32.04, 412] } },
  food: { name: 'Strategic Food Reserve Coverage', short: 'strategic food reserve coverage', ar: 'تغطية المخزون الاستراتيجي للأغذية', code: 'IND-FDS-007', freq: 'A', unit: ' days', org: 'Ministry of Commerce and Industry', file: 'annual.csv', vals: { '2023': [79, 454], '2024': [84, 455] } },
  gdp: { name: 'Real GDP Growth', short: 'real GDP growth', ar: 'نمو الناتج المحلي الحقيقي', code: 'IND-GDP-001', freq: 'A', unit: '%', org: PSA, file: 'annual.csv', vals: { '2022': [4.2, 101], '2023': [1.2, 102] }, peers: { period: '2023', v: { ARE: 3.6, SAU: -0.8, OMN: 1.3, KWT: -2.2 } } },
  reexp: { name: 'Re-export Value Growth', short: 're-export value growth', ar: 'نمو قيمة إعادة التصدير', code: 'IND-TRD-019', freq: 'Q', unit: '%', org: PSA, file: 'quarterly.csv', vals: { '2024-Q2': [3.1, 2197], '2024-Q3': [4.6, 2198] } },
  labour: { name: 'Labour Force Participation Rate', short: 'labour force participation', ar: 'معدل المشاركة في القوى العاملة', code: 'IND-LAB-022', freq: 'Q', unit: '%', org: PSA, file: 'quarterly.csv', vals: { '2024-Q3': [88.2, 2230], '2024-Q4': [88.4, 2231] } },
  unemp: { name: 'Unemployment Rate', short: 'unemployment rate', ar: 'معدل البطالة', code: 'IND-LAB-001', freq: 'A', unit: '%', org: PSA, file: 'annual.csv', vals: { '2023': [0.1, 140] } },
  compet: { name: 'National Competitiveness Index (rank)', short: 'national competitiveness rank', ar: 'مؤشر التنافسية الوطني', code: 'IND-CMP-003', freq: 'A', unit: '', org: PSA, file: 'annual.csv', vals: { '2024': [11, 160] } },
};
const GEN_INDS: IndKey[] = ['tourism', 'cpi', 'nonhydro', 'food', 'gdp', 'reexp', 'labour'];
const COUNTRY: Record<string, [string, string]> = { QAT: ['Qatar', 'قطر'], ARE: ['the UAE', 'الإمارات'], SAU: ['Saudi Arabia', 'السعودية'], OMN: ['Oman', 'عمان'], KWT: ['Kuwait', 'الكويت'] };
const fmtV = (ind: Ind, v: number, ar = false) => (ind.unit === ' days' ? (ar ? `${v} يوما` : `${v} days`) : `${sign(v)}${ind.unit}`);
const periodsOf = (ind: Ind) => Object.keys(ind.vals);
const latestOf = (ind: Ind) => periodsOf(ind)[periodsOf(ind).length - 1];

// ------------------------------------------------------------------ specs

type NumKind = 'value' | 'change' | 'latest' | 'compare' | 'max';
type Kind = NumKind | 'article' | 'oos' | 'none' | 'chat' | 'template' | 'read';
interface Spec {
  id: string;
  user: string;
  lang: Lang;
  kind: Kind;
  q?: string;
  ind?: IndKey;
  p?: string;
  p2?: string;
  country?: string;
  topic?: number;
  pick?: number;
  picker?: boolean;
  lat: number;
  fb: 1 | -1 | 0;
  rel?: string;
  ageH: number;
}

const TOPICS: [string, string][] = [
  ['export diversification', 'تنويع الصادرات'],
  ['economic diversification', 'تنويع الاقتصاد'],
  ['tourism strategy', 'استراتيجية السياحة'],
  ['food security', 'الأمن الغذائي'],
  ['private sector growth', 'نمو القطاع الخاص'],
  ['labour market reform', 'إصلاح سوق العمل'],
  ['sports tourism', 'السياحة الرياضية'],
  ['logistics and re-exports', 'الخدمات اللوجستية وإعادة التصدير'],
  ['the digital economy', 'الاقتصاد الرقمي'],
];
const DOCS = [
  ['National Development Strategy', 'Economic diversification'],
  ['SCEAI annual economic report 2024', 'Sector outlook'],
  ['Third National Development Strategy · progress review', 'Priority outcomes'],
];
const OOS: Record<Lang, string[]> = {
  EN: ['Who will win the next World Cup?', 'Write me a poem about the sea', 'What is the weather in Doha tomorrow?', 'Can you book a flight to London?', 'What is the price of Bitcoin today?', 'Tell me a joke'],
  AR: ['من سيفوز بكأس العالم القادم؟', 'ما هو الطقس في الدوحة غدا؟', 'اكتب لي قصيدة عن البحر', 'ما هو سعر البيتكوين اليوم؟'],
};
const NONE_Q: Record<Lang, string[]> = {
  EN: ['Hotel occupancy in Al Wakrah last month', 'Number of registered cars in Qatar', 'Average rent in Lusail', 'Mobile subscriptions per capita'],
  AR: ['نسبة إشغال الفنادق في الوكرة', 'عدد السيارات المسجلة في قطر', 'متوسط الإيجارات في لوسيل'],
};
const CHAT_Q: Record<Lang, string[]> = {
  EN: ['Hello, what can you help me with?', 'Thanks, that was useful', 'Can you answer in Arabic?', 'What data do you have?'],
  AR: ['مرحبا، كيف يمكنك مساعدتي؟', 'شكرا لك', 'ما هي البيانات المتوفرة لديك؟'],
};
const TEMPLATE_Q: Record<Lang, [string, IndKey][]> = {
  EN: [
    ['Rank GCC countries by non-hydrocarbon export share in 2019', 'nonhydro'],
    ['Growth rate of re-exports between 2022 and 2024', 'reexp'],
    ['Average tourism share of GDP over the last 8 quarters', 'tourism'],
    ['Rank indicators by distance from target', 'nonhydro'],
  ],
  AR: [
    ['رتب دول الخليج حسب نسبة الصادرات غير الهيدروكربونية', 'nonhydro'],
    ['معدل نمو إعادة التصدير بين 2022 و2024', 'reexp'],
  ],
};

const DESIGN_SPECS: Spec[] = [
  { id: '7f21a9', user: 'sceai_analyst', lang: 'EN', kind: 'change', ind: 'tourism', p: '2023-Q4', p2: '2024-Q4', picker: true, lat: 4.1, fb: 1, rel: '12 min ago', ageH: 0.2 },
  { id: '7f21a4', user: 'sceai_analyst', lang: 'AR', kind: 'value', q: 'ما هو معدل التضخم في قطر في يناير 2019؟', ind: 'cpi', p: '2019-01', lat: 3.2, fb: 0, rel: '18 min ago', ageH: 0.3 },
  { id: '7f2198', user: 'guest_8812', lang: 'EN', kind: 'article', q: 'What does the National Development Strategy say about export diversification?', topic: 0, lat: 3.8, fb: 1, rel: '25 min ago', ageH: 0.42 },
  { id: '7f2190', user: 'guest_8812', lang: 'AR', kind: 'compare', q: 'قارن نمو الناتج المحلي بين قطر والإمارات في 2023', ind: 'gdp', country: 'ARE', lat: 3.6, fb: 0, rel: '41 min ago', ageH: 0.68 },
  { id: '7f2187', user: 'api:dashboards-svc', lang: 'EN', kind: 'template', q: 'Rank GCC countries by non-hydrocarbon export share in 2019', ind: 'nonhydro', lat: 4.4, fb: -1, rel: '1 h ago', ageH: 1 },
  { id: '7f217c', user: 'guest_7720', lang: 'EN', kind: 'oos', q: 'Who will win the next World Cup?', lat: 0.6, fb: 0, rel: '1 h ago', ageH: 1.2 },
  { id: '7f2171', user: 'sceai_admin', lang: 'AR', kind: 'value', q: 'كم بلغت مساهمة قطاع السياحة في الناتج المحلي في الربع الرابع 2024؟', ind: 'tourism', p: '2024-Q4', lat: 3.1, fb: 1, rel: '2 h ago', ageH: 2 },
  { id: '7f2166', user: 'guest_7720', lang: 'EN', kind: 'none', q: 'Hotel occupancy in Al Wakrah last month', lat: 1.9, fb: -1, rel: '3 h ago', ageH: 3 },
  { id: '7f215b', user: 'sceai_analyst', lang: 'EN', kind: 'latest', q: 'What is the latest strategic food reserve coverage?', ind: 'food', lat: 2.9, fb: 0, rel: '4 h ago', ageH: 4 },
  { id: '7f2150', user: 'guest_9034', lang: 'AR', kind: 'latest', q: 'ما هي آخر قيمة لتغطية المخزون الاستراتيجي للأغذية؟', ind: 'food', lat: 3.0, fb: 1, rel: '5 h ago', ageH: 5 },
  { id: '7f2149', user: 'guest_9034', lang: 'EN', kind: 'chat', q: 'Hello, what can you help me with?', lat: 1.2, fb: 0, rel: '5 h ago', ageH: 5.2 },
  { id: '7f213e', user: 'sceai_analyst', lang: 'EN', kind: 'template', q: 'Growth rate of re-exports between 2022 and 2024', ind: 'reexp', lat: 4.7, fb: -1, rel: '7 h ago', ageH: 7 },
  { id: '7f2132', user: 'guest_6610', lang: 'AR', kind: 'article', q: 'ما الذي تقوله التقارير عن تنويع الاقتصاد؟', topic: 1, lat: 4.0, fb: 0, rel: '9 h ago', ageH: 9 },
  { id: '7f2127', user: 'sceai_admin', lang: 'EN', kind: 'max', q: 'Which quarter had the highest tourism contribution since 2022?', ind: 'tourism', lat: 3.3, fb: 1, rel: '11 h ago', ageH: 11 },
];

/** Negative feedback rows from feedback.html (message id → reason, comment, status). */
const NEG_FEEDBACK: Record<string, { reason: string; comment: string; status: 'New' | 'Triaged' | 'Resolved'; rel: string; rating: number }> = {
  '7f2187': { reason: 'Not answered', comment: 'Gave a generic answer instead of the ranking', status: 'New', rel: '1 h ago', rating: 1 },
  '7f2166': { reason: 'Missing indicator', comment: 'This data exists on the PSA site', status: 'New', rel: '3 h ago', rating: 2 },
  '7f213e': { reason: 'Not answered', comment: '—', status: 'Triaged', rel: '7 h ago', rating: 1 },
  '7f20f2': { reason: 'Wrong indicator', comment: 'أريد مؤشر التنافسية العالمي وليس المحلي', status: 'Triaged', rel: '1 d ago', rating: 2 },
  '7f20c8': { reason: 'Too long', comment: 'Just wanted the table', status: 'New', rel: '2 d ago', rating: 2 },
  '7f2081': { reason: 'Wrong source', comment: 'المصدر قديم', status: 'New', rel: '3 d ago', rating: 1 },
  '7f1f9a': { reason: 'Wrong period', comment: 'Showed 2023, 2024 is published', status: 'Resolved', rel: '5 d ago', rating: 2 },
};

/** Messages that only appear in the feedback table; forced into the generated history. */
const RESERVED: Record<string, Omit<Spec, 'id' | 'ageH' | 'user'> & { user: string; ageH: number }> = {
  '7f20f2': { user: 'guest_5127', lang: 'AR', kind: 'value', q: 'ما هو ترتيب قطر في مؤشر التنافسية؟', ind: 'compet', p: '2024', lat: 3.4, fb: -1, rel: '1 d ago', ageH: 27 },
  '7f20c8': { user: 'sceai_analyst', lang: 'EN', kind: 'compare', q: 'Compare inflation in Qatar and Oman since 2020', ind: 'cpi', country: 'OMN', lat: 4.6, fb: -1, rel: '2 d ago', ageH: 44 },
  '7f2081': { user: 'guest_4403', lang: 'AR', kind: 'article', q: 'ما الذي تقوله التقارير عن السياحة الرياضية؟', topic: 6, lat: 4.1, fb: -1, rel: '3 d ago', ageH: 66 },
  '7f1f9a': { user: 'm.alkuwari', lang: 'EN', kind: 'latest', q: 'Latest unemployment rate', ind: 'unemp', lat: 2.8, fb: -1, rel: '5 d ago', ageH: 120 },
};

// ------------------------------------------------------------------ generation of specs

const TOTAL = 508;
const USERS_POOL = ['sceai_analyst', 'sceai_admin', 'api:dashboards-svc', 'm.alkuwari', 'r.haddad', 'guest_8812', 'guest_7720', 'guest_9034', 'guest_6610', 'guest_5127', 'guest_4403', 'guest_3391', 'guest_2268', 'guest_1907'];

function shuffle<T>(a: T[], r: () => number) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generatedSpecs(): Spec[] {
  const r = rng(508);
  const n = TOTAL - DESIGN_SPECS.length; // 494
  const ids = Array.from({ length: n }, (_, k) => (0x7f2126 - k).toString(16));
  const free = ids.filter((id) => !RESERVED[id]); // 490
  // Pool counts (totals minus design rows minus reserved feedback rows).
  const kinds: Kind[] = shuffle(
    [
      ...Array<Kind>(300).fill('value'),
      ...Array<Kind>(89).fill('article'),
      ...Array<Kind>(6).fill('template'),
      ...Array<Kind>(40).fill('oos'),
      ...Array<Kind>(18).fill('none'),
      ...Array<Kind>(26).fill('chat'),
      ...Array<Kind>(11).fill('read'),
    ],
    r,
  );
  const langs: Lang[] = shuffle([...Array<Lang>(186).fill('AR'), ...Array<Lang>(free.length - 186).fill('EN')], r);
  // 81 positive ratings on answered messages.
  const answeredIdx = kinds.map((k, i) => (k === 'oos' || k === 'none' ? -1 : i)).filter((i) => i >= 0);
  const positive = new Set(shuffle(answeredIdx, r).slice(0, 81));

  const out: Spec[] = [];
  let user = USERS_POOL[0];
  let left = 0;
  let fi = 0;
  ids.forEach((id, k) => {
    const ageH = 11.3 + k * (156.5 / n) + r() * 0.2;
    if (RESERVED[id]) {
      out.push({ id, ...RESERVED[id] });
      return;
    }
    if (left <= 0) {
      user = USERS_POOL[Math.floor(r() * USERS_POOL.length)];
      left = 1 + Math.floor(r() * 5);
    }
    left--;
    let kind = kinds[fi];
    const lang = langs[fi];
    const fb: 1 | 0 = positive.has(fi) ? 1 : 0;
    fi++;
    const spec: Spec = { id, user, lang, kind, lat: 0, fb, ageH, pick: Math.floor(r() * 1000) };
    if (kind === 'value') {
      // Spread numeric questions over value / change / latest / compare.
      const x = r();
      const ind = GEN_INDS[Math.floor(r() * GEN_INDS.length)];
      const I = INDS[ind];
      const ps = periodsOf(I);
      kind = x < 0.4 ? 'value' : x < 0.65 && ps.length > 1 ? 'change' : x < 0.85 || !I.peers ? 'latest' : 'compare';
      spec.kind = kind;
      spec.ind = ind;
      spec.p = ps[Math.floor(r() * ps.length)];
      if (kind === 'change') {
        spec.p = ps[0];
        spec.p2 = ps[ps.length - 1];
      }
      if (kind === 'compare') spec.country = Object.keys(I.peers!.v)[Math.floor(r() * Object.keys(I.peers!.v).length)];
      spec.picker = r() < 0.2;
      spec.lat = 2.6 + r() * 2.2 + (spec.picker ? 1.1 : 0);
    } else if (kind === 'article') {
      spec.topic = Math.floor(r() * TOPICS.length);
      spec.lat = 3.2 + r() * 1.4;
    } else if (kind === 'template') {
      const [q, ind] = TEMPLATE_Q[lang][Math.floor(r() * TEMPLATE_Q[lang].length)];
      spec.q = q;
      spec.ind = ind;
      spec.lat = 4.2 + r() * 0.8;
    } else if (kind === 'oos') spec.lat = 0.5 + r() * 0.4;
    else if (kind === 'none') spec.lat = 1.7 + r() * 0.5;
    else if (kind === 'chat') spec.lat = 0.9 + r() * 0.6;
    else if (kind === 'read') {
      spec.ind = GEN_INDS[Math.floor(r() * GEN_INDS.length)];
      spec.lat = 2.0 + r() * 1.4;
    }
    spec.lat = Math.round(spec.lat * 10) / 10;
    out.push(spec);
  });
  return out;
}

// ------------------------------------------------------------------ message builder

const TYPE_OF: Record<Kind, AnswerType> = { value: 'Numeric', change: 'Numeric', latest: 'Numeric', compare: 'Numeric', max: 'Numeric', article: 'Article', template: 'Template fallback', oos: 'Refusal', none: 'Refusal', chat: 'General chat', read: 'Explanation' };
const TONE_OF: Record<AnswerType, Tone> = { Numeric: 'success', Article: 'info', 'Template fallback': 'warning', Refusal: 'neutral', 'General chat': 'neutral', Explanation: 'neutral' };
const COMPUTATION: Record<Kind, string> = { value: 'single_value', change: 'period_comparison', latest: 'latest_value', compare: 'country_comparison', max: 'max_over_range', article: 'article', template: 'ranking', oos: 'out_of_scope', none: 'single_value', chat: 'chat', read: 'explain' };
const SHAPE: Record<Kind, string> = { value: 'value', change: 'comparison', latest: 'value', compare: 'comparison', max: 'value', article: 'article', template: 'value', oos: 'refusal', none: 'refusal', chat: 'chat', read: 'explanation' };

const pathOf = (s: Spec) => {
  switch (s.kind) {
    case 'article':
      return 'Intent → Retrieve → Article';
    case 'template':
      return 'Compose → Verify rejected → Template';
    case 'oos':
      return 'Intent → out of scope';
    case 'none':
      return 'Intent → Resolve + Picker (NONE)';
    case 'chat':
      return 'Intent → Composer';
    case 'read':
      return 'Read → Reader Agent';
    default:
      return s.picker ? 'Intent → Resolve + Picker → Compute → Compose → Verify' : 'Intent → Resolve → Compute → Compose → Verify';
  }
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Facts used by numeric answers: [value, period, country, computed?] */
type Fact = { v: string; period: string; country: string; ind: Ind; row?: number; computed?: string };

function numeric(s: Spec): { q: string; parts: MsgPart[]; facts: Fact[]; periods: string[]; countries: string[] } {
  const I = INDS[s.ind!];
  const ar = s.lang === 'AR';
  const pick = s.pick ?? 0;
  const f = (p: string, country = 'QAT'): Fact => ({ v: fmtV(I, I.vals[p][0], ar), period: p, country, ind: I, row: I.vals[p][1] });
  switch (s.kind) {
    case 'change': {
      const [a, b] = [f(s.p!), f(s.p2!)];
      const d = Math.round((I.vals[s.p2!][0] - I.vals[s.p!][0]) * 100) / 100;
      const up = d >= 0;
      const isPct = I.unit === '%';
      const dv = isPct ? (s.id === '7f21a9' ? `${Math.abs(d).toFixed(1)} percentage points` : ar ? `${Math.abs(d)} نقطة مئوية` : `${Math.abs(d)} pp`) : fmtV(I, Math.abs(d), ar);
      const c: Fact = { v: dv, period: `${s.p} → ${s.p2}`, country: 'QAT', ind: I, computed: 'difference' };
      if (s.id === '7f21a9')
        return {
          q: "How did tourism's share of GDP change between Q4 2023 and Q4 2024?",
          parts: ['Tourism contributed ', { v: b.v, n: 1 }, ' of GDP in Q4 2024, up from ', { v: a.v, n: 2 }, ' in Q4 2023, an increase of ', { v: c.v, n: 3, computed: true }, '.'],
          facts: [b, a, c],
          periods: [s.p!, s.p2!],
          countries: ['QAT'],
        };
      return ar
        ? {
            q: `كيف تغير ${I.ar} بين ${pLabel(s.p!, true)} و${pLabel(s.p2!, true)}؟`,
            parts: [`بلغ ${I.ar} `, { v: b.v, n: 1 }, ` في ${pLabel(s.p2!, true)} مقارنة بـ `, { v: a.v, n: 2 }, ` في ${pLabel(s.p!, true)}، ${up ? 'بزيادة' : 'بانخفاض'} قدرها `, { v: c.v, n: 3, computed: true }, '.'],
            facts: [b, a, c],
            periods: [s.p!, s.p2!],
            countries: ['QAT'],
          }
        : {
            q: [`How did ${I.short} change between ${pLabel(s.p!)} and ${pLabel(s.p2!)}?`, `Change in ${I.short} from ${pLabel(s.p!)} to ${pLabel(s.p2!)}`][pick % 2],
            parts: [`${cap(I.short)} was `, { v: b.v, n: 1 }, ` in ${pLabel(s.p2!)}, ${up ? 'up' : 'down'} from `, { v: a.v, n: 2 }, ` in ${pLabel(s.p!)}, a change of `, { v: c.v, n: 3, computed: true }, '.'],
            facts: [b, a, c],
            periods: [s.p!, s.p2!],
            countries: ['QAT'],
          };
    }
    case 'compare': {
      const P = I.peers!;
      const qa: Fact = { v: fmtV(I, I.vals[P.period][0], ar), period: P.period, country: 'QAT', ind: I, row: I.vals[P.period][1] };
      const pv: Fact = { v: fmtV(I, P.v[s.country!], ar), period: P.period, country: s.country!, ind: I, row: I.vals[P.period][1] + 600 };
      const [cEn, cAr] = COUNTRY[s.country!];
      if (s.id === '7f20c8')
        return {
          q: s.q!,
          parts: [
            'Consumer price inflation in Qatar and Oman has followed a similar path since 2020. Both rose through 2022 as import and housing costs increased, then eased as global price pressures faded. In ',
            pLabel(P.period),
            ' inflation was ',
            { v: qa.v, n: 1 },
            ' in Qatar and ',
            { v: pv.v, n: 2 },
            ' in Oman, so Qatar remained slightly higher. The gap has narrowed over the last two years, and both countries are now within their usual ranges.',
          ],
          facts: [qa, pv],
          periods: [P.period],
          countries: ['QAT', s.country!],
        };
      return ar
        ? {
            q: s.q ?? `قارن ${I.ar} بين قطر و${cAr} في ${pLabel(P.period, true)}`,
            parts: [`في ${pLabel(P.period, true)} بلغ ${I.ar} `, { v: qa.v, n: 1 }, ' في قطر مقابل ', { v: pv.v, n: 2 }, ` في ${cAr}.`],
            facts: [qa, pv],
            periods: [P.period],
            countries: ['QAT', s.country!],
          }
        : {
            q: s.q ?? `Compare ${I.short} between Qatar and ${cEn} in ${pLabel(P.period)}`,
            parts: [`In ${pLabel(P.period)}, ${I.short} was `, { v: qa.v, n: 1 }, ' in Qatar and ', { v: pv.v, n: 2 }, ` in ${cEn}.`],
            facts: [qa, pv],
            periods: [P.period],
            countries: ['QAT', s.country!],
          };
    }
    case 'max': {
      const best = periodsOf(I).reduce((a, b) => (I.vals[b][0] > I.vals[a][0] ? b : a));
      const x = f(best);
      return { q: s.q!, parts: [`The highest tourism contribution since 2022 was `, { v: x.v, n: 1 }, ` of GDP, in ${pLabel(best)}.`], facts: [x], periods: [`2022-Q1 → ${latestOf(I)}`], countries: ['QAT'] };
    }
    case 'latest': {
      const p = latestOf(I);
      const x = f(p);
      return ar
        ? { q: s.q ?? `ما هي آخر قيمة لـ${I.ar}؟`, parts: [`آخر قيمة لـ${I.ar} هي `, { v: x.v, n: 1 }, ` (${pLabel(p, true)}).`], facts: [x], periods: [p], countries: ['QAT'] }
        : { q: s.q ?? [`What is the latest ${I.short}?`, `Latest ${I.short}`][pick % 2], parts: [`The latest ${I.short} is `, { v: x.v, n: 1 }, ` (${pLabel(p)}).`], facts: [x], periods: [p], countries: ['QAT'] };
    }
    default: {
      const x = f(s.p!);
      if (s.ind === 'compet') return { q: s.q!, parts: ['جاءت قطر في المرتبة ', { v: x.v, n: 1 }, ' في مؤشر التنافسية الوطني لعام 2024.'], facts: [x], periods: [s.p!], countries: ['QAT'] };
      return ar
        ? { q: s.q ?? `ما هي قيمة ${I.ar} في ${pLabel(s.p!, true)}؟`, parts: [`بلغت قيمة ${I.ar} `, { v: x.v, n: 1 }, ` في ${pLabel(s.p!, true)}.`], facts: [x], periods: [s.p!], countries: ['QAT'] }
        : {
            q: s.q ?? [`What was ${I.short} in ${pLabel(s.p!)}?`, `${cap(I.short)} in ${pLabel(s.p!)}`, `Show ${I.short} for ${pLabel(s.p!)}`][pick % 3],
            parts: [`${cap(I.short)} was `, { v: x.v, n: 1 }, ` in ${pLabel(s.p!)}.`],
            facts: [x],
            periods: [s.p!],
            countries: ['QAT'],
          };
    }
  }
}

const json = (o: unknown) => JSON.stringify(o, null, 2);

function stagesFor(s: Spec, ctx: { q: string; answer: string; facts: Fact[]; indName: string; periods: string[]; countries: string[] }): PipelineStage[] {
  const T = s.lat;
  const st: Omit<PipelineStage, 'startS'>[] = [];
  const intent = (computation: string): Omit<PipelineStage, 'startS'> => ({
    stage: 'understanding',
    name: 'Intent Agent',
    kind: 'ai',
    agentId: 'intent-agent',
    durS: 0.38 + ((s.pick ?? 3) % 9) / 100,
    detail: 'AI · Qwen2.5-7B-Instruct',
    note: 'Extracted structured fields from the question.',
    input: JSON.stringify(ctx.q),
    output: json({ indicator: ctx.indName === '—' ? null : ctx.indName, countries: ctx.countries, periods: ctx.periods, frequency: s.ind ? INDS[s.ind].freq : null, computation }),
  });
  const router = (path: string): Omit<PipelineStage, 'startS'> => ({ stage: 'routed', name: 'Pipeline router', kind: 'code', durS: 0.01, detail: 'Code', note: `${cap(path)} path selected from computation type.`, input: JSON.stringify({ computation: COMPUTATION[s.kind] }), output: JSON.stringify({ path }) });
  const resolvers = (score: number): Omit<PipelineStage, 'startS'> => ({
    stage: 'resolved',
    name: 'Resolvers',
    kind: 'code',
    durS: 0.09,
    detail: 'Code · bge-m3 match',
    note: score < 0.7 ? 'Country and periods resolved. Indicator match below 0.70 confidence.' : 'Country, periods and indicator resolved.',
    input: JSON.stringify({ indicator: ctx.indName }),
    output: json({ country: ctx.countries[0] ?? 'QAT', periods: ctx.periods, indicator_candidates: 5, best_score: score }),
  });
  const picker = (picked: string | null, code?: string): Omit<PipelineStage, 'startS'> => ({
    stage: 'resolved',
    name: 'Indicator Picker',
    kind: 'ai',
    agentId: 'indicator-picker',
    durS: 1.14,
    detail: 'AI · Qwen2.5-72B-Instruct · fallback',
    note: picked ? 'Picked one catalogue name from 5 candidates.' : 'None of the 5 candidates matched the question. Returned NONE.',
    input: '{ "candidates": [5 names from v2026.11.3] }',
    output: picked ? `{ "picked": "${picked}",\n  "code": "${code}" }` : '{ "picked": "NONE" }',
  });
  const skippedTemplate = (): Omit<PipelineStage, 'startS'> => ({ stage: 'replace', name: 'Template answer', kind: 'code', durS: 0, detail: 'Code · skipped', note: 'Not used. Verification passed.', input: '—', output: '—', skipped: true });
  const refusal = (why: string): Omit<PipelineStage, 'startS'> => ({ stage: 'replace', name: 'Refusal template', kind: 'code', durS: 0.01, detail: 'Code', note: why, input: JSON.stringify({ language: s.lang.toLowerCase() }), output: JSON.stringify(ctx.answer) });
  const factsJson = json({ facts: ctx.facts.map((f) => (f.computed ? { [`${f.computed}_pp`]: parseFloat(f.v) } : { period: f.period, country: f.country, value: parseFloat(f.v.replace('−', '-')), unit: f.ind.unit.trim() || null })) });
  const I = s.ind ? INDS[s.ind] : undefined;

  switch (s.kind) {
    case 'article':
      st.push(intent('article'), router('article'), {
        stage: 'retrieving',
        name: 'Article retriever',
        kind: 'code',
        durS: 0.34,
        detail: 'Code · bge-m3 search over SCEAI articles',
        note: 'Retrieved 2 passages above the 0.62 relevance threshold.',
        input: JSON.stringify({ query: ctx.q }),
        output: json({ passages: 2, top_score: 0.81 }),
      });
      st.push({ stage: 'composing', name: 'Article Agent', kind: 'ai', agentId: 'article-agent', durS: 0, detail: 'AI · Qwen2.5-72B-Instruct · streaming', note: 'Answered from the retrieved passages only.', input: '{ "passages": [2], "language": "' + s.lang.toLowerCase() + '" }', output: JSON.stringify(ctx.answer) });
      break;
    case 'oos':
      st.push(intent('out_of_scope'), router('refusal'), refusal('The question is outside SCEAI indicators and reports.'));
      break;
    case 'none':
      st.push(intent('single_value'), router('numeric'), resolvers(0.41), picker(null), refusal('No catalogue indicator matched, so the pipeline refused instead of guessing.'));
      break;
    case 'chat':
      st.push(intent('chat'), router('chat'), { stage: 'composing', name: 'Composer Agent', kind: 'ai', agentId: 'composer-agent', durS: 0, detail: 'AI · Qwen2.5-72B-Instruct · chat mode', note: 'Replied in chat mode. No data was read.', input: JSON.stringify({ mode: 'chat', language: s.lang.toLowerCase() }), output: JSON.stringify(ctx.answer) });
      break;
    case 'read':
      st.push(
        { stage: 'routed', name: 'Read endpoint', kind: 'code', durS: 0.01, detail: 'Code', note: '"Read this for me" request from a chart.', input: JSON.stringify({ endpoint: 'read', code: I?.code }), output: JSON.stringify({ path: 'reader' }) },
        { stage: 'retrieving', name: 'Compute engine', kind: 'code', durS: 0.05, detail: 'Code · reads Indicators DB', note: 'Read the series shown in the chart.', input: JSON.stringify({ code: I?.code, op: 'series' }), output: json({ observations: periodsOf(I!).length }) },
        { stage: 'composing', name: 'Reader Agent', kind: 'ai', agentId: 'reader-agent', durS: 0, detail: 'AI · Qwen2.5-72B-Instruct', note: 'Explained the chart in plain language.', input: JSON.stringify({ code: I?.code, language: s.lang.toLowerCase() }), output: JSON.stringify(ctx.answer) },
      );
      break;
    default: {
      const tmpl = s.kind === 'template';
      const usePicker = !!s.picker;
      st.push(intent(COMPUTATION[s.kind]), router('numeric'), resolvers(usePicker ? 0.58 : 0.86));
      if (usePicker) st.push(picker(I!.name, I!.code));
      st.push({
        stage: 'retrieving',
        name: 'Compute engine',
        kind: 'code',
        durS: 0.04,
        detail: 'Code · reads Indicators DB',
        note: `Read ${ctx.facts.filter((f) => !f.computed).length} observation${ctx.facts.filter((f) => !f.computed).length > 1 ? 's' : ''}${ctx.facts.some((f) => f.computed) ? ' and computed the difference' : ''}.`,
        input: json({ code: I!.code, op: COMPUTATION[s.kind], periods: ctx.periods }),
        output: factsJson,
      });
      st.push({ stage: 'composing', name: 'Composer Agent', kind: 'ai', agentId: 'composer-agent', durS: 0, detail: 'AI · Qwen2.5-72B-Instruct · streaming', note: 'Wrote the answer from the computed facts only.', input: JSON.stringify({ facts: [ctx.facts.length], language: s.lang.toLowerCase() }), output: tmpl ? JSON.stringify('Qatar ranks first among GCC countries, ahead of the UAE and Oman.') : JSON.stringify(ctx.answer) });
      if (tmpl) {
        st.push(
          { stage: 'verifying', name: 'Numeric verifier', kind: 'code', durS: 0.01, detail: 'Code', note: 'The composed wording made a claim that is not in the computed facts.', input: '{ "claims_in_answer": ["rank 1 of 6"] }', output: '{ "matched": 0, "unmatched": 1, "result": "fail" }', failed: true },
          { stage: 'replace', name: 'Template answer', kind: 'code', durS: 0.02, detail: 'Code', note: 'Verification failed, so the raw fact was returned in a fixed template.', input: factsJson, output: JSON.stringify(ctx.answer) },
        );
      } else {
        const nums = ctx.facts.map((f) => f.v.replace(/[^\d.−-]/g, '').replace('−', '-'));
        st.push({ stage: 'verifying', name: 'Numeric verifier', kind: 'code', durS: 0.01, detail: 'Code', note: 'Every number in the answer matched a computed fact.', input: JSON.stringify({ numbers_in_answer: nums }), output: JSON.stringify({ matched: nums.length, unmatched: 0, result: 'pass' }).replace(/,/g, ', ').replace(/:/g, ': ').replace('{', '{ ').replace(/}$/, ' }') });
        st.push(skippedTemplate());
      }
    }
  }
  // Fill the AI composing stage (or the longest) with whatever time is left.
  const fixed = st.reduce((a, x) => a + x.durS, 0) + 0.01 * (st.length - 1);
  const fill = st.find((x) => x.stage === 'composing') ?? st.find((x) => x.kind === 'ai')!;
  fill.durS = Math.max(0.05, fill.durS + (T - fixed));
  let t = 0;
  return st.map((x) => {
    const out = { ...x, startS: Math.round(t * 100) / 100 };
    t += x.durS + (x.durS === 0 ? 0 : 0.01);
    return out;
  });
}

/** Stages of message 7f21a9 exactly as in design-ref (conv.html / app.js ST). */
const DESIGN_STAGES: PipelineStage[] = [
  { stage: 'understanding', name: 'Intent Agent', kind: 'ai', agentId: 'intent-agent', startS: 0, durS: 0.42, detail: 'AI · Qwen2.5-7B-Instruct', note: 'Extracted structured fields from the question.', input: '"How did tourism\'s share of GDP change between\n Q4 2023 and Q4 2024?"', output: '{\n  "indicator": "tourism share of GDP",\n  "countries": ["QAT"],\n  "periods": ["2023-Q4", "2024-Q4"],\n  "frequency": "Q",\n  "computation": "period_comparison"\n}' },
  { stage: 'routed', name: 'Pipeline router', kind: 'code', startS: 0.42, durS: 0.01, detail: 'Code', note: 'Numeric path selected from computation type.', input: '{ "computation": "period_comparison" }', output: '{ "path": "numeric" }' },
  { stage: 'resolved', name: 'Resolvers', kind: 'code', startS: 0.43, durS: 0.09, detail: 'Code · bge-m3 match', note: 'Country and periods resolved. Indicator match below 0.70 confidence.', input: '{ "indicator": "tourism share of GDP" }', output: '{\n  "country": "QAT",\n  "periods": ["2023-Q4", "2024-Q4"],\n  "indicator_candidates": 5,\n  "best_score": 0.58\n}' },
  { stage: 'resolved', name: 'Indicator Picker', kind: 'ai', agentId: 'indicator-picker', startS: 0.52, durS: 1.14, detail: 'AI · Qwen2.5-72B-Instruct · fallback', note: 'Picked one catalogue name from 5 candidates.', input: '{ "candidates": [5 names from v2026.11.3] }', output: '{ "picked": "Sector Contribution to GDP (Tourism)",\n  "code": "IND-TOU-014" }' },
  { stage: 'retrieving', name: 'Compute engine', kind: 'code', startS: 1.67, durS: 0.04, detail: 'Code · reads Indicators DB', note: 'Read 2 observations and computed the difference.', input: '{ "code": "IND-TOU-014",\n  "op": "difference",\n  "periods": ["2023-Q4", "2024-Q4"] }', output: '{\n  "facts": [\n    { "period": "2024-Q4", "value": 8.8, "unit": "%" },\n    { "period": "2023-Q4", "value": 6.9, "unit": "%" },\n    { "difference_pp": 1.9 }\n  ]\n}' },
  { stage: 'composing', name: 'Composer Agent', kind: 'ai', agentId: 'composer-agent', startS: 1.71, durS: 2.38, detail: 'AI · Qwen2.5-72B-Instruct · streaming', note: 'Wrote the answer from the computed facts only.', input: '{ "facts": [3], "language": "en" }', output: '"Tourism contributed 8.8% of GDP in Q4 2024, up from\n 6.9% in Q4 2023, an increase of 1.9 percentage points."' },
  { stage: 'verifying', name: 'Numeric verifier', kind: 'code', startS: 4.09, durS: 0.01, detail: 'Code', note: 'Every number in the answer matched a computed fact.', input: '{ "numbers_in_answer": ["8.8", "6.9", "1.9"] }', output: '{ "matched": 3, "unmatched": 0, "result": "pass" }' },
  { stage: 'replace', name: 'Template answer', kind: 'code', startS: 4.1, durS: 0, detail: 'Code · skipped', note: 'Not used. Verification passed.', input: '—', output: '—', skipped: true },
];

const FOLLOW: Record<Lang, { num: string[]; art: string[] }> = {
  EN: { num: ['How does this compare with the target?', 'Show the trend over the last five years', 'How does Qatar compare with GCC peers?'], art: ['Which indicators track this?', 'Summarise the latest progress'] },
  AR: { num: ['كيف يقارن هذا بالمستهدف؟', 'اعرض الاتجاه خلال السنوات الخمس الماضية', 'كيف تقارن قطر بدول الخليج؟'], art: ['ما المؤشرات التي تقيس ذلك؟', 'لخص آخر تقدم'] },
};

const POS_COMMENTS = [null, null, 'Clear and quick', 'Exactly what I needed', 'Useful, thanks', 'Good to see the source', null, 'واضح ومفيد', 'شكرا'];

function build(s: Spec, sess: { id: string; pos: number; len: number }): ChatMessage {
  const ar = s.lang === 'AR';
  const type = TYPE_OF[s.kind];
  const I = s.ind ? INDS[s.ind] : undefined;
  let q = s.q ?? '';
  let parts: MsgPart[] = [];
  let facts: Fact[] = [];
  let periods: string[] = [];
  let countries: string[] = [];
  const pick = s.pick ?? 0;
  const passages: ChatMessage['passages'] = [];

  if (type === 'Numeric') {
    const n = numeric(s);
    q = n.q;
    parts = n.parts;
    facts = n.facts;
    periods = n.periods;
    countries = n.countries;
  } else if (s.kind === 'article') {
    const [tEn, tAr] = TOPICS[s.topic ?? 0];
    q =
      s.q ??
      (ar
        ? [`ما الذي تقوله التقارير عن ${tAr}؟`, `لخص ما تقوله استراتيجية التنمية الوطنية عن ${tAr}`, `ما هي أهم المبادرات في ${tAr}؟`][pick % 3]
        : [`What does the National Development Strategy say about ${tEn}?`, `Summarise the latest SCEAI report on ${tEn}`, `What are the main initiatives for ${tEn}?`][pick % 3]);
    parts = [
      ar
        ? `تتناول استراتيجية التنمية الوطنية ${tAr} كأولوية، وتحدد مبادرات تقودها الجهات المعنية وتتابع التقدم من خلال مؤشرات المجلس. (المصادر 1، 2)`
        : `The National Development Strategy treats ${tEn} as a priority. It sets out initiatives led by the relevant ministries and tracks progress through SCEAI indicators. (Sources 1, 2)`,
    ];
    const d1 = DOCS[pick % DOCS.length];
    const d2 = DOCS[(pick + 1) % DOCS.length];
    passages.push({ position: 1, doc: d1[0], section: d1[1] }, { position: 2, doc: d2[0], section: d2[1] });
  } else if (s.kind === 'template') {
    const p = latestOf(I!);
    const x: Fact = { v: fmtV(I!, I!.vals[p][0], ar), period: p, country: 'QAT', ind: I!, row: I!.vals[p][1] };
    facts = [x];
    periods = [p];
    countries = ['QAT'];
    parts = ar
      ? [`هذه البيانات المتاحة عن ${I!.ar}: `, { v: x.v, n: 1 }, ` في ${pLabel(p, true)}. لم أتمكن من صياغة إجابة كاملة اجتازت التحقق.`]
      : [`Here is the data I found for ${I!.name}: `, { v: x.v, n: 1 }, ` in ${pLabel(p)}. I could not word a complete answer that passed verification.`];
  } else if (s.kind === 'oos') {
    q = s.q ?? OOS[s.lang][pick % OOS[s.lang].length];
    parts = [ar ? 'يمكنني الإجابة فقط عن الأسئلة المتعلقة بمؤشرات المجلس والتقارير المنشورة.' : 'I can only answer questions about SCEAI indicators and published reports.'];
  } else if (s.kind === 'none') {
    q = s.q ?? NONE_Q[s.lang][pick % NONE_Q[s.lang].length];
    parts = [ar ? 'لم أجد مؤشرا لذلك في كتالوج المجلس.' : 'I could not find an indicator for that in the SCEAI catalogue.'];
  } else if (s.kind === 'chat') {
    q = s.q ?? CHAT_Q[s.lang][pick % CHAT_Q[s.lang].length];
    parts = [
      ar
        ? 'يمكنني الإجابة عن أسئلة حول مؤشرات المجلس وقيمها وتغيراتها ومقارنتها بالمستهدفات، وتلخيص التقارير المنشورة.'
        : 'I can answer questions about SCEAI indicators — values, changes over time, comparisons with targets and GCC peers — and summarise published reports.',
    ];
  } else if (s.kind === 'read') {
    const p = latestOf(I!);
    const x: Fact = { v: fmtV(I!, I!.vals[p][0], ar), period: p, country: 'QAT', ind: I!, row: I!.vals[p][1] };
    facts = [x];
    periods = periodsOf(I!);
    countries = ['QAT'];
    q = ar ? `اقرأ لي هذا: رسم ${I!.ar}` : `Read this for me: ${I!.short} chart`;
    parts = ar
      ? [`يعرض هذا الرسم ${I!.ar} عبر الفترات الأخيرة. آخر قيمة هي `, { v: x.v, n: 1 }, ` في ${pLabel(p, true)}.`]
      : [`This chart shows ${I!.short} over recent periods. The latest value is `, { v: x.v, n: 1 }, ` in ${pLabel(p)}.`];
  }

  const answer = parts.map((p) => (typeof p === 'string' ? p : p.v)).join('');
  const indName = I && type !== 'Refusal' && type !== 'General chat' ? I.name : '—';
  const stages = s.id === '7f21a9' ? DESIGN_STAGES : stagesFor(s, { q, answer, facts, indName, periods, countries });

  const citations: Citation[] = facts.map((f, i) =>
    f.computed
      ? { message_id: s.id, position: i + 1, source_table: 'computed', record_id: null, indicator: `Difference of 1 and 2`, data_source: 'Computed', period_label: `${f.period.split(' → ')[0]} → ${f.period.split(' → ')[1]}`, country: f.country, value: f.v.replace(' percentage points', ' pp'), source: 'Computed', produced_by: 'compute_engine · difference', catalogue_version: 'v2026.11.3', verifier: 'Matched' }
      : {
          message_id: s.id,
          position: i + 1,
          source_table: 'published_data_points',
          record_id: `pdp_${f.row}`,
          indicator: f.ind.name,
          data_source: f.country === 'QAT' ? f.ind.org : 'GCC-Stat',
          period_label: f.period,
          country: f.country,
          value: f.v,
          source: f.country === 'QAT' ? `${f.ind.org} · ${f.ind.file} row ${f.row}` : `GCC-Stat · gcc_peers.csv row ${f.row}`,
          produced_by: 'compute_engine',
          catalogue_version: 'v2026.11.3',
          verifier: 'Matched',
        },
  );

  const neg = NEG_FEEDBACK[s.id];
  const ageH = s.rel ? hoursOf(s.rel) : s.ageH;
  const askedMs = NOW - ageH * 3_600_000;
  const feedback: Feedback | null =
    s.fb === 0
      ? null
      : {
          feedback_id: `fb_${s.id}`,
          message_id: s.id,
          session_id: sess.id,
          rating: neg ? neg.rating : 4 + (pick % 2),
          comment: neg ? (neg.comment === '—' ? 'Did not answer the question' : neg.comment) : POS_COMMENTS[pick % POS_COMMENTS.length],
          question: q,
          answer,
          created_at: new Date(askedMs + 90_000).toISOString(),
          helpful: s.fb === 1,
          reason: neg?.reason,
          status: neg?.status,
          rel: neg?.rel ?? relFrom(ageH),
        };
  if (neg && feedback && neg.comment === '—') feedback.comment = null;

  const followUps =
    s.id === '7f21a9'
      ? ['How does this compare with the 7.6% target?', 'Show the quarterly trend since 2022', 'Which sectors grew faster?']
      : type === 'Numeric'
        ? FOLLOW[s.lang].num
        : type === 'Article'
          ? FOLLOW[s.lang].art
          : [];

  const und = {
    computation: COMPUTATION[s.kind],
    indicator: indName,
    viaPicker: !!s.picker,
    countries: countries.join(', ') || '—',
    periods: periods.join(', ') || '—',
    frequency: I && indName !== '—' ? I.freq : '—',
  };
  if (s.kind === 'none') Object.assign(und, { indicator: 'NONE', viaPicker: true });

  const nums = citations.length;
  const verifier: ChatMessage['verifier'] =
    type === 'Numeric'
      ? { tone: 'ok', text: `Numeric verifier passed · ${nums} of ${nums} numbers match computed facts` }
      : type === 'Template fallback'
        ? { tone: 'warn', text: 'Numeric verifier rejected the composed answer · template answer returned' }
        : type === 'Explanation'
          ? { tone: 'neutral', text: 'Reader answers are not checked by the numeric verifier' }
          : { tone: 'neutral', text: 'No numbers to verify in this answer' };

  const composer = { Numeric: 'Composer Agent', 'Template fallback': 'Template answer', Article: 'Article Agent', Refusal: 'Refusal template', 'General chat': 'Composer Agent', Explanation: 'Reader Agent' }[type];

  return {
    message_id: s.id,
    session_id: sess.id,
    asked_at: new Date(askedMs).toISOString(),
    endpoint: s.kind === 'read' ? 'read' : 'chat',
    language: ar ? 'ar' : 'en',
    question: q,
    answer,
    answered: type !== 'Refusal',
    answer_shape: SHAPE[s.kind],
    indicator: type === 'Numeric' || type === 'Template fallback' ? I!.name : null,
    period_label: type === 'Numeric' || type === 'Template fallback' ? periods.join(' → ') : null,
    verified: type === 'Numeric' ? true : type === 'Template fallback' ? false : null,
    readable: type === 'Refusal' ? null : true,
    latency_ms: Math.round(s.lat * 1000),
    user: s.user,
    lang: s.lang,
    rel: s.rel ?? relFrom(ageH),
    abs: fmtAbs(askedMs),
    answerType: type,
    tone: TONE_OF[type],
    path: pathOf(s),
    latency: fmtLat(s.lat),
    sessionPos: sess.pos,
    sessionLen: sess.len,
    channel: s.user.startsWith('api:') ? 'Dashboards API' : 'Ask AI web chat',
    composer,
    answerParts: parts,
    followUps,
    understanding: und,
    verifier,
    stages,
    citations,
    passages,
    feedback,
  };
}

function buildAll(): ChatMessage[] {
  const specs = [...DESIGN_SPECS, ...generatedSpecs()];
  // Sessions: consecutive messages by the same user share a session.
  const r = rng(4019);
  const sessions: { id: string; pos: number; len: number }[] = [];
  let i = 0;
  while (i < specs.length) {
    let j = i + 1;
    while (j < specs.length && specs[j].user === specs[i].user && j - i < 6) j++;
    const id = `s_${Math.floor(r() * 0xffffff).toString(16).padStart(6, '0')}`;
    const len = j - i;
    for (let k = i; k < j; k++) sessions[k] = { id, pos: len - (k - i), len };
    i = j;
  }
  sessions[0] = { id: 's_4c19e2', pos: 3, len: 5 };
  return specs.map((s, k) => build(s, sessions[k]));
}

export const MESSAGES: ChatMessage[] = buildAll();
export const messageById = (id: string | undefined) => MESSAGES.find((m) => m.message_id === id);

/** Negative feedback queue (feedback.html), newest first. */
export const FEEDBACK_QUEUE = MESSAGES.filter((m) => m.feedback && !m.feedback.helpful).sort((a, b) => Date.parse(b.asked_at) - Date.parse(a.asked_at));

export const CONV_SUMMARY = [
  { k: 'Messages · 7 d', v: '508', c: '#8C8487' },
  { k: 'Numeric', v: '61%', c: 'var(--success)' },
  { k: 'Article', v: '18%', c: 'var(--info)' },
  { k: 'Refusal / chat', v: '17%', c: '#A8A0A3' },
  { k: 'Template fallback', v: '8', c: 'var(--warning)' },
  { k: 'Arabic', v: '38%', c: '#C8B49A' },
  { k: 'Negative feedback', v: '7', c: 'var(--danger)' },
];

export const FEEDBACK_SUMMARY = [
  { k: 'Negative · 7 d', v: '7', vc: 'var(--danger-fg)' },
  { k: 'Positive · 7 d', v: '86', vc: 'var(--success-fg)' },
  { k: 'Negative rate', v: '7.5%', vc: 'var(--text-strong)' },
  { k: 'Open', v: '4', vc: 'var(--text-strong)' },
  { k: 'Median time to triage', v: '5 h', vc: 'var(--text-strong)' },
];

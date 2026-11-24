/**
 * Data for the AI Agent Tools / Schedules & Events / AI Confidence Hub screens
 * that is not part of the agent factory (agents, runs, schedules and the MCP
 * registry live in `agentFactory.ts`):
 *
 * - scheduled reports and their delivery history (prototype `reports()`),
 * - the report preview figures,
 * - Ask AI answers with grounding / citation coverage (agentHub `confov` / `evidence`),
 * - evidence quality by agent and the feedback trend,
 * - negative feedback items (prototype `more()` · `fbRows`, `fbSum`).
 *
 * Reports are editable (session store); the rest is read-only demo data.
 */
import { createStore } from '@/engine/store';
import type { DsStatus } from '@/engine/types';
import type { AfTenantKey } from './agentFactory';

// ============================================================ scheduled reports

/** [key, name, description] */
export const REPORT_SECTIONS: [string, string, string][] = [
  ['overview', 'Overview KPIs', 'Jobs, success rate, p95, active agents'],
  ['jobs', 'Agent jobs', 'Daily volume by status and agent'],
  ['ask', 'Ask AI usage', 'Messages, answer types, languages'],
  ['feedback', 'User feedback', 'Helpful vs not helpful, open items'],
  ['attention', 'Needs attention', 'Failures, timeouts, MCP issues'],
  ['oxford', 'Oxford Economics usage', 'External calls and leak-guard results'],
  ['access', 'Access changes', 'New users, grants and tokens'],
  ['cost', 'Model usage', 'Requests and tokens per model'],
];

export type ReportFreq = 'daily' | 'weekly' | 'monthly';
export type ReportRange = 'last' | 'mtd' | '30';
export type ReportFmt = 'pdf' | 'xlsx' | 'both';
export type ReportDel = 'email' | 'teams' | 'both';

export interface Report {
  id: string;
  n: string;
  owner: string;
  sec: string[];
  freq: ReportFreq;
  day: string;
  time: string;
  range: ReportRange;
  fmt: ReportFmt;
  del: ReportDel;
  rcp: string[];
  next: string;
  /** last delivery pill */
  p: DsStatus;
  pl: string;
  on: boolean;
}

/** Delivery history row: [sent, report, period, recipients, delivery, status, label, error, action] */
export type DeliveryRow = [string, string, string, string, string, DsStatus, string, string, string];

const REPORTS_SCEAI: Report[] = [
  { id: 'r1', n: 'Weekly SCEAI summary', owner: 'sceai_admin', sec: ['overview', 'jobs', 'ask', 'feedback', 'attention'], freq: 'weekly', day: 'Sunday', time: '07:00', range: 'last', fmt: 'pdf', del: 'email', rcp: ['sceai_admin', 'tenant_admins (group)', 'm.alkuwari', 'director.office@sceai.gov.qa'], next: 'Sun 23 Nov, 07:00', p: 'approved', pl: 'Delivered', on: true },
  { id: 'r2', n: 'Monthly leadership brief', owner: 'sceai_admin', sec: ['overview', 'ask', 'feedback'], freq: 'monthly', day: '1st', time: '08:00', range: 'mtd', fmt: 'pdf', del: 'both', rcp: ['leadership (group)', 'director.office@sceai.gov.qa', 'sceai_admin', 'm.alkuwari', 'r.haddad', 'n.saleh', 'sceai_analyst', 'tenant_admins (group)', 'strategy@sceai.gov.qa'], next: 'Mon 1 Dec, 08:00', p: 'approved', pl: 'Delivered', on: true },
  { id: 'r3', n: 'Daily operations digest', owner: 'm.alkuwari', sec: ['attention', 'jobs', 'oxford'], freq: 'daily', day: '', time: '07:00', range: 'last', fmt: 'pdf', del: 'teams', rcp: ['ai_team (Teams channel)'], next: 'Tomorrow, 07:00', p: 'rejected', pl: 'Failed', on: true },
  { id: 'r4', n: 'Access changes · audit', owner: 'sceai_admin', sec: ['access'], freq: 'monthly', day: 'Last day', time: '17:00', range: '30', fmt: 'xlsx', del: 'email', rcp: ['sceai_admin', 'security@sceai.gov.qa'], next: 'Sun 30 Nov, 17:00', p: 'draft', pl: 'Paused', on: false },
];

const HISTORY_SCEAI: DeliveryRow[] = [
  ['Sun 16 Nov, 07:00', 'Weekly SCEAI summary', '9 – 15 Nov', '4', 'Email', 'approved', 'Delivered', '', 'View PDF'],
  ['Wed 19 Nov, 07:00', 'Daily operations digest', '18 Nov', '1', 'Teams', 'rejected', 'Failed', 'Teams connector timed out · retried twice', 'Retry'],
  ['Tue 18 Nov, 07:00', 'Daily operations digest', '17 Nov', '1', 'Teams', 'approved', 'Delivered', '', 'View PDF'],
  ['Sat 1 Nov, 08:00', 'Monthly leadership brief', 'October 2026', '9', 'Email + Teams', 'approved', 'Delivered', '', 'View PDF'],
  ['Sun 9 Nov, 07:00', 'Weekly SCEAI summary', '2 – 8 Nov', '4', 'Email', 'hold', 'Partly delivered', '1 recipient bounced', 'Details'],
];

export interface ReportsData {
  reports: Record<AfTenantKey, Report[]>;
  history: Record<AfTenantKey, DeliveryRow[]>;
}

export const reportsInit = (): ReportsData => ({
  reports: { sceai: structuredClone(REPORTS_SCEAI), econ: [], sandbox: [] },
  history: { sceai: structuredClone(HISTORY_SCEAI), econ: [], sandbox: [] },
});

export const reportsStore = createStore<ReportsData>(reportsInit);

/** Report preview (page 1 of the PDF): KPI tiles [label, value, delta, colour]. */
export const REPORT_KPI: [string, string, string, string][] = [
  ['Agent jobs', '50', '+12% vs prior week', '#17633F'],
  ['Success rate', '84.8%', '−3.1 pp', '#A12B23'],
  ['Ask AI messages', '508', '+21%', '#17633F'],
  ['Arabic share', '38%', '+4 pp', '#5C5457'],
];
/** Agent jobs by day: [succeeded, failed, running, label] */
export const REPORT_DAYS: [number, number, number, string][] = [
  [5, 1, 0, 'Thu'], [7, 1, 0, 'Fri'], [4, 0, 0, 'Sat'], [6, 2, 0, 'Sun'], [8, 1, 0, 'Mon'], [7, 1, 0, 'Tue'], [9, 2, 3, 'Today'],
];
export const REPORT_TOP_Q: [string, number][] = [['Tourism share of GDP', 41], ['Consumer price inflation', 33], ['Food reserve coverage', 22], ['Non-hydrocarbon exports', 19], ['Real GDP growth (Oxford)', 15]];
export const REPORT_ATTENTION: [string, string][] = [['2 jobs exceeded the 180 s timeout', '#C0352B'], ['Oxford MCP degraded · 2 × 502', '#B7791F'], ['8 template fallbacks from the verifier', '#B7791F'], ['1 document failed ingestion', '#B7791F']];

// ============================================================ AI Confidence Hub

/**
 * Ask AI answers (SCEAI): [id, question, language, answer type, feedback (1 helpful · 0 none · -1 incorrect),
 * when, grounding (0–1 or null), citations, supporting sources, detected problems, workflow run]
 */
export type AskAnswerRow = [string, string, string, string, number, string, number | null, string, string[], string[], string];

export const ASK_ANSWERS: Partial<Record<AfTenantKey, AskAnswerRow[]>> = {
  sceai: [
    ['7f21a9', "How did tourism's share of GDP change between Q4 2023 and Q4 2024?", 'English', 'Numeric', 1, '12 min ago', 0.96, '3 of 3', ['sceai_indicator_observations · rows 2210, 2214'], [], 'w-8c21f0a3'],
    ['7f21a4', 'ما هو معدل التضخم في قطر في يناير 2019؟', 'Arabic', 'Numeric', 0, '18 min ago', 0.91, '2 of 2', ['sceai_indicator_observations · IND-PRC-002 · 2019-01'], [], ''],
    ['7f2198', 'What does the National Development Strategy say about export diversification?', 'English', 'Article', 1, '25 min ago', 0.88, '4 of 4', ['NDS2_Economic_Diversification.docx · section 3.2', 'NDS2_chapter_04.docx · p. 12'], [], ''],
    ['7f2187', 'Rank GCC countries by non-hydrocarbon export share in 2019', 'English', 'Template fallback', -1, '1 h ago', 0.42, '0 of 2', ['sceai_indicator_observations · IND-TRD-031'], ['Numeric verifier rejected the draft answer', 'Template answer returned', 'User reported: not answered'], ''],
    ['7f2171', 'كم بلغت مساهمة قطاع السياحة في الناتج المحلي في الربع الرابع 2024؟', 'Arabic', 'Numeric', 1, '2 h ago', 0.95, '2 of 2', ['sceai_indicator_observations · IND-TOU-014 · 2024-Q4'], [], ''],
    ['7f2166', 'Hotel occupancy in Al Wakrah last month', 'English', 'Refusal', -1, '3 h ago', null, '—', [], ['No official data found', 'User reported: data exists on the PSA site'], 'w-77d0b912'],
    ['7f215b', 'What is the latest strategic food reserve coverage?', 'English', 'Numeric', 0, '4 h ago', 0.93, '2 of 2', ['sceai_indicator_observations · IND-FDS-007'], [], ''],
    ['7f213e', 'Growth rate of re-exports between 2022 and 2024', 'English', 'Template fallback', -1, '7 h ago', 0.51, '1 of 3', ['sceai_indicator_observations'], ['Figure mismatch: growth rate not reproducible from the data', 'Template answer returned'], ''],
    ['7f2132', 'ما الذي تقوله التقارير عن تنويع الاقتصاد؟', 'Arabic', 'Article', 0, '9 h ago', 0.74, '2 of 3', ['article_2026-11-05_inflation_ar.html', 'NDS2_chapter_02.docx'], ['One statement without a citation'], ''],
    ['7f2127', 'Which quarter had the highest tourism contribution since 2022?', 'English', 'Numeric', 1, '11 h ago', 0.94, '2 of 2', ['sceai_indicator_observations · IND-TOU-014'], [], ''],
  ],
};

/** Evidence quality by agent · last 7 days (SCEAI): [agent, answers, grounded, citation coverage, figure mismatches] */
export const EVIDENCE_BY_AGENT: Partial<Record<AfTenantKey, [string, string, string, string, string][]>> = {
  sceai: [
    ['sceai_indicators_agent', '212', '97.6%', '99.1%', '0'],
    ['sceai_indicators_oxford', '146', '93.8%', '96.4%', '3'],
    ['Article Agent', '61', '95.1%', '97.7%', '—'],
    ['Composer Agent', '57', '98.2%', '100%', '1'],
  ],
};

/** User feedback trend (SCEAI): [day, helpful, reported incorrect] */
export const FEEDBACK_TREND: Partial<Record<AfTenantKey, [string, number, number][]>> = {
  sceai: [['Wed', 12, 1], ['Thu', 14, 0], ['Fri', 9, 1], ['Sat', 7, 0], ['Sun', 15, 2], ['Mon', 13, 1], ['Today', 16, 2]],
};

// ============================================================ Feedback (negative feedback on Ask AI answers)

export interface FeedbackItem {
  /** chat message id */
  id: string;
  q: string;
  lang: 'English' | 'Arabic';
  type: string;
  reason: string;
  cmt: string;
  p: DsStatus;
  pl: 'New' | 'Triaged' | 'Resolved';
  when: string;
}

const FB = (id: string, q: string, lang: string, type: string, reason: string, cmt: string, p: DsStatus, pl: FeedbackItem['pl'], when: string): FeedbackItem => ({ id, q, lang: lang === 'AR' ? 'Arabic' : 'English', type, reason, cmt, p, pl, when });

export const FEEDBACK: Partial<Record<AfTenantKey, FeedbackItem[]>> = {
  sceai: [
    FB('7f2187', 'Rank GCC countries by non-hydrocarbon export share in 2019', 'EN', 'Template fallback', 'Not answered', 'Gave a generic answer instead of the ranking', 'submitted', 'New', '1 h ago'),
    FB('7f2166', 'Hotel occupancy in Al Wakrah last month', 'EN', 'Refusal', 'Missing indicator', 'This data exists on the PSA site', 'submitted', 'New', '3 h ago'),
    FB('7f213e', 'Growth rate of re-exports between 2022 and 2024', 'EN', 'Template fallback', 'Not answered', '—', 'hold', 'Triaged', '7 h ago'),
    FB('7f20f2', 'ما هو ترتيب قطر في مؤشر التنافسية؟', 'AR', 'Numeric', 'Wrong indicator', 'أريد مؤشر التنافسية العالمي وليس المحلي', 'hold', 'Triaged', '1 d ago'),
    FB('7f20c8', 'Compare inflation in Qatar and Oman since 2020', 'EN', 'Numeric', 'Too long', 'Just wanted the table', 'submitted', 'New', '2 d ago'),
    FB('7f2081', 'ما الذي تقوله التقارير عن السياحة الرياضية؟', 'AR', 'Article', 'Wrong source', 'المصدر قديم', 'submitted', 'New', '3 d ago'),
    FB('7f1f9a', 'Latest unemployment rate', 'EN', 'Numeric', 'Wrong period', 'Showed 2023, 2024 is published', 'approved', 'Resolved', '5 d ago'),
  ],
};

/** Feedback summary tiles (SCEAI): [label, value, colour] */
export const FEEDBACK_SUMMARY: Partial<Record<AfTenantKey, [string, string, string][]>> = {
  sceai: [
    ['Negative · 7 d', '7', 'var(--danger-fg)'],
    ['Positive · 7 d', '86', 'var(--success-fg)'],
    ['Negative rate · was 9.1% last week', '7.5%', 'var(--text-strong)'],
    ['Open', '4', 'var(--text-strong)'],
    ['Median time to triage', '5 h', 'var(--text-strong)'],
  ],
};

// ============================================================ Policy Library (no data in v35)

/** Guardrails an agent version can enable (agent configuration, prototype agentHub ~2640). */
export const GUARDRAILS: [string, string][] = [
  ['Prompt injection', 'Detects instructions hidden in questions or retrieved content. Always on.'],
  ['Jailbreak', 'Detects attempts to bypass the agent’s instructions. Always on.'],
  ['Grounding required', 'Refuses statements that retrieved evidence does not support.'],
  ['Numeric verifier', 'Checks every number in an answer against computed facts; a template answer is returned on mismatch.'],
  ['Data-leak guard', 'Stops local indicator codes, values or personal data from reaching external tools.'],
];

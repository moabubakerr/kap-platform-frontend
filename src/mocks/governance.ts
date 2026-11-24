// Governance mocks: audit log, configuration versions, scheduled reports,
// project settings. Copy and numbers follow design-ref/app.js (`audit`,
// `versions`, `diffRows`, `reports(I)`).

export type AuditTarget = 'agent' | 'group' | 'token' | 'pipeline' | 'project';

export interface AuditEvent {
  when: string;
  abs: string;
  who: string;
  action: string;
  res: string;
  target: AuditTarget;
  /** Route segment under the project base the resource links to. */
  href: string;
  meta: string;
  color: string;
  before?: string;
  after?: string;
}

export const AUDIT: AuditEvent[] = [
  { when: '2 d ago', abs: '17 Nov 2026 · 14:22', who: 'r.haddad', action: 'updated the configuration of', res: 'sceai_indicators_oxford', target: 'agent', href: 'agents/sceai_indicators_oxford/versions', meta: 'Agent · v5 → v6', color: 'var(--brand)', before: '"tools": [ …12 tools, "EconomicData" ]', after: '"tools": [ …12 tools, "EconomicData", "EconomicAnalysis" ]' },
  { when: '6 d ago', abs: '13 Nov 2026 · 09:10', who: 'm.alkuwari', action: 'changed limits on', res: 'sceai_indicators_agent', target: 'agent', href: 'agents/sceai_indicators_agent/versions', meta: 'Agent · v3 → v4', color: 'var(--brand)', before: '"request_limit": 15', after: '"request_limit": 20' },
  { when: '9 d ago', abs: '10 Nov 2026 · 11:47', who: 'sceai_admin', action: 'added sceai_analyst to', res: 'catalog_readers', target: 'group', href: 'groups', meta: 'Group membership', color: 'var(--info)' },
  { when: '9 d ago', abs: '10 Nov 2026 · 11:40', who: 'sceai_admin', action: 'created API token for', res: 'dashboards-svc', target: 'token', href: 'tokens', meta: 'Expires in 90 days', color: 'var(--info)' },
  { when: '12 d ago', abs: '07 Nov 2026 · 02:00', who: 'system', action: 'ran pipeline', res: 'indicators_csv_ingest', target: 'pipeline', href: 'pipelines', meta: '8,051 rows ingested', color: 'var(--text-subtle)' },
  { when: '14 d ago', abs: '05 Nov 2026 · 08:31', who: 'sceai_admin', action: 'signed in with QDI to', res: 'SCEAI', target: 'project', href: '', meta: 'Authentication', color: 'var(--text-subtle)' },
];

export const AUDIT_TARGET_LABEL: Record<AuditTarget, string> = { agent: 'Agent', group: 'Group', token: 'API token', pipeline: 'Pipeline', project: 'Project' };

// ---- Configuration versions -------------------------------------------------

export interface ConfigVersion {
  v: string;
  by: string;
  when: string;
  note: string;
}

export const CONFIG_AGENT = 'sceai_indicators_oxford';

export const CONFIG_VERSIONS: ConfigVersion[] = [
  { v: 'v6', by: 'r.haddad', when: '2 d ago', note: 'Added EconomicAnalysis tool' },
  { v: 'v5', by: 'r.haddad', when: '9 d ago', note: 'Raised request limit to 20' },
  { v: 'v4', by: 'm.alkuwari', when: '21 d ago', note: 'Tightened Oxford question template' },
  { v: 'v3', by: 'm.alkuwari', when: '33 d ago', note: 'Added hybrid_search' },
  { v: 'v2', by: 'r.haddad', when: '47 d ago', note: 'Attached sceai_indicators' },
  { v: 'v1', by: 'r.haddad', when: '61 d ago', note: 'Created' },
];

export interface DiffRow {
  ln: number | '';
  l: string;
  lb: string;
  rn: number;
  r: string;
  rb: string;
}

const V5_LINES = [
  '{',
  '  "name": "sceai_indicators_oxford",',
  '  "type": "planner_and_executor",',
  '  "model_provider": "agent_default",',
  '  "collections": ["sceai_indicators"],',
  '  "tools": [',
  '    "find_indicator", "get_indicator_value",',
  '    "actual_vs_target", "…8 more local tools",',
  '    "hybrid_search",',
  '    "EconomicData"',
  '  ],',
  '  "limits": {',
  '    "timeout_seconds": 180,',
  '    "max_retries": 1,',
  '    "request_limit": 20,',
  '    "tool_call_limit": 15,',
  '    "task_priority": 3,',
  '    "max_in_flight": 3',
  '  }',
  '}',
];

export function buildDiff(): DiffRow[] {
  const rows: DiffRow[] = [];
  let rn = 0;
  V5_LINES.forEach((l, i) => {
    if (l === '    "EconomicData"') {
      rows.push({ ln: i + 1, l, lb: 'var(--danger-bg)', rn: ++rn, r: '    "EconomicData",', rb: 'var(--success-bg)' });
      rows.push({ ln: '', l: '', lb: 'var(--surface-sunken)', rn: ++rn, r: '    "EconomicAnalysis"', rb: 'var(--success-bg)' });
    } else rows.push({ ln: i + 1, l, lb: 'transparent', rn: ++rn, r: l, rb: 'transparent' });
  });
  return rows;
}

// ---- Scheduled reports ------------------------------------------------------

export type RepSection = 'overview' | 'jobs' | 'ask' | 'feedback' | 'attention' | 'oxford' | 'access' | 'cost';
export type RepFreq = 'daily' | 'weekly' | 'monthly';
export type RepRange = 'last' | 'mtd' | '30';
export type RepFmt = 'pdf' | 'xlsx' | 'both';
export type RepDel = 'email' | 'teams' | 'both';

export const REP_SECTIONS: { key: RepSection; name: string; desc: string }[] = [
  { key: 'overview', name: 'Overview KPIs', desc: 'Jobs, success rate, p95, active agents' },
  { key: 'jobs', name: 'Agent jobs', desc: 'Daily volume by status and agent' },
  { key: 'ask', name: 'Ask AI usage', desc: 'Messages, answer types, languages' },
  { key: 'feedback', name: 'User feedback', desc: 'Helpful vs not helpful, open items' },
  { key: 'attention', name: 'Needs attention', desc: 'Failures, timeouts, MCP issues' },
  { key: 'oxford', name: 'Oxford Economics usage', desc: 'External calls and leak-guard results' },
  { key: 'access', name: 'Access changes', desc: 'New users, grants and tokens' },
  { key: 'cost', name: 'Model usage', desc: 'Requests and tokens per model' },
];

export interface ReportSchedule {
  id: string;
  name: string;
  owner: string;
  sectionsLabel: string;
  freqLabel: string;
  recipientsLabel: string;
  format: 'PDF' | 'XLSX';
  next: string;
  status: 'approved' | 'rejected' | 'draft';
  statusLabel: string;
  // Form defaults when the schedule is opened in the edit panel.
  form: {
    sections: RepSection[];
    freq: RepFreq;
    range: RepRange;
    fmt: RepFmt;
    del: RepDel;
    day: string;
    time: string;
    recipients: string[];
    skipEmpty: boolean;
  };
}

export const REPORTS: ReportSchedule[] = [
  {
    id: 'weekly-summary', name: 'Weekly SCEAI summary', owner: 'sceai_admin', sectionsLabel: 'Overview, Agent jobs, Ask AI usage, Feedback, Needs attention', freqLabel: 'Weekly · Sunday 07:00', recipientsLabel: '4 recipients', format: 'PDF', next: 'Sun 23 Nov, 07:00', status: 'approved', statusLabel: 'Delivered',
    form: { sections: ['overview', 'jobs', 'ask', 'feedback', 'attention'], freq: 'weekly', range: 'last', fmt: 'pdf', del: 'email', day: 'Sunday', time: '07:00', recipients: ['sceai_admin', 'tenant_admins (group)', 'm.alkuwari', 'director.office@sceai.gov.qa'], skipEmpty: true },
  },
  {
    id: 'monthly-brief', name: 'Monthly leadership brief', owner: 'sceai_admin', sectionsLabel: 'Overview, Ask AI usage, Feedback', freqLabel: 'Monthly · 1st, 08:00', recipientsLabel: '9 recipients', format: 'PDF', next: 'Mon 1 Dec, 08:00', status: 'approved', statusLabel: 'Delivered',
    form: { sections: ['overview', 'ask', 'feedback'], freq: 'monthly', range: 'last', fmt: 'pdf', del: 'both', day: '1st', time: '08:00', recipients: ['sceai_admin', 'director.office@sceai.gov.qa', 'tenant_admins (group)'], skipEmpty: false },
  },
  {
    id: 'daily-ops', name: 'Daily operations digest', owner: 'm.alkuwari', sectionsLabel: 'Needs attention, Agent jobs, Oxford usage', freqLabel: 'Daily · 07:00', recipientsLabel: 'ai_team', format: 'PDF', next: 'Tomorrow, 07:00', status: 'rejected', statusLabel: 'Failed',
    form: { sections: ['attention', 'jobs', 'oxford'], freq: 'daily', range: 'last', fmt: 'pdf', del: 'email', day: 'Every day', time: '07:00', recipients: ['ai_team (group)'], skipEmpty: true },
  },
  {
    id: 'access-audit', name: 'Access changes · audit', owner: 'sceai_admin', sectionsLabel: 'Access changes', freqLabel: 'Monthly · last day, 17:00', recipientsLabel: '2 recipients', format: 'XLSX', next: 'Sun 30 Nov, 17:00', status: 'draft', statusLabel: 'Paused',
    form: { sections: ['access'], freq: 'monthly', range: 'mtd', fmt: 'xlsx', del: 'email', day: 'Last day', time: '17:00', recipients: ['sceai_admin', 'tenant_admins (group)'], skipEmpty: false },
  },
];

export const REP_KPI = [
  { k: 'Agent jobs', v: '50', d: '+12%', c: '#17633F' },
  { k: 'Success rate', v: '84.8%', d: '−3.1 pp', c: '#A12B23' },
  { k: 'Ask AI messages', v: '508', d: '+21%', c: '#17633F' },
  { k: 'Arabic share', v: '38%', d: '+4 pp', c: '#5C5457' },
];

export const REP_TOP_Q: { q: string; n: number }[] = [
  { q: 'Tourism share of GDP', n: 41 },
  { q: 'Consumer price inflation', n: 33 },
  { q: 'Food reserve coverage', n: 22 },
  { q: 'Non-hydrocarbon exports', n: 19 },
  { q: 'Real GDP growth (Oxford)', n: 15 },
];

export const REP_ATTENTION: { t: string; c: string }[] = [
  { t: '2 jobs exceeded the 180 s timeout', c: '#C0352B' },
  { t: 'Oxford MCP degraded · 2 × 502', c: '#B7791F' },
  { t: '8 template fallbacks from the verifier', c: '#B7791F' },
  { t: '1 document failed ingestion', c: '#B7791F' },
];

/** Agent jobs by day: [succeeded, failed, running] (design `days`). */
export const REP_DAYS: { label: string; ok: number; fail: number; run: number }[] = [
  [5, 1, 0],
  [7, 1, 0],
  [4, 0, 0],
  [6, 2, 0],
  [8, 1, 0],
  [7, 1, 0],
  [9, 2, 3],
].map(([ok, fail, run], i) => ({ ok, fail, run, label: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'][i] }));

export interface ReportDelivery {
  sent: string;
  report: string;
  reportId: string;
  period: string;
  recipients: string;
  delivery: string;
  status: 'approved' | 'rejected' | 'hold';
  statusLabel: string;
  err: string;
  action: string;
}

export const REPORT_HISTORY: ReportDelivery[] = [
  { sent: 'Sun 16 Nov, 07:00', report: 'Weekly SCEAI summary', reportId: 'weekly-summary', period: '9 – 15 Nov', recipients: '4', delivery: 'Email', status: 'approved', statusLabel: 'Delivered', err: '', action: 'View PDF' },
  { sent: 'Wed 19 Nov, 07:00', report: 'Daily operations digest', reportId: 'daily-ops', period: '18 Nov', recipients: '3', delivery: 'Email', status: 'rejected', statusLabel: 'Failed', err: 'SMTP relay timed out · retried twice', action: 'Retry' },
  { sent: 'Tue 18 Nov, 07:00', report: 'Daily operations digest', reportId: 'daily-ops', period: '17 Nov', recipients: '3', delivery: 'Email', status: 'approved', statusLabel: 'Delivered', err: '', action: 'View PDF' },
  { sent: 'Sat 1 Nov, 08:00', report: 'Monthly leadership brief', reportId: 'monthly-brief', period: 'October 2026', recipients: '9', delivery: 'Email + Teams', status: 'approved', statusLabel: 'Delivered', err: '', action: 'View PDF' },
  { sent: 'Sun 9 Nov, 07:00', report: 'Weekly SCEAI summary', reportId: 'weekly-summary', period: '2 – 8 Nov', recipients: '4', delivery: 'Email', status: 'hold', statusLabel: 'Partly delivered', err: '1 recipient bounced', action: 'Details' },
];

// ---- Project settings -------------------------------------------------------

export interface SettingRow {
  key: string;
  value: string;
  mono?: boolean;
  /** Route segment under the project base, when the value names a resource. */
  href?: string;
  note?: string;
}

export interface SettingSection {
  title: string;
  sub: string;
  rows: SettingRow[];
}

export const SETTINGS: SettingSection[] = [
  {
    title: 'General',
    sub: 'Identity of the SCEAI project on KAP',
    rows: [
      { key: 'Project name', value: 'SCEAI' },
      { key: 'Organisation', value: 'Supreme Council for Economic Affairs and Investment' },
      { key: 'Project key', value: 'sceai', mono: true },
      { key: 'Tenant ID', value: 'a81e92d4-9541-433a-b295-c869b5dbaf17', mono: true, note: 'Sent as X-Tenant-ID on every KAP API call' },
      { key: 'Default language', value: 'English · Arabic answers enabled' },
      { key: 'Time zone', value: 'Asia/Qatar (AST, UTC+3)' },
    ],
  },
  {
    title: 'Authentication',
    sub: 'How people and services sign in',
    rows: [
      { key: 'People', value: 'QDI (Qatar Digital Identity)' },
      { key: 'AI team', value: 'KAP SSO' },
      { key: 'Services', value: 'API tokens · max lifetime 365 days', href: 'tokens' },
      { key: 'Access model', value: 'Groups → roles → grants', href: 'grants' },
    ],
  },
  {
    title: 'Default model providers',
    sub: 'Used by agents and pipelines unless they name another provider',
    rows: [
      { key: 'agent_default', value: 'Qwen2.5-72B · planner and executor agents', mono: true, href: 'providers' },
      { key: 'chat_default', value: 'Qwen2.5-7B · Ask AI side agents', mono: true, href: 'providers' },
      { key: 'embed_default', value: '1024-d embeddings · collection ingestion', mono: true, href: 'providers' },
    ],
  },
  {
    title: 'Data & retention',
    sub: 'What the project keeps and for how long',
    rows: [
      { key: 'Default collection', value: 'sceai_indicators', mono: true, href: 'collections/sceai_indicators' },
      { key: 'Job traces', value: 'Kept 90 days' },
      { key: 'Audit log', value: 'Kept 365 days', href: 'audit' },
      { key: 'Configuration versions', value: 'All versions kept', href: 'configs' },
    ],
  },
];

export interface QueuePolicy {
  queue: string;
  purpose: string;
  taskPriority: number;
  maxInFlight: number;
  timeout: string;
  retries: number;
}

export const QUEUE_POLICIES: QueuePolicy[] = [
  { queue: 'kap.agent', purpose: 'Agent jobs', taskPriority: 3, maxInFlight: 3, timeout: '180 s', retries: 1 },
  { queue: 'kap.pipeline', purpose: 'Ingestion pipeline runs', taskPriority: 3, maxInFlight: 3, timeout: '30 min', retries: 2 },
];

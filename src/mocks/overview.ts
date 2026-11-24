// SCEAI overview (home) and Default system-project overview.
// Numbers and copy follow design-ref/app.js `overview()` and `more()` (def*).

export type OvRoute = 'convs' | 'map' | 'feedback' | 'catalogue' | 'catPublish' | 'pipelines' | 'wizard' | 'users' | 'reports' | 'agents' | 'collections' | 'mcp' | 'providers' | 'trace';
export type OvIcon =
  | 'bot' | 'messages' | 'book' | 'database' | 'workflow' | 'plug' | 'users' | 'calendar'
  | 'msgPlus' | 'upload' | 'play' | 'userPlus' | 'circleX' | 'alert' | 'languages' | 'layers' | 'cpu';
export type Tone = 'success' | 'warning' | 'danger';

export interface OverviewData {
  week: string;
  questions: { total: number; delta: string; previous: number; labels: string[]; cur: number[]; prev: number[] };
  routes: { label: string; pct: number; color: string }[];
  answerTime: { median: string; p95: string; target: string; p50s: number[]; p95s: number[] };
  feedback: { pct: string; helpful: number; notHelpful: number; delta: string; open: number; why: { label: string; n: number }[] };
  language: { en: number; ar: number; delta: string };
  actions: { label: string; icon: OvIcon; go: OvRoute }[];
  resources: { name: string; value: string; desc: string; icon: OvIcon; kind: 'local' | 'sand' | 'teal' | 'neutral'; health: Tone; go: OvRoute }[];
  attention: { sev: 'critical' | 'warning'; icon: OvIcon; title: string; desc: string; tags: string[]; when: string; action: string; go: OvRoute; jobId?: string }[];
  health: { name: string; metric: string; metricLabel: string; status: string; tone: Tone; detail: string; icon: OvIcon; go: OvRoute; spark: number[] }[];
}

export const OVERVIEW: OverviewData = {
  week: '13 – 19 Nov 2026 · compared with the previous week',
  questions: {
    total: 508,
    delta: '+21%',
    previous: 420,
    labels: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'],
    cur: [64, 67, 50, 75, 82, 88, 82],
    prev: [52, 58, 47, 61, 66, 70, 66],
  },
  routes: [
    { label: 'SCEAI indicators', pct: 61, color: '#8A1538' },
    { label: 'Articles', pct: 18, color: '#C8B49A' },
    { label: 'Oxford Economics', pct: 10, color: '#0F766E' },
    { label: 'Chat / out of scope', pct: 11, color: '#A8A0A3' },
  ],
  answerTime: {
    median: '3.1 s',
    p95: '3.9 s',
    target: 'target < 6 s',
    p50s: [3.4, 3.3, 3.5, 3.2, 3.1, 3.0, 3.1],
    p95s: [4.4, 4.2, 4.5, 4.0, 4.1, 3.8, 3.9],
  },
  feedback: {
    pct: '92%',
    helpful: 86,
    notHelpful: 7,
    delta: '+2 pp vs last week',
    open: 4,
    why: [
      { label: 'Not answered (template)', n: 2 },
      { label: 'Wrong indicator', n: 2 },
      { label: 'Wrong period', n: 1 },
      { label: 'Wrong source', n: 1 },
      { label: 'Too long', n: 1 },
    ],
  },
  language: { en: 62, ar: 38, delta: 'Arabic +4 pp' },
  actions: [
    { label: 'Ask a test question', icon: 'msgPlus', go: 'convs' },
    { label: 'Publish catalogue version', icon: 'upload', go: 'catPublish' },
    { label: 'Run ingestion', icon: 'play', go: 'pipelines' },
    { label: 'Create agent', icon: 'bot', go: 'wizard' },
    { label: 'Invite user', icon: 'userPlus', go: 'users' },
    { label: 'Schedule report', icon: 'calendar', go: 'reports' },
  ],
  resources: [
    { name: 'Agents', value: '8', desc: '6 Ask AI · 2 indicator agents', icon: 'bot', kind: 'local', health: 'success', go: 'agents' },
    { name: 'Conversations', value: '508', desc: 'This week · 38% Arabic', icon: 'messages', kind: 'local', health: 'success', go: 'convs' },
    { name: 'Catalogue', value: '214', desc: 'v2026.11.3 · 1 draft version', icon: 'book', kind: 'sand', health: 'success', go: 'catalogue' },
    { name: 'Collections', value: '1', desc: '8,104 observations · 12 docs', icon: 'database', kind: 'sand', health: 'success', go: 'collections' },
    { name: 'Pipelines', value: '2', desc: '1 partial run this week', icon: 'workflow', kind: 'neutral', health: 'warning', go: 'pipelines' },
    { name: 'MCP servers', value: '1', desc: 'Oxford Economics · degraded', icon: 'plug', kind: 'teal', health: 'warning', go: 'mcp' },
    { name: 'Users', value: '6', desc: '2 groups · 3 API tokens', icon: 'users', kind: 'neutral', health: 'success', go: 'users' },
    { name: 'Scheduled reports', value: '4', desc: 'Next: Sunday 07:00', icon: 'calendar', kind: 'neutral', health: 'success', go: 'reports' },
  ],
  attention: [
    {
      sev: 'critical',
      icon: 'circleX',
      title: 'Two jobs hit the 180 s timeout',
      desc: 'Both were waiting on Oxford Economics. The answers fell back to local data only.',
      tags: ['2 jobs', 'sceai_indicators_oxford'],
      when: '2 h ago',
      action: 'Open trace',
      go: 'trace',
      jobId: '5d2e0a71',
    },
    {
      sev: 'warning',
      icon: 'alert',
      title: 'Oxford Economics is slow and failing more often',
      desc: '8 of 51 calls returned 502 this week. Oxford questions take 2.6 s longer than others.',
      tags: ['51 questions affected', 'MCP'],
      when: '18 min ago',
      action: 'Check connection',
      go: 'mcp',
    },
    {
      sev: 'warning',
      icon: 'languages',
      title: 'Six indicators have weak Arabic coverage',
      desc: 'Arabic questions about them need the Indicator Picker three times more often.',
      tags: ['6 indicators', 'Catalogue'],
      when: '1 d ago',
      action: 'Open catalogue',
      go: 'catalogue',
    },
  ],
  health: [
    { name: 'Ask AI pipeline', metric: '97.9%', metricLabel: 'verified', status: 'Healthy', tone: 'success', detail: 'p95 3.9 s', icon: 'workflow', go: 'map', spark: [97.2, 97.6, 97.4, 98.0, 97.8, 98.1, 97.9] },
    { name: 'kap.agent queue', metric: '6/8', metricLabel: 'in flight', status: 'Busy', tone: 'warning', detail: '1 waiting', icon: 'layers', go: 'map', spark: [3, 4, 6, 5, 7, 8, 6] },
    { name: 'Oxford MCP', metric: '16%', metricLabel: 'errors', status: 'Degraded', tone: 'warning', detail: 'p95 2.6 s', icon: 'plug', go: 'mcp', spark: [4, 6, 5, 12, 9, 18, 16] },
    { name: 'Model serving', metric: '62%', metricLabel: 'capacity', status: 'Healthy', tone: 'success', detail: '3 models', icon: 'cpu', go: 'providers', spark: [48, 55, 60, 72, 81, 66, 62] },
    { name: 'Pipelines', metric: '6 h', metricLabel: 'since last run', status: 'Healthy', tone: 'success', detail: '8,104 rows', icon: 'workflow', go: 'pipelines', spark: [1, 1, 1, 1, 0.8, 1, 1] },
  ],
};

// ---- Default (system) project ----

export interface DefaultOverviewData {
  kpis: { label: string; value: string; desc: string }[];
  identities: { name: string; desc: string; last: string }[];
  models: { name: string; desc: string }[];
  queues: { key: string; value: string }[];
  tenants: { name: string; desc: string; when: string; projectKey?: string }[];
}

export const DEFAULT_OVERVIEW: DefaultOverviewData = {
  kpis: [
    { label: 'Users', value: '3', desc: 'Service identities only' },
    { label: 'Agents', value: '0', desc: 'System project' },
    { label: 'Collections', value: '0', desc: 'System project' },
    { label: 'Jobs today', value: '0', desc: 'No jobs run here' },
    { label: 'Tenants using defaults', value: '3', desc: 'SCEAI, Economic Affairs, sandbox' },
  ],
  identities: [
    { name: 'kap_system', desc: 'Platform service · migrations and health checks', last: '2 min ago' },
    { name: 'kap_scheduler', desc: 'Runs scheduled reports and pipeline triggers', last: '6 h ago' },
    { name: 'kap_ingest_svc', desc: 'Executes ingestion on kap.pipeline', last: '6 h ago' },
  ],
  models: [
    { name: 'agent_default', desc: 'Qwen2.5-32B-Instruct · chat with tool calling' },
    { name: 'embed_default', desc: 'qwen3-embedding · 1024-d' },
    { name: 'chat_default', desc: 'Qwen2.5-14B-Instruct · chat' },
  ],
  queues: [
    { key: 'kap.agent · max in-flight', value: '3' },
    { key: 'kap.agent · task priority', value: '3' },
    { key: 'kap.pipeline · max in-flight', value: '2' },
    { key: 'Job timeout', value: '180 s' },
    { key: 'Tool-call limit', value: '15' },
    { key: 'Request limit', value: '20' },
  ],
  tenants: [
    { name: 'SCEAI', desc: 'Supreme Council for Economic Affairs and Investment', when: 'Created 142 d ago', projectKey: 'sceai' },
    { name: 'Economic Affairs', desc: 'Economic Affairs directorate', when: 'Created 118 d ago' },
    { name: 'sandbox', desc: 'AI team sandbox', when: 'Created 31 d ago' },
  ],
};

// Shared mock data used by several features (agents, jobs, users, tools).
// Numbers and copy follow the design reference (design-ref/app.js), not the
// test stand. Feature-specific mocks live next to their feature in src/mocks.
import type { Agent, ConsoleUser, Job, JobStatus, Tool } from '@/types';

/** Source colour coding (README §6): local = maroon, documents = sand, Oxford = teal, model/code = grey. */
export const SOURCE_COLOR = { local: '#8A1538', documents: '#C8B49A', oxford: '#0F766E', model: '#8C8487', queue: '#CFCAC8' } as const;

export const AGENTS: Agent[] = [
  { id: 'sceai_indicators_agent', uuid: '226bf6df-e325-4ec9-9bd4-a90251dca756', name: 'sceai_indicators_agent', description: 'Local indicator data and planning documents only', type: 'planner_and_executor', group: 'Indicator agents · jobs', kind: 'kap', model: 'Qwen2.5-72B', collections: ['sceai_indicators'], toolsCount: 12, oxford: false, calls24h: 5, successRate: 89.7, status: 'healthy' },
  { id: 'sceai_indicators_oxford', uuid: '397bcc0b-dcb7-40f1-94a2-baea7f1520f6', name: 'sceai_indicators_oxford', description: 'Local data with Oxford Economics context', type: 'planner_and_executor', group: 'Indicator agents · jobs', kind: 'kap', model: 'Qwen2.5-72B', collections: ['sceai_indicators'], toolsCount: 14, oxford: true, calls24h: 9, successRate: 76.2, status: 'degraded' },
  { id: 'intent-agent', uuid: 'a3f1c2d4-1b7e-4c8a-9f21-6d0e5b7c8a11', name: 'Intent Agent', description: 'Question → indicator, countries, periods, computation type', type: 'pipeline · understand', group: 'Ask AI · chat', kind: 'pipeline', model: 'Qwen2.5-7B', collections: [], toolsCount: null, oxford: false, calls24h: 74, successRate: 99.6, status: 'healthy' },
  { id: 'indicator-picker', uuid: 'b8e2d3f5-2c8f-4d9b-a032-7e1f6c8d9b22', name: 'Indicator Picker', description: 'Fallback · picks a catalogue name or NONE', type: 'pipeline · resolve', group: 'Ask AI · chat', kind: 'pipeline', model: 'Qwen2.5-72B', collections: ['Catalogue'], toolsCount: null, oxford: false, calls24h: 5, successRate: 96.8, status: 'healthy' },
  { id: 'composer-agent', uuid: 'c9f3e4a6-3d90-4eac-b143-8f207d9eac33', name: 'Composer Agent', description: 'Writes the numeric answer from computed facts', type: 'pipeline · compose', group: 'Ask AI · chat', kind: 'pipeline', model: 'Qwen2.5-72B', collections: [], toolsCount: null, oxford: false, calls24h: 57, successRate: 97.9, status: 'healthy' },
  { id: 'article-agent', uuid: 'd0a4f5b7-4ea1-4fbd-8254-90318eafbd44', name: 'Article Agent', description: 'Answers from retrieved article passages', type: 'pipeline · compose', group: 'Ask AI · chat', kind: 'pipeline', model: 'Qwen2.5-72B', collections: ['SCEAI articles'], toolsCount: null, oxford: false, calls24h: 13, successRate: 98.9, status: 'healthy' },
  { id: 'follow-up-agent', uuid: 'e1b5a6c8-5fb2-40ce-9365-a14290b0ce55', name: 'Follow-up Agent', description: 'Suggests up to 3 next questions', type: 'pipeline · side agent', group: 'Ask AI · chat', kind: 'pipeline', model: 'Qwen2.5-7B', collections: [], toolsCount: null, oxford: false, calls24h: 69, successRate: 99.4, status: 'healthy' },
  { id: 'reader-agent', uuid: 'f2c6b7d9-6ac3-41df-a476-b253a1c1df66', name: 'Reader Agent', description: '"Read this for me" in plain language', type: 'pipeline · side agent', group: 'Ask AI · chat', kind: 'pipeline', model: 'Qwen2.5-72B', collections: [], toolsCount: null, oxford: false, calls24h: 6, successRate: 100, status: 'healthy' },
];

export const agentById = (id: string | undefined) => AGENTS.find((a) => a.id === id || a.name === id || a.uuid === id);

/** The 12 hand-written jobs from the design, followed by generated history to ~50. */
const DESIGN_JOBS: [JobStatus, string, string, string, string, string, string, string, number][] = [
  ['running', '93c7a1f2', 'sceai_indicators_oxford', 'sceai_analyst', 'What was the tourism sector contribution to GDP in Q4 2024, and how does it compare with the target?', '', '6.1 s', 'just now', 0],
  ['running', '4be0d913', 'sceai_indicators_agent', 'dashboards-svc', 'What is the strategic food reserve coverage for 2024?', '', '2.4 s', 'just now', 0],
  ['succeeded', '7a1c5e30', 'sceai_indicators_oxford', 'sceai_analyst', 'Compare the recent tourism trend with the Oxford Economics outlook for Qatar.', '', '10.2 s', '12 min ago', 0],
  ['succeeded', 'c3f80b6d', 'sceai_indicators_agent', 'sceai_analyst', 'What was consumer price inflation in January 2019 and was it on target?', '', '6.7 s', '38 min ago', 0],
  ['failed', '5d2e0a71', 'sceai_indicators_oxford', 'sceai_analyst', 'Add wider GDP context to the tourism contribution figure for Q4 2024.', 'Job exceeded 180 s timeout', '3 m 00 s', '2 h ago', 0],
  ['succeeded', '0e9b2a47', 'sceai_indicators_agent', 'sceai_admin', 'How did non-hydrocarbon exports perform as a share of total exports in 2019 against target?', '', '8.9 s', '3 h ago', 0],
  ['failed', 'b1c94f08', 'sceai_indicators_agent', 'sceai_admin', 'Which indicators are currently off track and what do the plans say about them?', 'Tool-call limit reached (15 / 15)', '41.3 s', '5 h ago', 0],
  ['succeeded', '6f4d1c82', 'sceai_indicators_agent', 'dashboards-svc', 'Which indicators moved the most in Q4 2024?', '', '7.4 s', '6 h ago', 0],
  ['failed', 'e7a3d2c6', 'sceai_indicators_oxford', 'dashboards-svc', 'Compare the recent tourism trend with the Oxford Economics outlook for Qatar.', 'Oxford MCP returned 502 Bad Gateway', '14.6 s', '9 h ago', 1],
  ['succeeded', 'a8e27f15', 'sceai_indicators_agent', 'sceai_analyst', 'What is the strategic food reserve coverage for 2024?', '', '5.9 s', '11 h ago', 0],
  ['cancelled', '1d6b9e04', 'sceai_indicators_oxford', 'sceai_admin', 'Summarise tourism performance against the national strategy target.', 'Cancelled by sceai_admin', '3.2 s', '1 d ago', 0],
  ['failed', '2f8b6e19', 'sceai_indicators_agent', 'sceai_analyst', 'What was hotel occupancy in Al Wakrah last month?', 'Indicator not found', '4.1 s', '1 d ago', 0],
];

const NOW = Date.parse('2026-11-19T14:20:00+03:00');
const relToMs = (rel: string) => {
  if (rel === 'just now') return 0;
  const m = rel.match(/(\d+)\s*(min|h|d)/);
  if (!m) return 0;
  return Number(m[1]) * { min: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 'min' | 'h' | 'd'];
};
const durS = (d: string) => {
  const m = d.match(/(\d+) m (\d+) s/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : parseFloat(d);
};
const hex = (seed: number) => {
  let x = seed * 2654435761;
  let s = '';
  for (let i = 0; i < 8; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    s += (x >>> 24).toString(16).padStart(2, '0').slice(-1);
  }
  return s;
};
const uuidFrom = (id: string) => `${id}-${id.slice(0, 4)}-4${id.slice(1, 4)}-a${id.slice(2, 5)}-${(id + id).slice(0, 12)}`;
const fmtAbs = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Qatar' });

const MORE_QUESTIONS = [
  'What was consumer price inflation in January 2019 and was it on target?',
  'Which indicators moved the most in Q4 2024?',
  'What is the strategic food reserve coverage for 2024?',
  'How did non-hydrocarbon exports perform as a share of total exports in 2019 against target?',
  'Compare the recent tourism trend with the Oxford Economics outlook for Qatar.',
  'What was the tourism sector contribution to GDP in Q4 2024?',
  'Show the labour force participation rate for the last four quarters.',
  'Which indicators are on track against their 2024 targets?',
  'What was re-export value growth in Q3 2024?',
  'What was Qatar annual real GDP growth in 2023 according to Oxford Economics?',
];
const FAIL_REASONS = ['Job exceeded 180 s timeout', 'Tool-call limit reached (15 / 15)', 'Oxford MCP returned 502 Bad Gateway', 'Indicator not found'];

function buildJobs(): Job[] {
  const out: Job[] = DESIGN_JOBS.map(([status, id, agent, user, question, reason, duration, rel, retries]) => {
    const ms = NOW - relToMs(rel);
    return {
      id,
      uuid: uuidFrom(id),
      status,
      agent,
      user,
      question,
      reason: reason || undefined,
      duration,
      durationS: durS(duration),
      retries,
      rel,
      abs: fmtAbs(ms),
      createdAt: new Date(ms).toISOString(),
      toolCalls: reason.startsWith('Tool-call') ? 15 : 3 + (id.charCodeAt(0) % 4),
      modelRequests: 2 + (id.charCodeAt(1) % 3),
    };
  });
  // Generated history (days 1–7): mostly succeeded, totals match the design strip (50 · 39 · 7 · 3 · 1).
  const extraStatuses: JobStatus[] = [
    ...Array<JobStatus>(33).fill('succeeded'),
    'failed', 'failed', 'failed',
    'running',
    'queued',
  ];
  extraStatuses.forEach((status, i) => {
    const id = hex(i + 7);
    const hours = status === 'running' || status === 'queued' ? 0 : 26 + i * 4.1;
    const ms = NOW - hours * 3_600_000;
    const agent = i % 3 === 0 ? 'sceai_indicators_oxford' : 'sceai_indicators_agent';
    const reason = status === 'failed' ? FAIL_REASONS[i % FAIL_REASONS.length] : undefined;
    const d = status === 'failed' && reason?.includes('timeout') ? 180 : 4.2 + ((i * 37) % 70) / 10;
    const rel = hours === 0 ? 'just now' : hours < 48 ? `${Math.round(hours)} h ago` : `${Math.round(hours / 24)} d ago`;
    out.push({
      id,
      uuid: uuidFrom(id),
      status,
      agent,
      user: ['sceai_analyst', 'sceai_admin', 'dashboards-svc'][i % 3],
      question: MORE_QUESTIONS[i % MORE_QUESTIONS.length],
      reason,
      duration: d >= 60 ? `${Math.floor(d / 60)} m ${String(Math.round(d % 60)).padStart(2, '0')} s` : `${d.toFixed(1)} s`,
      durationS: d,
      retries: reason?.includes('502') ? 1 : 0,
      rel,
      abs: fmtAbs(ms),
      createdAt: new Date(ms).toISOString(),
      toolCalls: reason?.startsWith('Tool-call') ? 15 : 2 + (i % 5),
      modelRequests: 2 + (i % 3),
    });
  });
  return out;
}

export const JOBS: Job[] = buildJobs();
export const jobById = (id: string | undefined) => JOBS.find((j) => j.id === id || j.uuid === id);

export const JOB_SUMMARY = { total: 50, succeeded: 39, failed: 7, running: 3, avgDuration: '8.6 s' };

export const USERS: ConsoleUser[] = [
  { username: 'sceai_admin', displayName: 'SCEAI tenant admin', role: 'administrator', groups: ['tenant_admins', 'catalog_readers'], lastSeen: '25 min ago', email: 'admin@sceai.gov.qa', auth: 'QDI (Qatar Digital Identity)', kind: 'person' },
  { username: 'sceai_analyst', displayName: 'SCEAI analyst', role: 'analyst', groups: ['catalog_readers'], lastSeen: '3 min ago', email: 'analyst@sceai.gov.qa', auth: 'QDI (Qatar Digital Identity)', kind: 'person' },
  { username: 'm.alkuwari', displayName: 'Mariam Al-Kuwari', role: 'administrator', groups: ['ai_team'], lastSeen: '8 min ago', auth: 'KAP SSO', kind: 'person' },
  { username: 'r.haddad', displayName: 'Rami Haddad', role: 'administrator', groups: ['ai_team'], lastSeen: '2 h ago', auth: 'KAP SSO', kind: 'person' },
  { username: 'j.thomas', displayName: 'Julia Thomas', role: 'viewer', groups: ['ai_team'], lastSeen: '3 d ago', auth: 'KAP SSO', kind: 'person' },
  { username: 'api:dashboards-svc', displayName: 'Dashboards service (token)', role: 'analyst', groups: ['catalog_readers'], lastSeen: '1 min ago', auth: 'API token', kind: 'service' },
];
export const userByName = (n: string | undefined) => USERS.find((u) => u.username === n || u.username === `api:${n}`);

export const TOOLS: Tool[] = [
  { name: 'find_indicator', description: 'Resolve an indicator by name, alias or code', source: 'local', calls7d: 41, errorRate: '0%' },
  { name: 'get_indicator_value', description: 'Actual value for an indicator and period', source: 'local', calls7d: 33, errorRate: '0%' },
  { name: 'actual_vs_target', description: 'Compare actual against target', source: 'local', calls7d: 27, errorRate: '0%' },
  { name: 'get_time_series', description: 'Observations over a period range', source: 'local', calls7d: 14, errorRate: '0%' },
  { name: 'get_change', description: 'Change between two periods', source: 'local', calls7d: 6, errorRate: '0%' },
  { name: 'compare_indicators', description: 'Side-by-side comparison', source: 'local', calls7d: 3, errorRate: '0%' },
  { name: 'top_movers', description: 'Largest positive and negative changes', source: 'local', calls7d: 6, errorRate: '0%' },
  { name: 'get_status', description: 'On-track / off-track by target', source: 'local', calls7d: 4, errorRate: '0%' },
  { name: 'get_narratives', description: 'Narrative commentary', source: 'local', calls7d: 11, errorRate: '0%' },
  { name: 'get_achievements', description: 'Recorded achievements for a theme', source: 'local', calls7d: 2, errorRate: '0%' },
  { name: 'query_indicators', description: 'Structured filter over the catalogue', source: 'local', calls7d: 21, errorRate: '4.8%' },
  { name: 'hybrid_search', description: 'Semantic + keyword search over Word documents', source: 'documents', calls7d: 12, errorRate: '0%' },
  { name: 'EconomicData', description: 'Oxford MCP · public macro data', source: 'oxford', calls7d: 15, errorRate: '20%' },
  { name: 'EconomicAnalysis', description: 'Oxford MCP · forecasts and analysis', source: 'oxford', calls7d: 4, errorRate: '0%' },
];

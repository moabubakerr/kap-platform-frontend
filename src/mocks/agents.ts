// Agent detail, wizard and model-provider mocks. Copy and numbers follow
// design-ref/app.js (agent screen: renderVals() agentTabs/testSteps/limits,
// more() versions/diff/failReasons; map drawer `D` for the pipeline agents).
import { AGENTS, JOBS, TOOLS, SOURCE_COLOR, agentById } from './core';
import type { Agent, Tool } from '@/types';

export type ToolSource = Tool['source'];

export interface AgentTool {
  name: string;
  source: ToolSource;
  description: string;
  calls7d: number;
  errorRate: string;
}

export interface AccessRow {
  group: string;
  role: 'analyst' | 'administrator' | 'viewer';
  allows: string;
  members: string;
  grantedBy: string;
}

export interface AgentVersion {
  v: string;
  by: string;
  when: string;
  note: string;
  /** Configuration JSON of this version, one string per line. */
  lines: string[];
  /** True when the change was to system instructions only (not in the JSON). */
  promptOnly?: boolean;
}

export interface DiffRow {
  ln: number | '';
  l: string;
  lb?: 'del' | 'gap';
  rn: number | '';
  r: string;
  rb?: 'add' | 'gap';
}

export interface TestStep {
  name: string;
  sub: string;
  dur: string;
  mono: boolean;
  /** Simulated delay before the step completes (ms). */
  ms: number;
}

export interface TimePart {
  label: string;
  value: string;
  pct: number;
  color: string;
}

export interface AgentDetail {
  agent: Agent;
  headline: string;
  displayId: string;
  created: string;
  modified: string;
  version: number;
  kpis: [string, string][];
  provider: { alias: string; model: string };
  /** Extra key/values for pipeline agents (map drawer). */
  facts: [string, string][];
  tools: AgentTool[];
  toolsSummary: string;
  collections: { name: string; meta: string; kind: 'collection' | 'catalogue' | 'articles' }[];
  mcp?: string;
  groups: string[];
  limits: [string, string][];
  systemPrompt: string;
  access: AccessRow[];
  jobs7d: number;
  /** Newest first; versions[0] is current. */
  versions: AgentVersion[];
  metrics: {
    unit: string;
    days: { label: string; ok: number; fail: number; run: number }[];
    time: TimePart[];
    timeTitle: string;
    failReasons: { name: string; v: number }[];
  };
  test: { runAs: string; prompt: string; steps: TestStep[]; answer: string; footer: (calls: number, s: string) => string };
}

const DAY_LABELS = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'];
const mkDays = (rows: [number, number, number][]) => rows.map(([ok, fail, run], i) => ({ label: DAY_LABELS[i], ok, fail, run }));

const ACCESS_INDICATOR: AccessRow[] = [
  { group: 'catalog_readers', role: 'analyst', allows: 'Run jobs, read own jobs and traces', members: 'sceai_analyst, api:dashboards-svc', grantedBy: 'sceai_admin · 40 d ago' },
  { group: 'tenant_admins', role: 'administrator', allows: 'Run, edit, delete, manage access', members: 'sceai_admin', grantedBy: 'm.alkuwari · 61 d ago' },
  { group: 'ai_team', role: 'administrator', allows: 'Platform-wide · inherited', members: 'm.alkuwari, r.haddad, j.thomas', grantedBy: 'System' },
];
const ACCESS_PIPELINE: AccessRow[] = [
  { group: 'tenant_admins', role: 'administrator', allows: 'Edit prompt and model, view calls', members: 'sceai_admin', grantedBy: 'm.alkuwari · 142 d ago' },
  { group: 'catalog_readers', role: 'viewer', allows: 'Used through Ask AI only · no direct runs', members: 'sceai_analyst, api:dashboards-svc', grantedBy: 'sceai_admin · 140 d ago' },
  { group: 'ai_team', role: 'administrator', allows: 'Platform-wide · inherited', members: 'm.alkuwari, r.haddad, j.thomas', grantedBy: 'System' },
];

const LIMITS: [string, string][] = [
  ['Timeout', '180 s'],
  ['Max retries', '1'],
  ['Request limit', '20'],
  ['Tool-call limit', '15'],
  ['Task priority', '3'],
  ['Max in-flight', '3'],
];

const toolOf = (t: Tool): AgentTool => ({ name: t.name, source: t.source, description: t.description, calls7d: t.calls7d, errorRate: t.errorRate });
const LOCAL_AND_DOCS = TOOLS.filter((t) => t.source !== 'oxford').map(toolOf);
const ALL_TOOLS = TOOLS.map(toolOf);

const COLLECTION_IND = { name: 'sceai_indicators', meta: '8,104 observations · 418 document chunks · embed_default', kind: 'collection' as const };

/** Build side-by-side diff rows from two line arrays (simple LCS). */
export function diffLines(a: string[], b: string[]): DiffRow[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  const dels: number[] = [];
  const adds: number[] = [];
  const flush = () => {
    const k = Math.max(dels.length, adds.length);
    for (let x = 0; x < k; x++) {
      const di = dels[x];
      const ai = adds[x];
      rows.push({
        ln: di != null ? di + 1 : '',
        l: di != null ? a[di] : '',
        lb: di != null ? 'del' : 'gap',
        rn: ai != null ? ai + 1 : '',
        r: ai != null ? b[ai] : '',
        rb: ai != null ? 'add' : 'gap',
      });
    }
    dels.length = 0;
    adds.length = 0;
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      rows.push({ ln: i + 1, l: a[i], rn: j + 1, r: b[j] });
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) adds.push(j++);
    else dels.push(i++);
  }
  flush();
  return rows;
}

const jsonLines = (o: unknown) => JSON.stringify(o, null, 2).split('\n');

// ---------------------------------------------------------------------------
// sceai_indicators_oxford — exactly as designed.

/**
 * Indicator-agent configuration in the design's compact JSON layout
 * (v6 of sceai_indicators_oxford reproduces the design's JSON card exactly;
 * v5 → v6 reproduces the designed diff).
 */
function indicatorLines(o: { name: string; collections: boolean; docs: boolean; oxford: string[]; requestLimit: number }) {
  const tools = ['"find_indicator", "get_indicator_value"', '"actual_vs_target", "…8 more local tools"', ...(o.docs ? ['"hybrid_search"'] : []), ...o.oxford.map((t) => `"${t}"`)];
  return [
    '{',
    `  "name": "${o.name}",`,
    '  "type": "planner_and_executor",',
    '  "model_provider": "agent_default",',
    `  "collections": [${o.collections ? '"sceai_indicators"' : ''}],`,
    '  "tools": [',
    ...tools.map((t, i) => `    ${t}${i < tools.length - 1 ? ',' : ''}`),
    '  ],',
    '  "limits": {',
    '    "timeout_seconds": 180,',
    '    "max_retries": 1,',
    `    "request_limit": ${o.requestLimit},`,
    '    "tool_call_limit": 15,',
    '    "task_priority": 3,',
    '    "max_in_flight": 3',
    '  }',
    '}',
  ];
}

function oxford(agent: Agent): AgentDetail {
  return {
    agent,
    headline: 'Answers indicator questions with local data, enriched with public macro context from Oxford Economics.',
    displayId: agent.uuid,
    created: '61 d ago by r.haddad',
    modified: '2 d ago · v6',
    version: 6,
    kpis: [
      ['Jobs · 24 h', '9'],
      ['Success rate', '76.2%'],
      ['p95 duration', '12.8 s'],
      ['Avg tool calls', '3.9'],
    ],
    provider: { alias: 'agent_default', model: 'Qwen2.5-72B-Instruct' },
    facts: [],
    tools: ALL_TOOLS,
    toolsSummary: '11 local · hybrid_search · EconomicData · EconomicAnalysis',
    collections: [COLLECTION_IND],
    mcp: 'oxford_economics',
    groups: ['catalog_readers', 'tenant_admins'],
    limits: LIMITS,
    systemPrompt:
      'You answer questions about SCEAI economic indicators.\nAlways resolve indicators with find_indicator before reading values.\nQuote actual and target values with period and unit.\nOnly send public-domain questions to Oxford Economics. Never include\nlocal indicator codes, values or tenant information.',
    access: ACCESS_INDICATOR,
    jobs7d: 21,
    versions: (() => {
      const L = (collections: boolean, docs: boolean, requestLimit: number, analysis: boolean) =>
        indicatorLines({ name: agent.name, collections, docs, requestLimit, oxford: analysis ? ['EconomicData', 'EconomicAnalysis'] : ['EconomicData'] });
      return [
        { v: 'v6', by: 'r.haddad', when: '2 d ago', note: 'Added EconomicAnalysis tool', lines: L(true, true, 20, true) },
        { v: 'v5', by: 'r.haddad', when: '9 d ago', note: 'Raised request limit to 20', lines: L(true, true, 20, false) },
        { v: 'v4', by: 'm.alkuwari', when: '21 d ago', note: 'Tightened Oxford question template', lines: L(true, true, 15, false), promptOnly: true },
        { v: 'v3', by: 'm.alkuwari', when: '33 d ago', note: 'Added hybrid_search', lines: L(true, true, 15, false) },
        { v: 'v2', by: 'r.haddad', when: '47 d ago', note: 'Attached sceai_indicators', lines: L(true, false, 15, false) },
        { v: 'v1', by: 'r.haddad', when: '61 d ago', note: 'Created', lines: L(false, false, 15, false) },
      ];
    })(),
    metrics: {
      unit: 'Jobs',
      days: mkDays([[5, 1, 0], [7, 1, 0], [4, 0, 0], [6, 2, 0], [8, 1, 0], [7, 1, 0], [9, 2, 3]]),
      timeTitle: 'Where time goes · avg per job',
      time: [
        { label: 'Queue wait', value: '0.8 s', pct: 8, color: SOURCE_COLOR.queue },
        { label: 'Model calls', value: '5.1 s', pct: 52, color: SOURCE_COLOR.model },
        { label: 'Local tools', value: '0.9 s', pct: 10, color: SOURCE_COLOR.local },
        { label: 'Document search', value: '0.4 s', pct: 4, color: SOURCE_COLOR.documents },
        { label: 'Oxford MCP', value: '2.6 s', pct: 26, color: SOURCE_COLOR.oxford },
      ],
      failReasons: [
        { name: 'Oxford MCP 502', v: 2 },
        { name: 'Timeout (180 s)', v: 2 },
        { name: 'Tool-call limit', v: 1 },
        { name: 'Indicator not found', v: 1 },
      ],
    },
    test: {
      runAs: 'm.alkuwari',
      prompt: 'How did non-hydrocarbon exports perform against target in 2019?',
      steps: [
        { name: 'Plan', sub: 'agent_default · 2,846 in / 212 out tokens', dur: '2.1 s', mono: false, ms: 1400 },
        { name: 'find_indicator', sub: 'IND-TRD-031 · Non-Hydrocarbon Exports (share of total exports)', dur: '330 ms', mono: true, ms: 700 },
        { name: 'get_time_series', sub: '2017–2019 · 3 observations', dur: '220 ms', mono: true, ms: 600 },
        { name: 'actual_vs_target', sub: '2019 · 32.04% vs 50% target', dur: '160 ms', mono: true, ms: 550 },
        { name: 'hybrid_search', sub: 'National Development Strategy · Diversification · 1 hit', dur: '640 ms', mono: true, ms: 900 },
      ],
      answer:
        'Non-hydrocarbon exports were 32.04% of total exports in 2019, below the 50% target. The National Development Strategy lists export diversification as a priority under its diversification pillar.',
      footer: (calls, s) => `Composing answer · ${calls} / 15 tool calls · ${s}`,
    },
  };
}

// ---------------------------------------------------------------------------
// sceai_indicators_agent — same shape, local data + documents only.

function local(agent: Agent): AgentDetail {
  const L = (collections: boolean, docs: boolean, requestLimit: number) => indicatorLines({ name: agent.name, collections, docs, requestLimit, oxford: [] });
  const fails = new Map<string, number>();
  JOBS.filter((j) => j.agent === agent.id && j.status === 'failed').forEach((j) => {
    const k = j.reason?.startsWith('Tool-call') ? 'Tool-call limit' : j.reason?.includes('timeout') ? 'Timeout (180 s)' : j.reason?.includes('502') ? 'Oxford MCP 502' : j.reason ?? 'Other';
    fails.set(k, (fails.get(k) ?? 0) + 1);
  });
  return {
    agent,
    headline: 'Answers indicator questions submitted as jobs. Plans its own tool calls over local indicator data and documents, then writes the answer.',
    displayId: agent.uuid,
    created: '96 d ago by m.alkuwari',
    modified: '6 d ago · v4',
    version: 4,
    kpis: [
      ['Jobs · 24 h', String(agent.calls24h)],
      ['Success rate', `${agent.successRate}%`],
      ['p95 duration', '9.1 s'],
      ['Avg tool calls', '3.4'],
    ],
    provider: { alias: 'agent_default', model: 'Qwen2.5-72B-Instruct' },
    facts: [],
    tools: LOCAL_AND_DOCS,
    toolsSummary: '11 local · hybrid_search',
    collections: [COLLECTION_IND],
    groups: ['catalog_readers', 'tenant_admins'],
    limits: LIMITS,
    systemPrompt:
      'You answer questions about SCEAI economic indicators.\nAlways resolve indicators with find_indicator before\nreading values. Quote actual and target values with\nperiod and unit.',
    access: ACCESS_INDICATOR,
    jobs7d: 29,
    versions: [
      { v: 'v4', by: 'm.alkuwari', when: '6 d ago', note: 'Raised request limit to 20', lines: L(true, true, 20) },
      { v: 'v3', by: 'm.alkuwari', when: '33 d ago', note: 'Added hybrid_search', lines: L(true, true, 15) },
      { v: 'v2', by: 'r.haddad', when: '74 d ago', note: 'Attached sceai_indicators', lines: L(true, false, 15) },
      { v: 'v1', by: 'm.alkuwari', when: '96 d ago', note: 'Created', lines: L(false, false, 15) },
    ],
    metrics: {
      unit: 'Jobs',
      days: mkDays([[3, 0, 0], [5, 1, 0], [2, 0, 0], [4, 1, 0], [6, 0, 0], [3, 1, 0], [4, 1, 1]]),
      timeTitle: 'Where time goes · avg per job',
      time: [
        { label: 'Queue wait', value: '0.6 s', pct: 9, color: SOURCE_COLOR.queue },
        { label: 'Model calls', value: '4.6 s', pct: 70, color: SOURCE_COLOR.model },
        { label: 'Local tools', value: '0.9 s', pct: 14, color: SOURCE_COLOR.local },
        { label: 'Document search', value: '0.5 s', pct: 7, color: SOURCE_COLOR.documents },
      ],
      failReasons: [...fails.entries()].sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ name, v })),
    },
    test: {
      runAs: 'm.alkuwari',
      prompt: 'What was consumer price inflation in January 2019 and was it on target?',
      steps: [
        { name: 'Plan', sub: 'agent_default · 2,412 in / 186 out tokens', dur: '1.8 s', mono: false, ms: 1300 },
        { name: 'find_indicator', sub: 'IND-PRC-002 · Consumer Price Inflation (y/y)', dur: '310 ms', mono: true, ms: 700 },
        { name: 'get_indicator_value', sub: '2019-01 · −0.5%', dur: '180 ms', mono: true, ms: 550 },
        { name: 'actual_vs_target', sub: '2019-01 · −0.5% vs −0.3% target', dur: '150 ms', mono: true, ms: 550 },
      ],
      answer: 'Consumer price inflation was −0.5% in January 2019, below the −0.3% target.',
      footer: (calls, s) => `Composing answer · ${calls} / 15 tool calls · ${s}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Ask AI pipeline agents — from the agents-map drawer (`D` in app.js).

type PipeSpec = {
  key: string;
  headline: string;
  kpis: [string, string][];
  facts: [string, string][];
  prompt: string;
  prevPrompt: string;
  versions: Omit<AgentVersion, 'lines'>[];
  created: string;
  test: { prompt: string; sub: string; dur: string; answer: string };
  fails: { name: string; v: number }[];
  time: TimePart[];
};

const PIPE: Record<string, PipeSpec> = {
  'intent-agent': {
    key: 'intent',
    headline: 'Turns the question into structured fields: indicator, countries, periods, frequency and one computation type. It does not answer or calculate.',
    kpis: [['Calls · 7 d', '508'], ['p95', '410 ms'], ['Failed', '0.4%']],
    facts: [['Output', 'JSON · schema v3'], ['Retries', '1 on invalid JSON']],
    prompt:
      'Extract the request as JSON with fields:\nindicator, countries, periods, frequency, computation.\ncomputation is one of: latest_value, trend,\nperiod_comparison, country_comparison, country_ranking,\nperiod_ranking, min_max, difference, growth_rate,\ngeneral_chat, out_of_scope.\nDo not answer the question. Do not compute.',
    prevPrompt:
      'Extract the request as JSON with fields:\nindicator, countries, periods, frequency, computation.\ncomputation is one of: latest_value, trend,\nperiod_comparison, country_comparison, country_ranking,\nmin_max, difference, growth_rate, out_of_scope.\nDo not answer the question. Do not compute.',
    versions: [
      { v: 'v3', by: 'r.haddad', when: '12 d ago', note: 'Added period_ranking and general_chat' },
      { v: 'v2', by: 'm.alkuwari', when: '58 d ago', note: 'Output schema v3' },
      { v: 'v1', by: 'm.alkuwari', when: '140 d ago', note: 'Created' },
    ],
    created: '140 d ago by m.alkuwari',
    test: {
      prompt: "How did tourism's share of GDP change between Q4 2023 and Q4 2024?",
      sub: 'Qwen2.5-7B-Instruct · 612 in / 74 out tokens',
      dur: '410 ms',
      answer: '{ "indicator": "tourism share of GDP", "countries": ["QAT"], "periods": ["2023-Q4", "2024-Q4"], "frequency": "Q", "computation": "period_comparison" }',
    },
    fails: [{ name: 'Invalid JSON after retry', v: 2 }],
    time: [
      { label: 'Queue wait', value: '0.02 s', pct: 6, color: SOURCE_COLOR.queue },
      { label: 'Model calls', value: '0.31 s', pct: 94, color: SOURCE_COLOR.model },
    ],
  },
  'indicator-picker': {
    key: 'picker',
    headline: 'Runs only when the resolver is unsure. Chooses one real indicator name from the catalogue, or NONE.',
    kpis: [['Calls · 7 d', '31'], ['p95', '1.2 s'], ['NONE', '3.2%']],
    facts: [['Trigger', 'Resolver confidence below 0.70'], ['Catalogue', 'v2026.11.3 · 214 names']],
    prompt: 'You are given a question and a list of catalogue\nindicator names. Return exactly one name from the list,\nor NONE. Never invent or edit a name.',
    prevPrompt: 'You are given a question and a list of catalogue\nindicator names. Return exactly one name from the list.',
    versions: [
      { v: 'v2', by: 'r.haddad', when: '27 d ago', note: 'Allow NONE when no name fits' },
      { v: 'v1', by: 'm.alkuwari', when: '118 d ago', note: 'Created' },
    ],
    created: '118 d ago by m.alkuwari',
    test: {
      prompt: "How did tourism's share of GDP change between Q4 2023 and Q4 2024?",
      sub: 'Qwen2.5-72B-Instruct · 5 candidates from v2026.11.3',
      dur: '1.14 s',
      answer: '{ "picked": "Sector Contribution to GDP (Tourism)", "code": "IND-TOU-014" }',
    },
    fails: [{ name: 'Returned NONE', v: 1 }],
    time: [
      { label: 'Queue wait', value: '0.03 s', pct: 3, color: SOURCE_COLOR.queue },
      { label: 'Model calls', value: '1.11 s', pct: 97, color: SOURCE_COLOR.model },
    ],
  },
  'composer-agent': {
    key: 'composer',
    headline: 'The only agent that writes the final numeric answer. It restates the computed facts in English or Arabic and never calculates.',
    kpis: [['Calls · 7 d', '389'], ['p95', '2.6 s'], ['Rejected', '2.1%']],
    facts: [['Input', 'Computed facts + question'], ['Checked by', 'Numeric verifier']],
    prompt:
      'Write the answer using only the facts provided.\nRestate every number exactly as given, with its period\nand unit. Answer in the user’s language (English or\nArabic). Do not calculate, round or infer new numbers.',
    prevPrompt:
      'Write the answer using only the facts provided.\nRestate every number exactly as given, with its period\nand unit. Answer in English.',
    versions: [
      { v: 'v4', by: 'm.alkuwari', when: '9 d ago', note: 'Arabic answers' },
      { v: 'v3', by: 'r.haddad', when: '41 d ago', note: 'Streaming output' },
      { v: 'v2', by: 'r.haddad', when: '88 d ago', note: 'Numeric verifier check' },
      { v: 'v1', by: 'm.alkuwari', when: '140 d ago', note: 'Created' },
    ],
    created: '140 d ago by m.alkuwari',
    test: {
      prompt: '{ "facts": [3], "language": "en" }',
      sub: 'Qwen2.5-72B-Instruct · streaming',
      dur: '2.38 s',
      answer: 'Tourism contributed 8.8% of GDP in Q4 2024, up from 6.9% in Q4 2023, an increase of 1.9 percentage points.',
    },
    fails: [{ name: 'Rejected by numeric verifier', v: 8 }],
    time: [
      { label: 'Queue wait', value: '0.04 s', pct: 2, color: SOURCE_COLOR.queue },
      { label: 'Model calls', value: '2.34 s', pct: 98, color: SOURCE_COLOR.model },
    ],
  },
  'article-agent': {
    key: 'article',
    headline: 'Answers article questions only from the retrieved passages and names the sources it used.',
    kpis: [['Calls · 7 d', '92'], ['p95', '2.9 s'], ['Failed', '1.1%']],
    facts: [['Passages', 'Top 6 from SCEAI articles'], ['Citations', 'Required']],
    prompt: 'Answer only from the passages below. Cite each passage\nyou use by title. If the passages do not contain the\nanswer, say so.',
    prevPrompt: 'Answer only from the passages below. If the passages\ndo not contain the answer, say so.',
    versions: [
      { v: 'v2', by: 'r.haddad', when: '19 d ago', note: 'Citations required' },
      { v: 'v1', by: 'm.alkuwari', when: '96 d ago', note: 'Created' },
    ],
    created: '96 d ago by m.alkuwari',
    test: {
      prompt: 'What does the National Development Strategy say about export diversification?',
      sub: 'Qwen2.5-72B-Instruct · 6 passages · bge-m3',
      dur: '2.6 s',
      answer: 'The strategy treats export diversification as a priority of the diversification pillar (source: National Development Strategy · Diversification).',
    },
    fails: [{ name: 'No passage above threshold', v: 1 }],
    time: [
      { label: 'Queue wait', value: '0.03 s', pct: 1, color: SOURCE_COLOR.queue },
      { label: 'Document search', value: '0.14 s', pct: 5, color: SOURCE_COLOR.documents },
      { label: 'Model calls', value: '2.6 s', pct: 94, color: SOURCE_COLOR.model },
    ],
  },
  'follow-up-agent': {
    key: 'followup',
    headline: 'Suggests up to three next questions after the answer is shown. It never blocks or delays the answer.',
    kpis: [['Calls · 7 d', '470'], ['p95', '380 ms'], ['Failed', '0.6%']],
    facts: [['Runs', 'After answer, async'], ['Max', '3 suggestions']],
    prompt: 'Suggest up to 3 short follow-up questions about the same\nindicator or country. Return a JSON list of strings.',
    prevPrompt: 'Suggest up to 5 short follow-up questions about the same\nindicator. Return a JSON list of strings.',
    versions: [
      { v: 'v2', by: 'm.alkuwari', when: '33 d ago', note: 'Limited to 3 suggestions' },
      { v: 'v1', by: 'm.alkuwari', when: '140 d ago', note: 'Created' },
    ],
    created: '140 d ago by m.alkuwari',
    test: {
      prompt: 'Tourism contributed 8.8% of GDP in Q4 2024, up from 6.9% in Q4 2023.',
      sub: 'Qwen2.5-7B-Instruct · 388 in / 52 out tokens',
      dur: '360 ms',
      answer: '["How does this compare with the 2024 target?", "What was the tourism share in Q3 2024?", "How many hotel guests were there in Q4 2024?"]',
    },
    fails: [{ name: 'Invalid JSON', v: 3 }],
    time: [
      { label: 'Queue wait', value: '0.02 s', pct: 7, color: SOURCE_COLOR.queue },
      { label: 'Model calls', value: '0.28 s', pct: 93, color: SOURCE_COLOR.model },
    ],
  },
  'reader-agent': {
    key: 'reader',
    headline: 'Runs when a user presses "Read this for me". Rewrites the same facts in plain language and is checked by the numeric verifier.',
    kpis: [['Calls · 7 d', '44'], ['p95', '2.4 s'], ['Rejected', '0%']],
    facts: [['Trigger', 'User action'], ['Checked by', 'Numeric verifier']],
    prompt: 'Rewrite the answer in plain language for a general\nreader. Keep every number exactly as given.\nDo not add numbers.',
    prevPrompt: 'Rewrite the answer in plain language for a general\nreader.',
    versions: [
      { v: 'v2', by: 'r.haddad', when: '14 d ago', note: 'Keep numbers exactly' },
      { v: 'v1', by: 'r.haddad', when: '52 d ago', note: 'Created' },
    ],
    created: '52 d ago by r.haddad',
    test: {
      prompt: 'Tourism contributed 8.8% of GDP in Q4 2024, up from 6.9% in Q4 2023, an increase of 1.9 percentage points.',
      sub: 'Qwen2.5-72B-Instruct · checked by numeric verifier',
      dur: '2.1 s',
      answer: 'At the end of 2024, tourism made up 8.8% of the economy. A year earlier it was 6.9%, so its share grew by 1.9 points.',
    },
    fails: [],
    time: [
      { label: 'Queue wait', value: '0.03 s', pct: 1, color: SOURCE_COLOR.queue },
      { label: 'Model calls', value: '2.1 s', pct: 99, color: SOURCE_COLOR.model },
    ],
  },
};

const fullModel = (m: string) => (m.endsWith('-Instruct') ? m : `${m}-Instruct`);
export const providerFor = (model: string) => (model.includes('7B') && !model.includes('72B') ? 'chat_default' : 'agent_default');

function pipeline(agent: Agent): AgentDetail {
  const p = PIPE[agent.id];
  const model = fullModel(agent.model);
  const alias = providerFor(agent.model);
  const stage = agent.type.replace('pipeline · ', '');
  const cfg = (prompt: string) =>
    jsonLines({
      name: agent.name,
      type: agent.type.replace(' · ', ':'),
      pipeline: 'ask_ai_chat',
      model_provider: alias,
      model,
      collections: agent.collections,
      system_prompt: prompt.split('\n'),
    });
  const cur = p.versions[0];
  const nNum = Number(cur.v.slice(1));
  const calls7d = Number(p.kpis[0][1]);
  const perDay = calls7d / 7;
  const failPct = parseFloat(p.kpis[2][1]) / 100;
  const shape = [0.92, 1.08, 0.7, 0.86, 1.12, 1.04, 1.28];
  const days = shape.map((s, i) => {
    const t = Math.max(1, Math.round(perDay * s));
    const fail = Math.round(t * failPct);
    return { label: DAY_LABELS[i], ok: t - fail, fail, run: 0 };
  });
  return {
    agent,
    headline: p.headline,
    displayId: agent.uuid,
    created: p.created,
    modified: `${cur.when} · ${cur.v}`,
    version: nNum,
    kpis: [['Calls · 24 h', String(agent.calls24h)], ...p.kpis, ['Success · 24 h', `${agent.successRate}%`]],
    provider: { alias, model },
    facts: [['Stage', `Ask AI · ${stage}`], ...p.facts],
    tools: [],
    toolsSummary: 'None · pipeline step (no tool calls)',
    collections: agent.collections.map((c) =>
      c === 'Catalogue'
        ? { name: 'Catalogue', meta: 'v2026.11.3 · 214 indicator names', kind: 'catalogue' as const }
        : { name: c, meta: 'Article passages · bge-m3 embeddings', kind: 'articles' as const },
    ),
    groups: ['tenant_admins'],
    limits: [
      ['Timeout', '30 s'],
      ['Max retries', '1'],
      ['Request limit', '1'],
      ['Tool-call limit', '0'],
      ['Max in-flight', 'Pipeline'],
    ],
    systemPrompt: p.prompt,
    access: ACCESS_PIPELINE,
    jobs7d: calls7d,
    versions: p.versions.map((v, i) => ({ ...v, lines: cfg(i === 0 ? p.prompt : p.prevPrompt) })),
    metrics: {
      unit: 'Calls',
      days,
      timeTitle: 'Where time goes · avg per call',
      time: p.time,
      failReasons: p.fails,
    },
    test: {
      runAs: 'm.alkuwari',
      prompt: p.test.prompt,
      steps: [{ name: 'Model call', sub: p.test.sub, dur: p.test.dur, mono: false, ms: 1500 }],
      answer: p.test.answer,
      footer: (_c, s) => `Writing output · ${s}`,
    },
  };
}

export function buildAgentDetail(id: string | undefined): AgentDetail | null {
  const agent = agentById(id);
  if (!agent) return null;
  if (agent.id === 'sceai_indicators_oxford') return oxford(agent);
  if (agent.id === 'sceai_indicators_agent') return local(agent);
  return pipeline(agent);
}

// ---------------------------------------------------------------------------
// Create-agent wizard

export const WIZARD_STEPS = ['Basics', 'Model', 'Knowledge', 'Tools', 'System instructions', 'Access', 'Review + create'];

export const WIZARD_LOCAL_TOOLS = TOOLS.filter((t) => t.source === 'local').map((t) => ({ name: t.name, description: t.description }));

// ---------------------------------------------------------------------------
// Model providers (project aliases → platform-served models)

export interface Provider {
  name: string;
  kind: string;
  model: string;
  endpoint: string;
  usedBy: string;
  usedByAgents: string[];
  usedByCollections: string[];
  load: string;
  p95: string;
  updated: string;
  status: 'healthy' | 'degraded';
}

const agentsUsing = (alias: string) => AGENTS.filter((a) => (a.kind === 'kap' ? 'agent_default' : providerFor(a.model)) === alias).map((a) => a.id);

export const PROVIDERS: Provider[] = [
  {
    name: 'agent_default',
    kind: 'Chat · tool calling',
    model: 'Qwen2.5-72B-Instruct',
    endpoint: 'vllm.kap.internal/v1',
    usedBy: '',
    usedByAgents: agentsUsing('agent_default'),
    usedByCollections: [],
    load: '38 req/min',
    p95: '2.9 s',
    updated: '61 d ago',
    status: 'healthy',
  },
  {
    name: 'chat_default',
    kind: 'Chat · router',
    model: 'Qwen2.5-7B-Instruct',
    endpoint: 'vllm.kap.internal/v1',
    usedBy: '',
    usedByAgents: agentsUsing('chat_default'),
    usedByCollections: [],
    load: '52 req/min',
    p95: '410 ms',
    updated: '142 d ago',
    status: 'healthy',
  },
  {
    name: 'embed_default',
    kind: 'Embedding',
    model: 'BAAI/bge-m3 · 1024-d',
    endpoint: 'vllm.kap.internal/embed',
    usedBy: '',
    usedByAgents: [],
    usedByCollections: ['sceai_indicators'],
    load: '71 req/min',
    p95: '60 ms',
    updated: '142 d ago',
    status: 'healthy',
  },
].map((p) => ({
  ...p,
  status: p.status as Provider['status'],
  usedBy: [p.usedByAgents.length ? `${p.usedByAgents.length} agent${p.usedByAgents.length > 1 ? 's' : ''}` : '', p.usedByCollections.length ? `${p.usedByCollections.length} collection` : '']
    .filter(Boolean)
    .join(' · '),
}));

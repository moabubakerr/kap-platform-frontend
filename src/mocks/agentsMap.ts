/**
 * Agents map (Ask AI pipeline on KAP) — design-ref/app.js `pipe()`.
 * Coordinates are final canvas positions (the prototype's +220 x / +48 y
 * shifts are already applied). Canvas is 1840px wide.
 */

export type MapNodeType = 'ch' | 'queue' | 'ai' | 'code' | 'store' | 'model' | 'ext';

export interface MapNode {
  id: string;
  type: MapNodeType;
  x: number;
  y: number;
  name: string;
  sub: string;
  /** Model chip (AI agents). */
  chip: string;
  /** Footer metric in historical modes (7-day stats). */
  histMetric: string;
  /** Footer metric in live mode. */
  liveMetric: string;
}

export interface MapEdge {
  from: string;
  to: string;
  /** SVG path. */
  d: string;
  /** Historical stroke width (= message volume). */
  width: number;
  dashed: boolean;
  /** Carries traffic in live mode (particles). */
  active: boolean;
}

export interface MapLabel {
  x: number;
  y: number;
  text: string;
  color: string;
  border: string;
  /** Node the label belongs to (dimmed with it under Highlight path). */
  node: string;
}

export interface AgentDetail {
  kind: string;
  purpose: string;
  stats: [string, string][];
  kv: [string, string][];
  prompt: string;
}

export interface MapLane {
  x: number;
  n: string;
  title: string;
  meta: string;
}

export interface DeprecatedNode {
  name: string;
  desc: string;
  why: string;
  x: number;
}

export interface TickerItem {
  text: string;
  color: string;
}

export interface AgentsMapData {
  nodes: MapNode[];
  edges: MapEdge[];
  labels: MapLabel[];
  laneBg: { x: number; w: number; bg: string }[];
  lanes: MapLane[];
  deprecated: DeprecatedNode[];
  details: Record<string, AgentDetail>;
  /** Nodes active in live mode. */
  activeIds: string[];
  /** Route of message 7f21a9 (Highlight path). */
  highlightIds: string[];
  ticker: TickerItem[];
  inFlight: number;
}

const RAW_NODES: [string, MapNodeType, number, number, string, string, string, string, string][] = [
  ['web', 'ch', 20, 110, 'Ask AI web chat', 'Channel · English and Arabic', '', '412 msgs · 7 d', '2 in flight'],
  ['api', 'ch', 20, 220, '/ask API', 'Channel · token auth', '', '96 msgs · 7 d', '1 in flight'],
  ['intent', 'ai', 240, 140, 'Intent Agent', 'Question → indicator, countries, periods, computation type', 'Qwen2.5-7B', '508 calls · p95 410 ms · 0.4% failed', 'Active · 1 message'],
  ['resolver', 'code', 460, 96, 'Indicator, country and period resolvers', 'Embedding match · bge-m3', '', '508 runs · p95 90 ms', 'Active'],
  ['picker', 'ai', 460, 250, 'Indicator Picker', 'Fallback · picks a catalogue name or NONE', 'Qwen2.5-72B', '31 calls · p95 1.2 s · 3.2% NONE', 'Active · 1 message'],
  ['engine', 'code', 690, 96, 'Compute engine', 'Deterministic · 11 computation types', '', '389 runs · p95 45 ms · 0 errors', 'Active'],
  ['pgdb', 'store', 690, 200, 'Indicators DB', 'Postgres · catalogue v2026.11.3', '', '1,204 reads · 7 d', 'Reading'],
  ['retrieval', 'code', 690, 320, 'Article retrieval', 'Top-k passages · bge-m3', '', '92 runs · p95 140 ms', 'Active'],
  ['vecdb', 'store', 690, 424, 'SCEAI articles', 'Vector store · 2,184 passages', '', '92 queries · 7 d', 'Idle'],
  ['composer', 'ai', 920, 96, 'Composer Agent', 'Only agent that writes the numeric answer · streaming', 'Qwen2.5-72B', '389 calls · p95 2.6 s · 2.1% rejected', 'Streaming · AR'],
  ['article', 'ai', 920, 320, 'Article Agent', 'Answers only from retrieved passages, names sources', 'Qwen2.5-72B', '92 calls · p95 2.9 s · 1.1% failed', 'Active · 1 message'],
  ['verifier', 'code', 1150, 104, 'Numeric verifier', 'Checks every number against computed facts', '', '433 checks · 2.1% rejected', 'Checking'],
  ['template', 'code', 1150, 240, 'Template answer', 'Used when verification fails', '', '8 answers · 7 d', 'Idle'],
  ['followup', 'ai', 920, 530, 'Follow-up Agent', 'Up to 3 next questions · never blocks', 'Qwen2.5-7B', '470 calls · p95 380 ms', 'Idle'],
  ['reader', 'ai', 1150, 530, 'Reader Agent', '"Read this for me" · plain language', 'Qwen2.5-72B', '44 calls · p95 2.4 s · 0% rejected', 'Idle'],
  ['m72', 'model', 1400, 96, 'Qwen2.5-72B-Instruct', 'Main · indicator agents, Picker, Composer, Article, Reader', '', '38 req/min · p95 2.9 s', '38 req/min · p95 2.9 s'],
  ['m7', 'model', 1400, 262, 'Qwen2.5-7B-Instruct', 'Fast / router · Intent, Follow-up', '', '52 req/min · p95 410 ms', '52 req/min · p95 410 ms'],
  ['bge', 'model', 1400, 424, 'BAAI/bge-m3', 'Embeddings · resolvers, retrieval', '', '71 req/min · p95 60 ms', '71 req/min · p95 60 ms'],
  ['queue', 'queue', 240, 280, 'kap.agent queue', 'All Ask AI requests', '', '508 requests · p95 wait 0.4 s', '6 in flight · 1 waiting'],
  ['pa_local', 'ai', 240, 308, 'sceai_indicators_agent', 'SCEAI indicators · local data and documents', 'Qwen2.5-72B', '389 requests · p95 1.1 s · 0.8% failed', 'Routing to resolvers'],
  ['pa_ox', 'ai', 240, 476, 'sceai_indicators_oxford', 'Local data + Oxford Economics context', 'Qwen2.5-72B', '51 requests · p95 3.4 s · 4% failed', 'Calling Oxford · 1 open'],
  ['guard', 'code', 460, 612, 'Leak guard', 'Strips local data · public question', '', '51 runs · 0 blocked', 'Checking outbound question'],
  ['oxmcp', 'ext', 910, 612, 'Oxford Economics MCP', 'External · 2 tools', '', '51 calls · p95 2.6 s · 16% errors', 'EconomicData · 1.8 s'],
];

const NO_X_SHIFT = new Set(['web', 'api', 'queue', 'oxmcp']);

export const MAP_NODES: MapNode[] = RAW_NODES.map(([id, type, x, y, name, sub, chip, histMetric, liveMetric]) => ({
  id,
  type,
  x: NO_X_SHIFT.has(id) ? x : x + 220,
  y: y < 700 && id !== 'queue' ? y + 48 : y,
  name,
  sub,
  chip,
  histMetric,
  liveMetric,
}));

/** Rendered min-height per node type. */
export const nodeHeight = (t: MapNodeType) => (t === 'ai' ? 96 : t === 'model' ? 84 : 76);
export const NODE_W = 190;

const N: Record<string, { x: number; y: number; h: number }> = Object.fromEntries(MAP_NODES.map((n) => [n.id, { x: n.x, y: n.y, h: nodeHeight(n.type) }]));

/** Horizontal bezier from A's right edge to B's left edge. */
const hor = (a: string, b: string, ya?: number, yb?: number) => {
  const A = N[a];
  const B = N[b];
  const x1 = A.x + NODE_W;
  const x2 = B.x;
  const dx = Math.max(20, (x2 - x1) / 2);
  const y1 = ya ?? A.y + A.h / 2;
  const y2 = yb ?? B.y + B.h / 2;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
};
/** Vertical line from A's bottom centre to B's top centre. */
const ver = (a: string, b: string) => {
  const A = N[a];
  const B = N[b];
  return `M${A.x + 95},${A.y + A.h} L${B.x + 95},${B.y}`;
};

const RAW_EDGES: [string, string, string, number, 0 | 1, 0 | 1][] = [
  ['web', 'queue', hor('web', 'queue'), 6, 0, 1],
  ['queue', 'intent', hor('queue', 'intent', 590, 236), 6, 0, 1],
  ['api', 'queue', hor('api', 'queue'), 2.5, 0, 0],
  ['intent', 'pa_local', 'M555,318 L555,356', 6, 0, 1],
  ['pa_local', 'resolver', hor('pa_local', 'resolver', 410, 200), 6, 0, 1],
  ['intent', 'retrieval', hor('intent', 'retrieval', 258, 406), 2.5, 0, 1],
  ['intent', 'composer', 'M555,188 C555,112 1235,104 1235,144', 1.5, 0, 0],
  ['resolver', 'picker', ver('resolver', 'picker'), 1.5, 1, 1],
  ['resolver', 'engine', hor('resolver', 'engine'), 5.5, 0, 0],
  ['picker', 'engine', hor('picker', 'engine', 346, 198), 1.5, 1, 1],
  ['engine', 'pgdb', ver('engine', 'pgdb'), 4, 0, 1],
  ['retrieval', 'vecdb', ver('retrieval', 'vecdb'), 2.5, 0, 1],
  ['engine', 'composer', hor('engine', 'composer'), 5.5, 0, 1],
  ['retrieval', 'article', hor('retrieval', 'article'), 2.5, 0, 1],
  ['composer', 'verifier', hor('composer', 'verifier', 188, 190), 5.5, 0, 1],
  ['verifier', 'template', ver('verifier', 'template'), 1.5, 1, 0],
  ['composer', 'followup', 'M1140,218 C1116,218 1116,626 1140,626', 4, 1, 0],
  ['reader', 'verifier', 'M1560,626 C1598,626 1598,190 1560,190', 1.5, 1, 0],
  ['intent', 'pa_ox', 'M470,318 C436,350 436,566 460,574', 2.5, 0, 1],
  ['pa_ox', 'guard', hor('pa_ox', 'guard', 586, 698), 2.5, 0, 1],
  ['guard', 'oxmcp', hor('guard', 'oxmcp'), 2.5, 0, 1],
  ['oxmcp', 'composer', 'M1100,698 C1122,698 1118,228 1140,228', 2.5, 0, 1],
];

export const MAP_EDGES: MapEdge[] = RAW_EDGES.map(([from, to, d, width, dash, act]) => ({ from, to, d, width, dashed: !!dash, active: !!act }));

const MUTED = 'var(--text-muted)';
const SUBTLE = 'var(--border-subtle)';
const WARN = 'var(--warning-fg)';
const WARN_B = '#F1DDB4';

export const MAP_LABELS: MapLabel[] = (
  [
    [440, 72, 'SCEAI indicators 61%', MUTED, SUBTLE, 'resolver'],
    [470, 374, 'Articles 18%', MUTED, SUBTLE, 'retrieval'],
    [560, 34, 'General chat / out of scope 11% → Composer', MUTED, SUBTLE, 'composer'],
    [462, 220, 'Indicator Picker used on 6% of questions', WARN, WARN_B, 'picker'],
    [1152, 212, 'Verifier rejected 2.1% → template', WARN, WARN_B, 'verifier'],
    [1250, 470, 'Same numeric check', MUTED, SUBTLE, 'reader'],
  ] as [number, number, string, string, string, string][]
)
  .map(([x, y, t, c, b, n]): [number, number, string, string, string, string] => [x + 220, y + 48, t, c, b, n])
  .concat([
    [240, 500, 'Oxford Economics 10%', MUTED, SUBTLE, 'guard'],
    [682, 790, '0 blocked · 7 d', 'var(--success-fg)', 'var(--success-border)', 'guard'],
    [912, 790, 'Errors 16% · retried once', WARN, WARN_B, 'oxmcp'],
  ])
  .map(([x, y, text, color, border, node]) => ({ x, y, text, color, border, node }));

const STRIPE = 'rgba(240,236,234,.35)';
export const LANE_BG = (
  [
    [0, 226, 'transparent'],
    [226, 222, STRIPE],
    [448, 222, 'transparent'],
    [670, 230, STRIPE],
    [900, 230, 'transparent'],
    [1130, 470, STRIPE],
    [1600, 240, 'transparent'],
  ] as [number, number, string][]
).map(([x, w, bg]) => ({ x, w, bg }));

export const MAP_LANES: MapLane[] = (
  [
    [20, '01', 'Channels', ''],
    [240, '02', 'Queue', ''],
    [460, '03', 'Understand & route', ''],
    [680, '04', 'Resolve', ''],
    [910, '05', 'Compute', ''],
    [1140, '06', 'Compose & verify', ''],
    [1620, '07', 'Models', 'shared'],
  ] as [number, string, string, string][]
).map(([x, n, title, meta]) => ({ x, n, title, meta }));

export const DEPRECATED: DeprecatedNode[] = (
  [
    ['Router', 'v1 · LLM chose the next agent', 'Non-deterministic routing'],
    ['SQL Agent', 'v1 · wrote free-form SQL', 'Wrong joins and filters'],
    ['Analyst Agent', 'v1 · model arithmetic', 'Wrong numbers'],
    ['Chart Agent', 'v1 · generated chart specs', 'Unverified series'],
    ['Verifier (LLM)', 'v1 · model checked model', 'Missed numeric errors'],
  ] as [string, string, string][]
).map(([name, desc, why], i) => ({ name, desc, why, x: 40 + i * 310 }));

const D = (kind: string, purpose: string, stats: [string, string][], kv: [string, string][], prompt: string): AgentDetail => ({ kind, purpose, stats, kv, prompt });

export const AGENT_DETAILS: Record<string, AgentDetail> = {
  intent: D(
    'AI agent · Qwen2.5-7B-Instruct',
    'Turns the question into structured fields: indicator, countries, periods, frequency and one computation type. It does not answer or calculate.',
    [['Calls · 7 d', '508'], ['p95', '410 ms'], ['Failed', '0.4%']],
    [['Model', 'Qwen2.5-7B-Instruct'], ['Output', 'JSON · schema v3'], ['Retries', '1 on invalid JSON']],
    'Extract the request as JSON with fields:\nindicator, countries, periods, frequency, computation.\ncomputation is one of: latest_value, trend,\nperiod_comparison, country_comparison, country_ranking,\nperiod_ranking, min_max, difference, growth_rate,\ngeneral_chat, out_of_scope.\nDo not answer the question. Do not compute.',
  ),
  picker: D(
    'AI agent · Qwen2.5-72B-Instruct · fallback',
    'Runs only when the resolver is unsure. Chooses one real indicator name from the catalogue, or NONE.',
    [['Calls · 7 d', '31'], ['p95', '1.2 s'], ['NONE', '3.2%']],
    [['Model', 'Qwen2.5-72B-Instruct'], ['Trigger', 'Resolver confidence below 0.70'], ['Catalogue', 'v2026.11.3 · 214 names']],
    'You are given a question and a list of catalogue\nindicator names. Return exactly one name from the list,\nor NONE. Never invent or edit a name.',
  ),
  composer: D(
    'AI agent · Qwen2.5-72B-Instruct · streaming',
    'The only agent that writes the final numeric answer. It restates the computed facts in English or Arabic and never calculates.',
    [['Calls · 7 d', '389'], ['p95', '2.6 s'], ['Rejected', '2.1%']],
    [['Model', 'Qwen2.5-72B-Instruct'], ['Input', 'Computed facts + question'], ['Checked by', 'Numeric verifier']],
    'Write the answer using only the facts provided.\nRestate every number exactly as given, with its period\nand unit. Answer in the user’s language (English or\nArabic). Do not calculate, round or infer new numbers.',
  ),
  article: D(
    'AI agent · Qwen2.5-72B-Instruct',
    'Answers article questions only from the retrieved passages and names the sources it used.',
    [['Calls · 7 d', '92'], ['p95', '2.9 s'], ['Failed', '1.1%']],
    [['Model', 'Qwen2.5-72B-Instruct'], ['Passages', 'Top 6 from SCEAI articles'], ['Citations', 'Required']],
    'Answer only from the passages below. Cite each passage\nyou use by title. If the passages do not contain the\nanswer, say so.',
  ),
  followup: D(
    'AI agent · Qwen2.5-7B-Instruct · side agent',
    'Suggests up to three next questions after the answer is shown. It never blocks or delays the answer.',
    [['Calls · 7 d', '470'], ['p95', '380 ms'], ['Failed', '0.6%']],
    [['Model', 'Qwen2.5-7B-Instruct'], ['Runs', 'After answer, async'], ['Max', '3 suggestions']],
    'Suggest up to 3 short follow-up questions about the same\nindicator or country. Return a JSON list of strings.',
  ),
  pa_local: D(
    'AI agent · planner_and_executor · Qwen2.5-72B-Instruct',
    'Answers indicator questions submitted as jobs. Plans its own tool calls over local indicator data and documents, then writes the answer.',
    [['Jobs · 7 d', '29'], ['p95', '9.1 s'], ['Failed', '10%']],
    [['Model', 'Qwen2.5-72B-Instruct'], ['Tools', '11 local + hybrid_search'], ['Limits', '180 s · 15 tool calls · 20 requests']],
    'You answer questions about SCEAI economic indicators.\nAlways resolve indicators with find_indicator before\nreading values. Quote actual and target values with\nperiod and unit.',
  ),
  pa_ox: D(
    'AI agent · planner_and_executor · Qwen2.5-72B-Instruct',
    'Same as sceai_indicators_agent, plus public macro context from Oxford Economics. Only public questions leave the project boundary.',
    [['Jobs · 7 d', '21'], ['p95', '12.8 s'], ['Failed', '24%']],
    [['Model', 'Qwen2.5-72B-Instruct'], ['Tools', '11 local + hybrid_search + 2 Oxford'], ['Leak guard', 'On · 0 blocked in 7 d']],
    'Only send public-domain questions to Oxford Economics.\nNever include local indicator codes, values or tenant\ninformation. Keep local and external figures in\nseparate sentences.',
  ),
  reader: D(
    'AI agent · Qwen2.5-72B-Instruct · on demand',
    'Runs when a user presses "Read this for me". Rewrites the same facts in plain language and is checked by the numeric verifier.',
    [['Calls · 7 d', '44'], ['p95', '2.4 s'], ['Rejected', '0%']],
    [['Model', 'Qwen2.5-72B-Instruct'], ['Trigger', 'User action'], ['Checked by', 'Numeric verifier']],
    'Rewrite the answer in plain language for a general\nreader. Keep every number exactly as given.\nDo not add numbers.',
  ),
};

export const INITIAL_TICKER: TickerItem[] = [
  { text: 'msg 7f21c0 · AR · composing', color: 'var(--info)' },
  { text: 'msg 7f21ad · EN · Oxford EconomicData', color: '#0F766E' },
  { text: 'msg 7f21b8 · EN · Indicator Picker', color: 'var(--warning)' },
];

export const AGENTS_MAP: AgentsMapData = {
  nodes: MAP_NODES,
  edges: MAP_EDGES,
  labels: MAP_LABELS,
  laneBg: LANE_BG,
  lanes: MAP_LANES,
  deprecated: DEPRECATED,
  details: AGENT_DETAILS,
  activeIds: ['web', 'intent', 'picker', 'composer', 'verifier', 'article', 'retrieval', 'pgdb', 'engine', 'm72', 'm7', 'queue', 'guard', 'oxmcp', 'pa_local', 'pa_ox'],
  highlightIds: ['web', 'queue', 'intent', 'pa_local', 'resolver', 'picker', 'engine', 'pgdb', 'composer', 'verifier', 'followup', 'm72', 'm7', 'bge'],
  ticker: INITIAL_TICKER,
  inFlight: 6,
};

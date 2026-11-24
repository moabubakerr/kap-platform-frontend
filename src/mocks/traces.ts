// Trace detail mocks. Job 93c7a1f2 reproduces the design (design-ref/app.js
// renderVals(): meters, spans, rawLines, logs). Every other job in JOBS gets a
// deterministic, plausible trace built from its question, agent, status and
// failure reason.
import type { Job, JobStatus } from '@/types';
import { jobById, SOURCE_COLOR } from './core';

export type SpanSource = 'queue' | 'model' | 'local' | 'documents' | 'oxford';
export type SpanState = 'ok' | 'error' | 'running' | 'cancelled';

export interface TraceSpan {
  id: string;
  /** Timeline label (e.g. "Oxford · EconomicData"). */
  name: string;
  /** Name in the raw job record (e.g. "EconomicData"). */
  rawName: string;
  kind: 'Queue wait' | 'Model call' | 'Tool';
  source: SpanSource;
  mono: boolean;
  startS: number;
  durS: number;
  startMs: number;
  durMs: number;
  state: SpanState;
  error?: string;
  input?: unknown;
  output?: unknown;
  /** Short result used in logs. */
  result?: string;
  tokens?: [number, number];
}

export type AnswerPart = string | { v: string; ref: string; src: 'local' | 'oxford' | 'documents' };

export interface TraceLog {
  t: string;
  lv: 'INFO' | 'WARN' | 'ERROR';
  m: string;
}

export interface LocalRef {
  ref: string;
  indicator: string;
  period: string;
  actual: string;
  target?: string;
  unit: string;
  org: string;
  fileRow: string;
}

export interface Trace {
  job: Job;
  uuid: string;
  status: JobStatus;
  statusLabel: string;
  reason?: string;
  prompt: string;
  answer: AnswerPart[] | null;
  duration: string;
  durationS: number;
  createdRel: string;
  createdAbs: string;
  updatedRel: string;
  retries: number;
  queue: string;
  meters: { k: string; v: string; p: number; danger?: boolean }[];
  leak: { tone: 'ok' | 'neutral'; text: string };
  spans: TraceSpan[];
  defaultSpan: string;
  axis: string[];
  provenance: {
    local: LocalRef[];
    docs: { ref: string; doc: string; section: string; passage: string }[];
    external: { ref: string; tool: string; question: string; value: string } | null;
    oxfordAgent: boolean;
  };
  rawLines: string[];
  logs: TraceLog[];
}

export const SPAN_COLOR: Record<SpanSource, string> = {
  queue: SOURCE_COLOR.queue,
  model: SOURCE_COLOR.model,
  local: SOURCE_COLOR.local,
  documents: SOURCE_COLOR.documents,
  oxford: SOURCE_COLOR.oxford,
};

// ---------------------------------------------------------------- helpers

function seeded(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let x = h >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

export const fmtSpanDur = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`);

export const fmtJobDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} m ${String(Math.round(s % 60)).padStart(2, '0')} s` : `${s.toFixed(1)} s`);

/** Axis tick: quarter points rounded to 0.5 s (short jobs) or whole seconds. */
function tick(v: number, last: boolean) {
  if (v === 0) return '0';
  const r = last ? Math.round(v * 10) / 10 : v < 20 ? Math.round(v * 2) / 2 : Math.round(v);
  if (r >= 60) return fmtJobDur(r);
  return `${Number.isInteger(r) ? r : r.toFixed(1)} s`;
}
export const axisFor = (T: number) => [0, 0.25, 0.5, 0.75, 1].map((f, i) => tick(T * f, i === 4));

const L = (v: string, ref = 'L1'): AnswerPart => ({ v, ref, src: 'local' });
const X = (v: string, ref = 'X1'): AnswerPart => ({ v, ref, src: 'oxford' });
const D = (v: string, ref = 'D1'): AnswerPart => ({ v, ref, src: 'documents' });

const OX = {
  question: "What was Qatar's real GDP growth in 2023?",
  output: { country: 'Qatar', indicator: 'Real GDP growth', year: 2023, value: 1.56, unit: '% y/y' },
  value: '1.56%',
};

// ---------------------------------------------------------------- scenarios

interface Scenario {
  match: RegExp;
  code: string;
  query: string;
  periodCode: string;
  local: LocalRef[];
  tools: string[];
  doc?: { doc: string; section: string; passage: string };
  answer: (ox: boolean) => AnswerPart[];
  notFound?: boolean;
}

const TOURISM: LocalRef = {
  ref: 'L1',
  indicator: 'Sector Contribution to GDP (Tourism)',
  period: 'Q4 2024',
  actual: '8.8%',
  target: '7.6%',
  unit: '% of GDP',
  org: 'Qatar Tourism',
  fileRow: 'sceai_indicators_quarterly.csv · 2214',
};
const oxSentence = (lead: string, tail = ' in 2023.'): AnswerPart[] => [lead, X(OX.value), tail];

const SCENARIOS: Scenario[] = [
  {
    match: /trend/i,
    code: 'IND-TOU-014',
    query: 'tourism sector contribution to GDP',
    periodCode: '2024-Q4',
    local: [TOURISM, { ...TOURISM, ref: 'L2', period: 'Q4 2023', actual: '6.9%', fileRow: 'sceai_indicators_quarterly.csv · 2210' }],
    tools: ['find_indicator', 'get_time_series', 'get_change'],
    answer: (ox) => [
      "Tourism's share of GDP rose from ",
      L('6.9%', 'L2'),
      ' in Q4 2023 to ',
      L('8.8%', 'L1'),
      ' in Q4 2024, an increase of 1.9 percentage points.',
      ...(ox ? oxSentence(" For comparison, Oxford Economics estimates Qatar's real GDP grew by ", ' in 2023, so tourism outpaced the wider economy.') : []),
    ],
  },
  {
    match: /moved the most/i,
    code: 'IND-TOU-014',
    query: 'top movers Q4 2024',
    periodCode: '2024-Q4',
    local: [{ ...TOURISM, target: undefined, actual: '+1.9 pp', unit: 'pp, year on year' }],
    tools: ['top_movers', 'get_change'],
    answer: () => ['The largest move in Q4 2024 was the tourism sector contribution to GDP, up ', L('1.9 pp'), ' year on year. Most other quarterly indicators moved by less than 0.5 points.'],
  },
  {
    match: /off track/i,
    code: 'IND-TRD-031',
    query: 'indicators off track',
    periodCode: '2024',
    local: [
      { ref: 'L1', indicator: 'Non-Hydrocarbon Exports (share of total exports)', period: '2019', actual: '32.04%', target: '50%', unit: '% of total exports', org: 'Planning and Statistics Authority', fileRow: 'sceai_indicators_annual.csv · 412' },
    ],
    tools: ['get_status', 'query_indicators', 'get_narratives', 'hybrid_search'],
    doc: { doc: 'National Development Strategy', section: 'Economic diversification', passage: 'Expand non-hydrocarbon exports through manufacturing, logistics and services.' },
    answer: () => ['Non-hydrocarbon exports are the main indicator off track, at ', L('32.04%'), ' of total exports against a 50% target. The ', D('National Development Strategy'), ' links this to manufacturing and logistics growth.'],
  },
  {
    match: /on track/i,
    code: '—',
    query: 'indicators on track 2024',
    periodCode: '2024',
    local: [{ ref: 'L1', indicator: 'Indicator status (all tracked indicators)', period: '2024', actual: '6 of 9 on track', unit: 'count', org: 'SCEAI', fileRow: 'sceai_indicators_annual.csv · status' }],
    tools: ['get_status', 'query_indicators'],
    answer: () => [L('6 of 9'), ' tracked indicators are on track against their 2024 targets. Tourism share of GDP is furthest above target.'],
  },
  {
    match: /tourism/i,
    code: 'IND-TOU-014',
    query: 'tourism sector contribution to GDP',
    periodCode: '2024-Q4',
    local: [TOURISM],
    tools: ['find_indicator', 'get_indicator_value', 'actual_vs_target'],
    answer: (ox) => [
      'In Q4 2024 the tourism sector contributed ',
      L('8.8%'),
      ' of GDP against a target of ',
      L('7.6%'),
      ', putting it 1.2 percentage points above target.',
      ...(ox ? oxSentence(" For wider context, Oxford Economics estimates Qatar's real GDP grew by ") : []),
    ],
  },
  {
    match: /inflation/i,
    code: 'IND-PRC-002',
    query: 'consumer price inflation',
    periodCode: '2019-01',
    local: [{ ref: 'L1', indicator: 'Consumer Price Inflation (YoY)', period: 'January 2019', actual: '−0.5%', target: '−0.3%', unit: '% y/y', org: 'Planning and Statistics Authority', fileRow: 'sceai_indicators_monthly.csv · 1187' }],
    tools: ['find_indicator', 'get_indicator_value', 'actual_vs_target'],
    answer: () => ['Consumer price inflation in January 2019 was ', L('−0.5%'), ' against a target of ', L('−0.3%'), ', 0.2 percentage points below target.'],
  },
  {
    match: /non-hydrocarbon/i,
    code: 'IND-TRD-031',
    query: 'non-hydrocarbon exports share',
    periodCode: '2019',
    local: [{ ref: 'L1', indicator: 'Non-Hydrocarbon Exports (share of total exports)', period: '2019', actual: '32.04%', target: '50%', unit: '% of total exports', org: 'Planning and Statistics Authority', fileRow: 'sceai_indicators_annual.csv · 412' }],
    tools: ['find_indicator', 'get_time_series', 'actual_vs_target', 'hybrid_search'],
    doc: { doc: 'National Development Strategy', section: 'Diversification', passage: 'Raise the non-hydrocarbon share of exports as the economy diversifies.' },
    answer: () => ['Non-hydrocarbon exports were ', L('32.04%'), ' of total exports in 2019, against a target of ', L('50%'), '. The ', D('National Development Strategy'), ' sets diversification of exports as a priority.'],
  },
  {
    match: /food reserve/i,
    code: 'IND-FDS-007',
    query: 'strategic food reserve coverage',
    periodCode: '2024',
    local: [{ ref: 'L1', indicator: 'Strategic Food Reserve Coverage', period: '2024', actual: '84 days', unit: 'days of consumption', org: 'Ministry of Commerce and Industry', fileRow: 'sceai_indicators_annual.csv · 455' }],
    tools: ['find_indicator', 'get_indicator_value'],
    answer: () => ['Strategic food reserve coverage was ', L('84 days'), ' of consumption in 2024. No target is set for this indicator.'],
  },
  {
    match: /labour force/i,
    code: 'IND-LAB-022',
    query: 'labour force participation rate',
    periodCode: '2024-Q4',
    local: [{ ref: 'L1', indicator: 'Labour Force Participation Rate', period: 'Q1–Q4 2024', actual: '88.4%', unit: '% of working-age population', org: 'Planning and Statistics Authority', fileRow: 'sceai_indicators_quarterly.csv · 2231' }],
    tools: ['find_indicator', 'get_time_series'],
    answer: () => ['Labour force participation was stable over the last four quarters, most recently ', L('88.4%'), ' in Q4 2024.'],
  },
  {
    match: /re-export/i,
    code: 'IND-TRD-019',
    query: 're-export value growth',
    periodCode: '2024-Q3',
    local: [{ ref: 'L1', indicator: 'Re-export Value Growth', period: 'Q3 2024', actual: '+4.6%', unit: '% y/y', org: 'Planning and Statistics Authority', fileRow: 'sceai_indicators_quarterly.csv · 2198' }],
    tools: ['find_indicator', 'get_indicator_value', 'get_change'],
    answer: () => ['Re-export value grew ', L('4.6%'), ' year on year in Q3 2024.'],
  },
  {
    match: /real GDP/i,
    code: 'IND-GDP-001',
    query: 'real GDP growth',
    periodCode: '2023',
    local: [{ ref: 'L1', indicator: 'Real GDP Growth', period: '2023', actual: '1.2%', unit: '% y/y', org: 'Planning and Statistics Authority', fileRow: 'sceai_indicators_annual.csv · 102' }],
    tools: ['find_indicator', 'get_indicator_value'],
    answer: (ox) => (ox ? oxSentence("Oxford Economics estimates Qatar's real GDP grew by ", ' in 2023. Local data puts it at 1.2%.') : ['Local data puts Qatar real GDP growth at ', L('1.2%'), ' in 2023.']),
  },
  {
    match: /hotel occupancy/i,
    code: '—',
    query: 'hotel occupancy Al Wakrah',
    periodCode: '—',
    local: [],
    tools: ['find_indicator'],
    notFound: true,
    answer: () => [],
  },
];

const scenarioFor = (q: string) => SCENARIOS.find((s) => s.match.test(q)) ?? SCENARIOS[4];

// ---------------------------------------------------------------- tool I/O

function toolIO(tool: string, sc: Scenario): { input: unknown; output: unknown; result: string } {
  const l = sc.local[0];
  switch (tool) {
    case 'find_indicator':
      return sc.notFound
        ? { input: { query: sc.query }, output: { matches: 0, best_score: 0.41 }, result: '0 matches' }
        : { input: { query: sc.query }, output: { matches: 1, code: sc.code, name: l?.indicator }, result: `1 match · ${sc.code}` };
    case 'get_indicator_value':
      return { input: { code: sc.code, period: sc.periodCode }, output: { code: sc.code, period: sc.periodCode, value: parseFloat((l?.actual ?? '0').replace('−', '-').replace('+', '')), unit: l?.unit }, result: l?.actual ?? '' };
    case 'actual_vs_target': {
      const above = l?.target && parseFloat(l.actual.replace('−', '-')) > parseFloat(l.target.replace('−', '-'));
      return { input: { code: sc.code, period: sc.periodCode }, output: { actual: l?.actual, target: l?.target, status: above ? 'above_target' : 'below_target' }, result: above ? 'above_target' : 'below_target' };
    }
    case 'get_time_series':
      return { input: { code: sc.code, to: sc.periodCode, points: 4 }, output: { code: sc.code, observations: 4 }, result: '4 observations' };
    case 'get_change':
      return { input: { code: sc.code, to: sc.periodCode, compare: 'year_ago' }, output: { code: sc.code, change: l?.actual }, result: 'change computed' };
    case 'top_movers':
      return { input: { period: sc.periodCode, limit: 5 }, output: { top: [{ code: 'IND-TOU-014', change_pp: 1.9 }] }, result: '5 movers' };
    case 'get_status':
      return { input: { year: 2024 }, output: { on_track: 6, off_track: 3 }, result: '6 on track · 3 off track' };
    case 'query_indicators':
      return { input: { filter: { status: 'off_track' } }, output: { count: 3 }, result: '3 indicators' };
    case 'get_narratives':
      return { input: { code: sc.code }, output: { narratives: 2 }, result: '2 narratives' };
    case 'hybrid_search':
      return { input: { query: sc.doc?.section ?? sc.query, collection: 'sceai_indicators' }, output: { hits: 1, document: sc.doc?.doc, section: sc.doc?.section }, result: '1 hit' };
    default:
      return { input: {}, output: {}, result: 'ok' };
  }
}

const toolSource = (t: string): SpanSource => (t === 'hybrid_search' ? 'documents' : t === 'EconomicData' ? 'oxford' : 'local');

// ---------------------------------------------------------------- spans

type Step = Omit<TraceSpan, 'startS' | 'startMs' | 'durMs' | 'id'> & { gap: number };

function stepTool(tool: string, sc: Scenario, r: () => number): Step {
  const src = toolSource(tool);
  const io =
    src === 'oxford'
      ? { input: { question: OX.question }, output: OX.output, result: '1.56 % y/y' }
      : toolIO(tool, sc);
  const dur = src === 'oxford' ? 2.1 + r() * 0.6 : src === 'documents' ? 0.55 + r() * 0.2 : 0.14 + r() * 0.2;
  return { name: src === 'oxford' ? `Oxford · ${tool}` : tool, rawName: tool, kind: 'Tool', source: src, mono: true, durS: dur, state: 'ok', gap: 0.03 + r() * 0.03, ...io };
}

function stepModel(name: string, r: () => number, tokensIn: number): Step {
  const out = 110 + Math.round(r() * 190);
  return {
    name,
    rawName: name,
    kind: 'Model call',
    source: 'model',
    mono: false,
    durS: name === 'plan' || name === 'compose answer' ? 1.9 + r() * 0.5 : 1.1 + r() * 0.4,
    state: 'ok',
    gap: 0.02,
    tokens: [tokensIn, out],
    input: { model: 'agent_default', prompt_tokens: tokensIn },
    output: { completion_tokens: out, finish_reason: name === 'compose answer' ? 'stop' : 'tool_calls' },
  };
}

function buildSteps(job: Job, sc: Scenario, ox: boolean, r: () => number): Step[] {
  const steps: Step[] = [{ name: 'queued', rawName: 'queued', kind: 'Queue wait', source: 'queue', mono: false, durS: 0.4 + r() * 0.6, state: 'ok', gap: 0.02 }];
  let tokens = 2600 + Math.round(r() * 400);
  steps.push(stepModel('plan', r, tokens));
  let planN = 1;
  const reason = job.reason ?? '';
  let tools = [...sc.tools];
  if (reason.startsWith('Tool-call')) {
    const cycle = ['find_indicator', 'query_indicators', 'get_status', 'get_narratives', 'hybrid_search'];
    tools = Array.from({ length: 15 }, (_, i) => cycle[i % cycle.length]);
  }
  tools.forEach((t, i) => {
    if (i > 0 && i % 2 === 0) {
      planN++;
      tokens += 800 + Math.round(r() * 300);
      steps.push(stepModel(`plan (step ${planN})`, r, tokens));
    }
    steps.push(stepTool(t, sc, r));
  });
  if (ox && !reason.startsWith('Tool-call')) steps.push(stepTool('EconomicData', sc, r));
  if (ox && reason.includes('502')) steps.push({ ...stepTool('EconomicData', sc, r), name: 'Oxford · EconomicData (retry 1)' });
  tokens += 900;
  steps.push(stepModel('compose answer', r, tokens));
  return steps;
}

function place(steps: Step[], scale: number): TraceSpan[] {
  let t = 0;
  return steps.map((s, i) => {
    const startS = t * scale;
    const durS = s.durS * scale;
    t += s.durS + s.gap;
    const { gap: _gap, ...rest } = s;
    return { ...rest, id: `s${i}`, startS, durS, startMs: Math.round(startS * 1000), durMs: Math.round(durS * 1000) };
  });
}

function buildSpans(job: Job, sc: Scenario, ox: boolean, r: () => number): TraceSpan[] {
  let steps = buildSteps(job, sc, ox, r);
  const T = job.durationS;
  const reason = job.reason ?? '';
  const natural = () => steps.reduce((a, s) => a + s.durS + s.gap, 0) - steps[steps.length - 1].gap;

  if (job.status === 'queued') {
    return place([{ ...steps[0], durS: Math.max(T, 0.5), state: 'running' }], 1);
  }
  if (job.status === 'running') {
    const all = place(steps, 1);
    const cut = all.findIndex((s) => s.startS + s.durS > T);
    const keep = cut < 0 ? all : all.slice(0, Math.max(1, cut + 1));
    const last = keep[keep.length - 1];
    last.state = 'running';
    last.durS = Math.max(0.05, T - last.startS);
    last.durMs = Math.round(last.durS * 1000);
    last.output = undefined;
    return keep;
  }
  if (job.status === 'cancelled') {
    steps = steps.slice(0, 3);
    steps[2] = { ...steps[2], state: 'cancelled', error: reason || 'Cancelled', output: undefined };
    return place(steps, T / natural());
  }
  if (job.status === 'failed') {
    if (reason.includes('timeout')) {
      // The last external/tool call hangs until the 180 s limit.
      const idx = ox ? steps.findIndex((s) => s.source === 'oxford') : steps.length - 2;
      steps = steps.slice(0, idx + 1);
      const before = steps.slice(0, -1).reduce((a, s) => a + s.durS + s.gap, 0);
      steps[idx] = { ...steps[idx], durS: T - before, state: 'error', error: 'Timed out at 180 s', output: undefined };
      return place(steps, 1);
    }
    if (reason.includes('502')) {
      const first = steps.findIndex((s) => s.source === 'oxford');
      if (first >= 0) {
        steps = steps.slice(0, first + 2);
        steps[first] = { ...steps[first], state: 'error', error: '502 Bad Gateway', output: { error: 'Bad Gateway', status: 502 } };
        steps[first + 1] = { ...steps[first + 1], state: 'error', error: '502 Bad Gateway', output: { error: 'Bad Gateway', status: 502 } };
      }
      return place(steps, T / natural());
    }
    if (reason.startsWith('Tool-call')) {
      const lastTool = steps.length - 2;
      steps = steps.slice(0, lastTool + 1);
      steps.push({ ...stepModel(`plan (step ${steps.filter((s) => s.kind === 'Model call').length + 1})`, r, 9800), state: 'error', error: 'Tool-call limit reached (15 / 15)', output: { refused_tool_call: 'get_narratives' } });
      return place(steps, T / natural());
    }
    if (reason.includes('not found') || sc.notFound) {
      const fi = steps.findIndex((s) => s.rawName === 'find_indicator');
      steps = steps.slice(0, fi + 1);
      steps[fi] = { ...steps[fi], ...toolIO('find_indicator', { ...sc, notFound: true }), state: 'error', error: 'Indicator not found' };
      steps.push({ ...stepModel('plan (step 2)', r, 3100), state: 'error', error: 'No indicator to query · job stopped', output: { finish_reason: 'error' } });
      return place(steps, T / natural());
    }
  }
  return place(steps, T / natural());
}

// ---------------------------------------------------------------- logs & raw

function clock(iso: string, plusS: number) {
  const d = new Date(Date.parse(iso) + 3 * 3_600_000 + Math.round(plusS * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}`;
}
const fmtN = (n: number) => n.toLocaleString('en-GB');

function buildLogs(job: Job, spans: TraceSpan[], status: JobStatus, reason: string | undefined, durS: number, counts: { m: number; t: number }, refs: string): TraceLog[] {
  const at = (s: number) => clock(job.createdAt, s);
  const out: TraceLog[] = [{ t: at(0.112), lv: 'INFO', m: 'Job enqueued on kap.agent · priority 3' }];
  let firstModel = true;
  for (const s of spans) {
    const end = s.startS + s.durS;
    if (s.source === 'queue') {
      if (s.state !== 'running') out.push({ t: at(end), lv: 'INFO', m: `Dequeued by worker kap-agent-${1 + (job.id.charCodeAt(2) % 4)} · in flight 3 / 3` });
      continue;
    }
    if (s.kind === 'Model call') {
      const tk = s.tokens ? ` · ${fmtN(s.tokens[0])} in / ${fmtN(s.tokens[1])} out tokens` : '';
      out.push({ t: at(s.startS), lv: 'INFO', m: `Model call ${s.name}${firstModel ? ' · agent_default' : ''}${tk}` });
      firstModel = false;
    } else if (s.source === 'oxford') {
      out.push({ t: at(s.startS - 0.01), lv: 'INFO', m: 'Leak guard checked outbound question · 0 local identifiers' });
      out.push({ t: at(s.startS), lv: 'INFO', m: `MCP oxford_economics · ${s.rawName} called` });
      if (s.durS > 1.5 && s.state !== 'error') out.push({ t: at(s.startS + 1.65), lv: 'WARN', m: `${s.rawName} slow response · 1.6 s elapsed (p95 2.6 s)` });
    } else {
      out.push({ t: at(s.startS), lv: 'INFO', m: `Tool ${s.rawName} called · ${JSON.stringify(s.input)}` });
    }
    if (s.state === 'error') out.push({ t: at(end), lv: 'ERROR', m: `${s.rawName} failed · ${s.error}` });
    else if (s.state === 'cancelled') out.push({ t: at(end), lv: 'WARN', m: `${s.rawName} interrupted · ${s.error}` });
    else if (s.state === 'ok' && s.kind === 'Tool') out.push({ t: at(end), lv: 'INFO', m: `${s.rawName} returned in ${fmtSpanDur(s.durS)} · ${s.result ?? 'ok'}` });
  }
  const endT = durS;
  if (status === 'succeeded') {
    out.push({ t: at(endT - 0.026), lv: 'INFO', m: `Answer provenance attached · ${refs}` });
    out.push({ t: at(endT), lv: 'INFO', m: `Job succeeded · ${fmtJobDur(durS)} · ${counts.m} / 20 model requests · ${counts.t} / 15 tool calls` });
  } else if (status === 'failed') {
    out.push({ t: at(endT + 0.004), lv: 'ERROR', m: `Job failed · ${reason}` });
  } else if (status === 'cancelled') {
    out.push({ t: at(endT + 0.004), lv: 'WARN', m: `Job cancelled · ${reason}` });
  }
  return out;
}

function cutPrompt(p: string) {
  if (p.length <= 60) return p;
  const s = p.slice(0, 60);
  return s.slice(0, s.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…';
}

function buildRaw(t: { uuid: string; job: Job; status: JobStatus; retries: number; durMs: number; counts: { m: number; t: number }; prompt: string; reason?: string; spans: TraceSpan[]; ox: boolean }) {
  const q = (s: string) => JSON.stringify(s);
  const lines = [
    '{',
    `  "id": ${q(t.uuid)},`,
    '  "tenant": "sceai",',
    `  "agent": ${q(t.job.agent)},`,
    `  "user": ${q(t.job.user)},`,
    '  "queue": "kap.agent",',
    `  "status": ${q(t.status)},`,
    `  "retries": ${t.retries},`,
    `  "duration_ms": ${t.durMs},`,
    `  "model_requests": ${t.counts.m},`,
    `  "tool_calls": ${t.counts.t},`,
    `  "user_prompt": ${q(cutPrompt(t.prompt))},`,
  ];
  if (t.reason) lines.push(`  "error": ${q(t.reason)},`);
  lines.push('  "spans": [');
  t.spans.forEach((s, i) => {
    const kind = s.source === 'queue' ? '' : `"kind": ${q(s.kind === 'Model call' ? 'model' : s.source === 'oxford' ? 'mcp' : 'tool')}, `;
    const err = s.error ? `, "error": ${q(s.error)}` : s.state === 'running' ? ', "running": true' : '';
    lines.push(`    { "name": ${q(s.rawName)}, ${kind}"start_ms": ${s.startMs}, "duration_ms": ${s.durMs}${err} }${i < t.spans.length - 1 ? ',' : ''}`);
  });
  lines.push('  ],');
  lines.push(`  "leak_guard": { "passed": true, "checks": ${t.ox ? 4 : 0} }`);
  lines.push('}');
  return lines;
}

// ---------------------------------------------------------------- designed trace (93c7a1f2)

const DESIGN_SPANS: [string, string, 'Queue wait' | 'Model call' | 'Tool', SpanSource, number, number, number, number][] = [
  ['queued', 'queued', 'Queue wait', 'queue', 0, 0.8, 0, 806],
  ['plan', 'plan', 'Model call', 'model', 0.82, 2.2, 820, 2204],
  ['find_indicator', 'find_indicator', 'Tool', 'local', 3.05, 0.31, 3050, 310],
  ['get_indicator_value', 'get_indicator_value', 'Tool', 'local', 3.4, 0.18, 3400, 180],
  ['plan (step 2)', 'plan (step 2)', 'Model call', 'model', 3.62, 1.3, 3620, 1300],
  ['actual_vs_target', 'actual_vs_target', 'Tool', 'local', 4.95, 0.15, 4950, 150],
  ['Oxford · EconomicData', 'EconomicData', 'Tool', 'oxford', 5.13, 2.41, 5130, 2410],
  ['compose answer', 'compose answer', 'Model call', 'model', 7.58, 2.2, 7580, 2200],
];

const DESIGN_TOKENS: Record<string, [number, number]> = { plan: [2846, 212], 'plan (step 2)': [3746, 118], 'compose answer': [4644, 286] };

const DESIGN_LOGS: [string, TraceLog['lv'], string][] = [
  ['10:42:07.112', 'INFO', 'Job enqueued on kap.agent · priority 3'],
  ['10:42:07.918', 'INFO', 'Dequeued by worker kap-agent-2 · in flight 3 / 3'],
  ['10:42:07.925', 'INFO', 'Limits applied · timeout 180 s · 20 model requests · 15 tool calls'],
  ['10:42:07.940', 'INFO', 'Model call plan · agent_default · 2,846 in / 212 out tokens'],
  ['10:42:10.161', 'INFO', 'Tool find_indicator called · {"query":"tourism sector contribution to GDP"}'],
  ['10:42:10.471', 'INFO', 'find_indicator returned in 310 ms · 1 match · IND-TOU-014'],
  ['10:42:10.520', 'INFO', 'Tool get_indicator_value called · {"period":"2024-Q4"}'],
  ['10:42:10.700', 'INFO', 'get_indicator_value returned in 180 ms · 8.8 %'],
  ['10:42:10.740', 'INFO', 'Model call plan (step 2) · 3,746 in / 118 out tokens'],
  ['10:42:12.070', 'INFO', 'Tool actual_vs_target returned in 150 ms · above_target'],
  ['10:42:12.240', 'INFO', 'Leak guard checked outbound question · 0 local identifiers'],
  ['10:42:12.250', 'INFO', 'MCP oxford_economics · EconomicData called'],
  ['10:42:13.900', 'WARN', 'EconomicData slow response · 1.6 s elapsed (p95 2.6 s)'],
  ['10:42:14.660', 'INFO', 'EconomicData returned in 2.41 s · 1.56 % y/y'],
  ['10:42:14.700', 'INFO', 'Model call compose answer · 4,644 in / 286 out tokens'],
  ['10:42:16.880', 'INFO', 'Numeric check · 3 of 3 numbers in the answer match tool outputs'],
  ['10:42:16.900', 'INFO', 'Answer provenance attached · 2 local refs, 1 external ref'],
  ['10:42:16.926', 'INFO', 'Job succeeded · 9.8 s · 3 / 20 model requests · 4 / 15 tool calls'],
];

// ---------------------------------------------------------------- build

const STATUS_LABEL: Record<JobStatus, string> = { running: 'Running', succeeded: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled', queued: 'Queued' };

export function buildTrace(jobId: string | undefined): Trace | null {
  const base = jobById(jobId);
  if (!base) return null;
  const designed = base.id === '93c7a1f2';
  const r = seeded(base.id);
  const sc = scenarioFor(base.question);
  const oxfordAgent = base.agent === 'sceai_indicators_oxford';

  // Header facts: the designed trace shows the finished run (HTML wins).
  const job: Job = designed ? { ...base, status: 'succeeded', duration: '9.8 s', durationS: 9.8, rel: '12 min ago', abs: '19 Nov 2026, 10:42:07', createdAt: '2026-11-19T07:42:07.000Z' } : base;
  const status = job.status;
  const prompt = designed ? 'What was the tourism sector contribution to GDP in Q4 2024, and how does it compare with the target? Add wider GDP context.' : job.question;
  const ox = oxfordAgent && !sc.notFound;

  let spans: TraceSpan[];
  if (designed) {
    spans = DESIGN_SPANS.map(([name, rawName, kind, source, s, d, sMs, dMs], i) => {
      const io = source === 'oxford' ? { input: { question: OX.question }, output: OX.output } : kind === 'Tool' ? toolIO(rawName, sc) : kind === 'Model call' ? { input: { model: 'agent_default', prompt_tokens: DESIGN_TOKENS[name][0] }, output: { completion_tokens: DESIGN_TOKENS[name][1], finish_reason: name === 'compose answer' ? 'stop' : 'tool_calls' } } : {};
      return { id: `s${i}`, name, rawName, kind, source, mono: kind === 'Tool', startS: s, durS: d, startMs: sMs, durMs: dMs, state: 'ok' as const, tokens: DESIGN_TOKENS[name], ...io };
    });
  } else {
    spans = buildSpans(job, sc, ox, r);
  }

  const counts = { m: spans.filter((s) => s.kind === 'Model call' && s.state !== 'running').length, t: spans.filter((s) => s.kind === 'Tool' && s.state !== 'running').length };
  if (designed) Object.assign(counts, { m: 3, t: 4 });
  const T = job.durationS;
  const oxUsed = spans.some((s) => s.source === 'oxford' && s.state === 'ok');
  const docsUsed = spans.some((s) => s.source === 'documents' && s.state === 'ok');

  const answer = status === 'succeeded' ? sc.answer(oxUsed) : null;
  const usedRefs = new Set((answer ?? []).filter((p): p is Exclude<AnswerPart, string> => typeof p !== 'string').map((p) => p.ref));
  const local = status === 'succeeded' ? sc.local.filter((l) => usedRefs.has(l.ref)) : [];
  const refs = [local.length && `${local.length} local ref${local.length > 1 ? 's' : ''}`, docsUsed && sc.doc && '1 document ref', oxUsed && '1 external ref'].filter(Boolean).join(', ') || 'no refs';

  const selectedSpan = spans.find((s) => s.source === 'oxford') ?? spans.find((s) => s.state === 'error') ?? spans.find((s) => s.kind === 'Tool') ?? spans[0];
  const reason = job.reason;

  const trace: Trace = {
    job,
    uuid: designed ? '93c7a1f2-6e0b-4c1d-9a7e-2f5b8d0c3e41' : job.uuid,
    status,
    statusLabel: STATUS_LABEL[status],
    reason,
    prompt,
    answer,
    duration: job.duration,
    durationS: T,
    createdRel: job.rel,
    createdAbs: job.abs,
    updatedRel: status === 'running' || status === 'queued' ? 'just now' : job.rel,
    retries: job.retries,
    queue: 'kap.agent',
    meters: [
      { k: 'Model requests', v: `${counts.m} / 20`, p: Math.round((counts.m / 20) * 1000) / 10 },
      { k: 'Tool calls', v: `${counts.t} / 15`, p: Math.round((counts.t / 15) * 100), danger: counts.t >= 15 },
      { k: 'Elapsed vs timeout', v: `${job.duration} / 180 s`, p: Math.round((T / 180) * 1000) / 10, danger: T >= 180 },
    ],
    leak: oxfordAgent
      ? { tone: 'ok', text: 'Data-leak guard passed · no local data sent to Oxford' }
      : { tone: 'neutral', text: 'Data-leak guard not needed · this agent makes no external calls' },
    spans,
    defaultSpan: selectedSpan.id,
    axis: axisFor(T),
    provenance: {
      local,
      docs: docsUsed && sc.doc && status === 'succeeded' ? [{ ref: 'D1', ...sc.doc }] : [],
      external: oxUsed && status === 'succeeded' ? { ref: 'X1', tool: 'EconomicData', question: OX.question, value: OX.value } : null,
      oxfordAgent,
    },
    rawLines: [],
    logs: [],
  };
  trace.rawLines = buildRaw({ uuid: trace.uuid, job, status, retries: job.retries, durMs: designed ? 9814 : Math.round(T * 1000), counts, prompt: designed ? prompt : job.question, reason, spans, ox: oxUsed || (ox && status !== 'succeeded') });
  trace.logs = designed ? DESIGN_LOGS.map(([t, lv, m]) => ({ t, lv, m })) : buildLogs(job, spans, status, reason, T, counts, refs);
  return trace;
}

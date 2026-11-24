/**
 * AI Confidence Hub (Overview · Answer Evidence · Feedback) and AI Governance ·
 * Policy Library as ScreenModels. Port of the prototype's agentHub
 * `confov` / `evidence` (design-ref-v35/app.js ~3057–3105), the `s.feedback`
 * block (`more()` · fbRows / fbSum / fbFilt) and the empty Policy Library.
 * Pure: data, filters, permissions and callbacks in; model out.
 */
import { act, cell, kv } from '@/engine/build';
import type { DsStatus, Row, ScreenModel } from '@/engine/types';
import type { AfTenant, AfTenantKey } from '@/v35/data/agentFactory';
import { ASK_ANSWERS, EVIDENCE_BY_AGENT, FEEDBACK, FEEDBACK_SUMMARY, FEEDBACK_TREND, GUARDRAILS, type FeedbackItem } from '@/v35/data/toolsConfidence';
import type { ResType } from '@/v35/iam';

export type ListFilters = Record<string, string>;

export interface ConfCtx {
  t: AfTenantKey;
  tn: string;
  D: AfTenant;
  actor: string;
  can: (perm: string, type: ResType, id?: string) => boolean;
  go: {
    evidence: () => void;
    feedback: () => void;
    agent: (id: string, tab?: string) => void;
    trace: (runId: string) => void;
    session: (msgId: string) => void;
  };
}

/** One answer with its evidence assessment inputs. */
export interface Answer {
  id: string;
  q: string;
  lang: string;
  type: string;
  /** 1 helpful · 0 none · -1 reported incorrect */
  fb: number;
  at: string;
  /** share of statements supported by retrieved evidence (null = not applicable) */
  g: number | null;
  cit: string;
  src: string[];
  pr: string[];
  /** workflow run of the answer (Ask AI) */
  wf: string;
  /** 'Ask AI' or the agent id */
  who: string;
  /** agent job id */
  run: string;
}

const canRead = (c: ConfCtx, a: string) => c.can('agent:read', 'agent', a);
const canUpd = (c: ConfCtx, a: string) => c.can('agent:update', 'agent', a);
const canAppr = (c: ConfCtx, a: string) => c.can('agent:oversee', 'agent', a);

/** Ask AI answers (SCEAI, readable with Composer Agent) and agent job answers the viewer may review. */
export function answersOf(c: ConfCtx): Answer[] {
  const ask = canRead(c, 'Composer Agent')
    ? (ASK_ANSWERS[c.t] || []).map(([id, q, lang, type, fb, at, g, cit, src, pr, wf]): Answer => ({ id, q, lang, type, fb, at, g, cit, src, pr, wf, who: 'Ask AI', run: '' }))
    : [];
  const jobs = c.D.runs
    .filter((r) => r.st !== 'Running' && canRead(c, r.agent) && (r.caller === c.actor || canUpd(c, r.agent) || canAppr(c, r.agent)))
    .map((r): Answer => {
      const bad = (r.guards || []).filter((x) => /Refused|Failed|Triggered/.test(x[1]));
      const ev = (r.evid || []).map((e) => `${e[0]} · ${e[1]}`);
      const failed = r.st === 'Failed';
      return {
        id: r.id, q: r.q, lang: r.lang, type: failed ? 'Failed' : 'Agent answer', fb: 0, at: r.at,
        g: failed ? null : bad.length ? 0.55 : 0.9,
        cit: failed ? '—' : ev.length ? `${ev.length} of ${ev.length}` : '0',
        src: ev,
        pr: (failed ? [`No answer: ${r.reason || 'execution failed'}`] : []).concat(bad.map((x) => `${x[0]} · ${x[1]}`)),
        wf: '', who: r.agent, run: r.id,
      };
    });
  return ask.concat(jobs);
}

/** Evidence assessment (prototype `assess`). */
export function assess(a: Pick<Answer, 'type' | 'pr' | 'g'>): [DsStatus, string] {
  if (a.type === 'Refusal' || a.type === 'General chat' || a.type === 'Failed') return a.pr.length ? ['hold', 'Review'] : ['draft', 'No evidence needed'];
  if (a.pr.length) return ['rejected', 'Flagged'];
  return (a.g ?? 0) >= 0.85 ? ['approved', 'Supported'] : ['hold', 'Partly supported'];
}

const pctL = (g: number | null) => (g == null ? '—' : `${Math.round(g * 100)}%`);
export const ANSWER_COLS = ['Answer', 'Answered by', 'Grounding', 'Citations', 'Detected problems', 'Assessment', 'When'];

function ansRow(c: ConfCtx, a: Answer): Row {
  const trace = a.run || a.wf;
  return {
    key: `an:${a.id}`,
    cells: [
      cell(a.q, { sub: `${a.id} · ${a.lang}` }),
      cell(a.who),
      cell(pctL(a.g)),
      cell(a.cit),
      cell(a.pr.length ? a.pr[0] + (a.pr.length > 1 ? ` +${a.pr.length - 1}` : '') : 'None'),
      cell('', { p: assess(a) }),
      cell(a.at),
    ],
    kv: kv([
      ['Answered by', a.who],
      ['Answer type', a.type],
      ['Grounding', a.g == null ? 'Not applicable' : `${Math.round(a.g * 100)}% of statements supported by retrieved evidence`],
      ['Citation coverage', a.cit],
      ['User feedback', a.fb > 0 ? 'Helpful' : a.fb < 0 ? 'Reported as incorrect' : 'None'],
      ['Assessment', assess(a)[1]],
    ]),
    keepKv: true,
    lists: [
      { title: 'Supporting sources', items: a.src.map((x) => ({ a: x.split(' · ')[0], b: x.split(' · ').slice(1).join(' · ') || 'Cited', c: '' })), empty: 'No sources retrieved' },
      { title: 'Detected problems', items: a.pr.map((x) => ({ a: x, b: '', c: '' })), empty: 'None' },
    ],
    acts: [...(a.who === 'Ask AI' ? [act('Open session', () => c.go.session(a.id))] : []), ...(trace ? [act('Open trace', () => c.go.trace(trace))] : [])],
  };
}

/** Citation coverage across answers that need evidence: "x of y" summed. */
export function citationCoverage(A: Answer[]): number {
  const cc = A.filter((a) => a.g != null).map((a) => /^(\d+) of (\d+)$/.exec(a.cit)).filter((m): m is RegExpExecArray => !!m).map((m) => [+m[1], +m[2]]);
  return cc.length ? Math.round((cc.reduce((x, y) => x + y[0], 0) / Math.max(1, cc.reduce((x, y) => x + y[1], 0))) * 100) : 0;
}

// ============================================================ Overview

export function confovScreen(c: ConfCtx): ScreenModel {
  const A = answersOf(c);
  const needEv = A.filter((a) => a.g != null);
  const sup = needEv.filter((a) => assess(a)[1] === 'Supported').length;
  const flg = A.filter((a) => ['Flagged', 'Review'].includes(assess(a)[1]));
  const pos = A.filter((a) => a.fb > 0).length;
  const neg = A.filter((a) => a.fb < 0).length;
  const BYA = EVIDENCE_BY_AGENT[c.t]
    ? EVIDENCE_BY_AGENT[c.t]!.filter((r) => canRead(c, r[0]))
    : c.D.agents.filter((a) => canRead(c, a.id) && a.vers.some((v) => v.st === 'Published')).map((a): [string, string, string, string, string] => [a.id, String(a.m[0] || 0), a.m[1] ? `${a.m[1]}%` : '—', '—', '0']);
  const TR = FEEDBACK_TREND[c.t] || [['This week', pos, neg] as [string, number, number]];
  return {
    head: { title: 'AI Confidence Hub' },
    sections: [
      {
        stats: [
          { k: 'Grounded answers', v: needEv.length ? `${Math.round((sup / needEv.length) * 100)}%` : '—', c: 'var(--success)' },
          { k: 'Citation coverage', v: `${citationCoverage(A)}%`, c: '#0F766E' },
          { k: 'Flagged answers', v: String(flg.length), c: 'var(--danger)' },
          { k: 'Helpful', v: String(pos), c: 'var(--success)' },
          { k: 'Reported incorrect', v: String(neg), c: 'var(--warning)' },
        ],
      },
      { title: 'Answers that need attention', sacts: [act('Open Answer Evidence', c.go.evidence)], empty: 'No flagged answers.', cols: ANSWER_COLS, rows: flg.slice(0, 5).map((a) => ansRow(c, a)) },
      {
        title: 'Evidence quality by agent · last 7 days',
        empty: 'No published agents you can read.',
        cols: ['Agent', 'Answers', 'Grounded', 'Citation coverage', 'Figure mismatches'],
        mode: 'inline',
        rows: BYA.map((r): Row => ({ key: `ba:${r[0]}`, cells: [cell(r[0], { m: true }), cell(r[1]), cell(r[2]), cell(r[3]), cell(r[4])], acts: [act('Open agent', () => c.go.agent(r[0], 'metrics'))], onClick: () => c.go.agent(r[0], 'metrics') })),
      },
      {
        title: 'User feedback trend',
        sacts: [act('Open Feedback', c.go.feedback)],
        cols: ['Day', 'Helpful', 'Reported incorrect', 'Negative rate'],
        mode: 'inline',
        rows: TR.map((r): Row => ({ key: `ft:${r[0]}`, cells: [cell(r[0]), cell(String(r[1])), cell(String(r[2])), cell(r[1] + r[2] ? `${Math.round((r[2] / (r[1] + r[2])) * 1000) / 10}%` : '—')] })),
      },
    ],
  };
}

// ============================================================ Answer Evidence

export const ASSESSMENTS = ['All assessments', 'Supported', 'Partly supported', 'Flagged', 'Review', 'No evidence needed'];

export function evidenceScreen(c: ConfCtx, F: ListFilters, setF: (f: ListFilters) => void): ScreenModel {
  const A = answersOf(c);
  const whoO = ['All sources', ...new Set(A.map((a) => a.who))];
  const who = F.who && whoO.includes(F.who) ? F.who : whoO[0];
  const as = F.as && ASSESSMENTS.includes(F.as) ? F.as : ASSESSMENTS[0];
  const vis = A.filter((a) => (!F.q || `${a.id} ${a.q}`.toLowerCase().includes(F.q.toLowerCase())) && (who === whoO[0] || a.who === who) && (as === ASSESSMENTS[0] || assess(a)[1] === as));
  const chips = [
    ...(F.q ? [{ l: `Search: ${F.q}`, x: () => setF({ ...F, q: '' }) }] : []),
    ...(who !== whoO[0] ? [{ l: `Answered by: ${who}`, x: () => setF({ ...F, who: whoO[0] }) }] : []),
    ...(as !== ASSESSMENTS[0] ? [{ l: `Assessment: ${as}`, x: () => setF({ ...F, as: ASSESSMENTS[0] }) }] : []),
  ];
  return {
    head: { title: 'Answer Evidence' },
    filters: {
      q: F.q ?? '', qLabel: 'Search', qPlaceholder: 'Question or answer ID', setQ: (q) => setF({ ...F, q }),
      main: [
        { label: 'Answered by', value: who, options: whoO, onChange: (v) => setF({ ...F, who: v }) },
        { label: 'Assessment', value: as, options: ASSESSMENTS, onChange: (v) => setF({ ...F, as: v }) },
      ],
      chips, clear: () => setF({}), count: `${vis.length} of ${A.length} answers`,
    },
    sections: [{ empty: 'No answers match.', cols: ANSWER_COLS, rows: vis.map((a) => ansRow(c, a)) }],
  };
}

// ============================================================ Feedback

export const FB_STATUS = ['Open', 'Any status', 'New', 'Triaged', 'Resolved'];

export function feedbackScreen(c: Pick<ConfCtx, 't' | 'tn' | 'go'>, F: ListFilters, setF: (f: ListFilters) => void): ScreenModel {
  const all: FeedbackItem[] = FEEDBACK[c.t] || [];
  const head = { title: 'Feedback' };
  if (!all.length) return { head, sections: [{ empty: `No feedback in ${c.tn}. Nothing has been added yet.`, cols: [], rows: [] }] };
  const RS = ['Any reason', ...new Set(all.map((f) => f.reason))];
  const TY = ['Any answer type', ...new Set(all.map((f) => f.type))];
  const LG = ['Any language', 'English', 'Arabic'];
  const pick = (k: string, opts: string[]) => (F[k] && opts.includes(F[k]) ? F[k] : opts[0]);
  const st = pick('st', FB_STATUS), rs = pick('rs', RS), ty = pick('ty', TY), lg = pick('lg', LG);
  const rows = all.filter(
    (f) =>
      (!F.q || `${f.id} ${f.q} ${f.cmt}`.toLowerCase().includes(F.q.toLowerCase())) &&
      (st === 'Any status' || (st === 'Open' ? f.pl !== 'Resolved' : f.pl === st)) &&
      (rs === RS[0] || f.reason === rs) &&
      (ty === TY[0] || f.type === ty) &&
      (lg === LG[0] || f.lang === lg),
  );
  const chips = [
    ...(F.q ? [{ l: `Search: ${F.q}`, x: () => setF({ ...F, q: '' }) }] : []),
    ...(st !== 'Open' ? [{ l: `Status: ${st}`, x: () => setF({ ...F, st: 'Open' }) }] : []),
    ...(rs !== RS[0] ? [{ l: `Reason: ${rs}`, x: () => setF({ ...F, rs: RS[0] }) }] : []),
    ...(ty !== TY[0] ? [{ l: `Answer type: ${ty}`, x: () => setF({ ...F, ty: TY[0] }) }] : []),
    ...(lg !== LG[0] ? [{ l: `Language: ${lg}`, x: () => setF({ ...F, lg: LG[0] }) }] : []),
  ];
  return {
    head,
    filters: {
      q: F.q ?? '', qLabel: 'Search', qPlaceholder: 'Question, message ID or comment', setQ: (q) => setF({ ...F, q }),
      main: [
        { label: 'Status', value: st, options: FB_STATUS, onChange: (v) => setF({ ...F, st: v }) },
        { label: 'Reason', value: rs, options: RS, onChange: (v) => setF({ ...F, rs: v }) },
        { label: 'Answer type', value: ty, options: TY, onChange: (v) => setF({ ...F, ty: v }) },
        { label: 'Language', value: lg, options: LG, onChange: (v) => setF({ ...F, lg: v }) },
      ],
      chips,
      clear: () => setF({}),
      count: `${rows.length} of ${all.length} negative feedback items`,
    },
    sections: [
      { stats: (FEEDBACK_SUMMARY[c.t] || []).map(([k, v, col]) => ({ k, v, c: col })) },
      {
        empty: 'No feedback matches the filters.',
        cols: ['Message', 'Question', 'Answer type', 'Reason', 'User comment', 'Status', 'When'],
        mode: 'inline',
        rows: rows.map((f): Row => ({
          key: `fb:${f.id}`,
          cells: [cell(f.id, { m: true }), cell(f.q, { sub: f.lang }), cell(f.type), cell(f.reason), cell(f.cmt), cell('', { p: [f.p, f.pl] }), cell(f.when)],
          acts: [act('Open', () => c.go.session(f.id))],
          onClick: () => c.go.session(f.id),
        })),
      },
    ],
  };
}

// ============================================================ Policy Library (empty in v35)

export function policiesScreen(tn: string, isDefault: boolean): ScreenModel {
  return {
    head: { title: 'Policy Library' },
    sections: [
      {
        empty: `No policies in ${tn}. ${isDefault ? 'The system tenant holds no business data or workloads.' : 'Nothing has been added yet.'}`,
        cols: [],
        rows: [],
      },
      {
        title: 'What the library will hold',
        note: 'Tenant-wide policies that agents and workflows inherit. Until policies are defined here, each agent version sets its own guardrails in its configuration.',
        cols: ['Guardrail', 'What it does'],
        mode: 'inline',
        rows: GUARDRAILS.map(([n, d]): Row => ({ key: `gr:${n}`, cells: [cell(n, { m: true }), cell(d)] })),
      },
    ],
  };
}

import { describe, expect, it, vi } from 'vitest';
import { agentFactoryInit, type AfTenantKey } from '@/v35/data/agentFactory';
import { answersOf, assess, citationCoverage, confovScreen, evidenceScreen, feedbackScreen, policiesScreen, type ConfCtx } from './build';

const noop = () => {};
function ctx(t: AfTenantKey = 'sceai', can: ConfCtx['can'] = () => true, actor = 'sceai_admin'): ConfCtx {
  const af = agentFactoryInit();
  return { t, tn: { sceai: 'SCEAI', econ: 'Economic Affairs', sandbox: 'sandbox' }[t], D: af.tenants[t], actor, can, go: { evidence: vi.fn(), feedback: vi.fn(), agent: vi.fn(), trace: vi.fn(), session: vi.fn() } };
}

describe('answers and assessment', () => {
  it('assesses evidence like the prototype', () => {
    expect(assess({ type: 'Numeric', pr: [], g: 0.96 })).toEqual(['approved', 'Supported']);
    expect(assess({ type: 'Article', pr: [], g: 0.74 })).toEqual(['hold', 'Partly supported']);
    expect(assess({ type: 'Numeric', pr: ['x'], g: 0.9 })).toEqual(['rejected', 'Flagged']);
    expect(assess({ type: 'Refusal', pr: ['x'], g: null })).toEqual(['hold', 'Review']);
    expect(assess({ type: 'Failed', pr: [], g: null })).toEqual(['draft', 'No evidence needed']);
  });

  it('combines Ask AI answers and finished agent jobs the viewer may review', () => {
    const A = answersOf(ctx());
    expect(A.filter((a) => a.who === 'Ask AI')).toHaveLength(10);
    expect(A.some((a) => a.who !== 'Ask AI')).toBe(true);
    expect(A.some((a) => a.id === '93c7a1f2')).toBe(false); // running
    const failed = A.find((a) => a.id === '2f8b6e19')!;
    expect([failed.type, failed.g, failed.cit, failed.pr[0]]).toEqual(['Failed', null, '—', 'No answer: Indicator not found']);
    // without read on Composer Agent the Ask AI answers are hidden; without update/oversee only own jobs
    const own = answersOf(ctx('sceai', (p, _t, id) => p === 'agent:read' && id !== 'Composer Agent', 'sceai_analyst'));
    expect(own.every((a) => a.who !== 'Ask AI')).toBe(true);
    expect(own.length).toBeGreaterThan(0);
    expect(citationCoverage([{ g: 0.9, cit: '3 of 3' }, { g: 0.4, cit: '0 of 2' }, { g: null, cit: '—' }] as never)).toBe(60);
  });
});

describe('AI Confidence Hub overview', () => {
  it('shows stats, flagged answers, evidence by agent and the feedback trend', () => {
    const c = ctx();
    const m = confovScreen(c);
    expect(m.head.title).toBe('AI Confidence Hub');
    expect(m.sections[0].stats!.map((s) => s.k)).toEqual(['Grounded answers', 'Citation coverage', 'Flagged answers', 'Helpful', 'Reported incorrect']);
    expect(m.sections[0].stats![3].v).toBe('4');
    expect(m.sections[1].title).toBe('Answers that need attention');
    expect(m.sections[1].rows!.length).toBeLessThanOrEqual(5);
    m.sections[1].sacts![0].f();
    expect(c.go.evidence).toHaveBeenCalled();
    expect(m.sections[2].rows!.map((r) => r.cells[0].v)).toEqual(['sceai_indicators_agent', 'sceai_indicators_oxford', 'Article Agent', 'Composer Agent']);
    expect(m.sections[3].rows![6].cells.map((x) => x.v)).toEqual(['Today', '16', '2', '11.1%']);
  });

  it('derives evidence by agent for other tenants', () => {
    const m = confovScreen(ctx('econ'));
    expect(m.sections[2].rows!.map((r) => r.cells[0].v)).toEqual(['budget_variance_agent', 'policy_brief_agent']);
    expect(m.sections[3].rows![0].cells[0].v).toBe('This week');
  });
});

describe('Answer Evidence', () => {
  it('filters answers and links sessions and traces', () => {
    const c = ctx();
    const all = evidenceScreen(c, {}, noop);
    expect(all.sections[0].cols).toEqual(['Answer', 'Answered by', 'Grounding', 'Citations', 'Detected problems', 'Assessment', 'When']);
    const m = evidenceScreen(c, { who: 'Ask AI', as: 'Flagged' }, noop);
    expect(m.sections[0].rows!.map((r) => r.key)).toEqual(['an:7f2187', 'an:7f213e', 'an:7f2132']);
    expect(m.filters!.chips).toHaveLength(2);
    const sess = evidenceScreen(c, { q: '7f21a9' }, noop).sections[0].rows![0];
    expect(sess.acts!.map((a) => a.l)).toEqual(['Open session', 'Open trace']);
    sess.acts![1].f();
    expect(c.go.trace).toHaveBeenCalledWith('w-8c21f0a3');
    sess.acts![0].f();
    expect(c.go.session).toHaveBeenCalledWith('7f21a9');
  });
});

describe('Feedback', () => {
  it('shows open negative feedback by default', () => {
    const c = ctx();
    const m = feedbackScreen(c, {}, noop);
    expect(m.sections[0].stats).toHaveLength(5);
    expect(m.sections[1].cols).toEqual(['Message', 'Question', 'Answer type', 'Reason', 'User comment', 'Status', 'When']);
    expect(m.sections[1].rows).toHaveLength(6);
    expect(m.filters!.count).toBe('6 of 7 negative feedback items');
    expect(feedbackScreen(c, { st: 'Any status', lg: 'Arabic' }, noop).sections[1].rows!.map((r) => r.key)).toEqual(['fb:7f20f2', 'fb:7f2081']);
    m.sections[1].rows![0].onClick!();
    expect(c.go.session).toHaveBeenCalledWith('7f2187');
  });

  it('is empty for tenants without feedback', () => {
    expect(feedbackScreen(ctx('econ'), {}, noop).sections[0].empty).toBe('No feedback in Economic Affairs. Nothing has been added yet.');
  });
});

describe('Policy Library', () => {
  it('is an honest empty state with the guardrails the library will hold', () => {
    const m = policiesScreen('SCEAI', false);
    expect(m.sections[0].empty).toBe('No policies in SCEAI. Nothing has been added yet.');
    expect(m.sections[1].rows!.map((r) => r.cells[0].v)).toEqual(['Prompt injection', 'Jailbreak', 'Grounding required', 'Numeric verifier', 'Data-leak guard']);
    expect(policiesScreen('Default', true).sections[0].empty).toMatch(/system tenant/);
  });
});

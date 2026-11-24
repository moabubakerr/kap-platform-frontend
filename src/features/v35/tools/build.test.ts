import { describe, expect, it, vi } from 'vitest';
import { agentFactoryInit, draftOf, type AfTenantKey } from '@/v35/data/agentFactory';
import { reportsInit } from '@/v35/data/toolsConfidence';
import {
  assignInDraft, discover, eventsOf, grantAvail, grantCandidates, mcpRows, mcpScreen, nextOf, noModel, pubTools, reportsScreen, schedFields, schedRecord, schedulesScreen, schedValues,
  simCheck, toolImpact, toolInv, toolsScreen, trigOf, validateReport, validateSched, validateServer,
  type AfBase, type McpCtx, type SchedCtx, type ToolsCtx,
} from './build';

const noop = () => {};
const labels = (acts?: { l: string }[]) => (acts ?? []).map((x) => x.l);
function base(t: AfTenantKey = 'sceai', can: AfBase['can'] = () => true): AfBase {
  const af = agentFactoryInit();
  return { t, tn: { sceai: 'SCEAI', econ: 'Economic Affairs', sandbox: 'sandbox' }[t], af, D: af.tenants[t], actor: 'sceai_admin', can };
}
const nav = () => ({ tab: vi.fn(), agent: vi.fn(), workflow: vi.fn(), mcp: vi.fn(), audit: vi.fn() });
const toolsCtx = (b = base()): ToolsCtx => ({ ...b, go: nav(), a: { assign: vi.fn(), disable: vi.fn(), reenable: vi.fn() } });
const mcpCtx = (b = base()): McpCtx => ({ ...b, tests: {}, go: { ...nav(), tool: vi.fn() }, a: { register: vi.fn(), test: vi.fn(), enableTools: vi.fn(), configure: vi.fn(), toggle: vi.fn(), remove: vi.fn(), grant: vi.fn() } });
const schedCtx = (b = base()): SchedCtx => ({ ...b, go: { tab: vi.fn(), agent: vi.fn(), workflow: vi.fn(), run: vi.fn() }, a: { create: vi.fn(), edit: vi.fn(), runNow: vi.fn(), toggle: vi.fn(), remove: vi.fn() } });

describe('tool inventory', () => {
  it('lists native tools and the tools of servers available to the tenant', () => {
    const L = toolInv(base());
    expect(L.filter((t) => t.src === 'Native')).toHaveLength(16);
    expect(L.some((t) => t.key === 'web_fetch:fetch')).toBe(false); // platform server not shared with SCEAI
    expect(L.filter((t) => t.src === 'Tenant MCP').map((t) => t.srv!.n)).toContain('oxford_economics');
    const ox = L.find((t) => t.key === 'oxford_economics:EconomicData')!;
    expect([ox.stF, ox.cap, ox.mgr, ox.err]).toEqual(['Degraded', 'External data', 'SCEAI-managed', '20%']);
    expect(L.find((t) => t.key === 'oxford_economics:CountryRisk')!.stF).toBe('Not enabled');
  });

  it('resolves model tasks against the model registry', () => {
    const b = base();
    expect(noModel(b.af.models, 'sceai', ['ASR', 'Transcription'])).toBe(false);
    expect(noModel(b.af.models, 'econ', ['ASR', 'Transcription'])).toBe(true);
    const tr = toolInv(b).find((t) => t.key === 'kap:analyze_image')!;
    expect([tr.stF, tr.why]).toEqual(['Unavailable', 'No active model for this task in the Model Registry']);
  });

  it('counts published and draft assignments', () => {
    const L = toolInv(base());
    const fi = L.find((t) => t.key === 'sceai_indicator_tools:find_indicator')!;
    expect(fi.pub).toEqual(expect.arrayContaining(['sceai_indicators_oxford', 'Indicator Picker']));
    expect(fi.wfs.map((w) => w.id)).toContain('ask_ai');
  });

  it('builds the Tools screen with filters, details and gated actions', () => {
    const c = toolsCtx();
    const m = toolsScreen(c, {}, noop);
    expect(m.head.title).toBe('AI Agent Tools');
    expect(m.head.tabs?.map((x) => x.label)).toEqual(['Tools', 'MCP Connections']);
    expect(m.sections[0].cols).toEqual(['Tool', 'Source', 'Capability', 'Effect', 'Status', 'Used by']);
    const row = m.sections[0].rows!.find((r) => r.key === 'tl:oxford_economics:EconomicData')!;
    expect(labels(row.acts)).toEqual(['Assign to agent', 'Emergency disable', 'Open MCP connection']);
    expect(row.lists![0].title).toBe('Assigned agents');
    expect(m.filters!.count).toMatch(/^28 of 28 tools$/);
    const ro = toolsScreen(toolsCtx(base('sceai', () => false)), {}, noop);
    expect(labels(ro.sections[0].rows![0].acts)).toEqual([]);
    const f = toolsScreen(c, { src: 'Tenant MCP', av: 'Not assigned' }, noop);
    expect(f.sections[0].rows!.map((r) => r.key)).toEqual(expect.arrayContaining(['tl:oxford_economics:CountryRisk', 'tl:sceai_dwh_mcp:describe_table']));
    expect(f.filters!.chips).toHaveLength(2);
  });

  it('shows emergency disablement and lists its impact', () => {
    const b = base();
    b.D.toolDis['oxford_economics:EconomicData'] = { by: 'sceai_admin', at: 'just now', reason: 'Leak suspected', ref: 'AUD-1' };
    const t = toolInv(b).find((x) => x.key === 'oxford_economics:EconomicData')!;
    expect(t.stF).toBe('Disabled (emergency)');
    const row = toolsScreen(toolsCtx(b), {}, noop).sections[0].rows!.find((r) => r.key === 'tl:oxford_economics:EconomicData')!;
    expect(labels(row.acts)).toEqual(['Re-enable', 'Open MCP connection', 'View audit record']);
    const imp = toolImpact(b, t);
    expect(imp).toContainEqual(['Agent', 'sceai_indicators_oxford']);
    expect(imp).toContainEqual(['Workflow', 'Ask AI']);
  });

  it('assigns a tool in the agent draft, creating the draft when needed', () => {
    const b = base();
    const r = assignInDraft(b.D, pubTools(b, 'Article Agent'), 'Article Agent', 'kap:trend', true, 'x');
    expect(r).toEqual({ v: 'v5', created: true });
    const dv = draftOf(b.D.agents.find((a) => a.id === 'Article Agent')!)!;
    expect(dv.cfg!.tset).toEqual(['kap:hybrid_search', 'kap:document_get', 'doc_converter:extract_tables', 'kap:trend']);
    expect(assignInDraft(b.D, [], 'Article Agent', 'kap:trend', false, 'x')).toEqual({ v: 'v5', created: false });
    expect(dv.cfg!.tset).not.toContain('kap:trend');
  });
});

describe('MCP connections', () => {
  it('lists shared and tenant connections with status and usage', () => {
    const rows = mcpRows(base());
    expect(rows.map((r) => r.n)).toEqual(['doc_converter', 'oxford_economics', 'sceai_indicator_tools', 'sceai_dwh_mcp']);
    const ox = rows[1];
    expect([ox.kind, ox.status, ox.hl]).toEqual(['External', 'Enabled', 'Degraded']);
    expect(ox.users).toEqual(['sceai_indicators_oxford']);
  });

  it('builds the screen, deep link and tool assignments', () => {
    const m = mcpScreen(mcpCtx(), {}, noop, 'mc:oxford_economics');
    expect(m.head.add?.l).toBe('Register MCP server');
    expect(m.sections[0].openKey).toBe('mc:oxford_economics');
    expect(m.sections[0].cols).toEqual(['Connection', 'Managed by', 'Network', 'Tools enabled', 'Used by', 'Status', 'Health']);
    const ox = m.sections[0].rows!.find((r) => r.key === 'mc:oxford_economics')!;
    expect(ox.cells[3].v).toBe('2 of 3');
    expect(labels(ox.acts)).toEqual(['Test connection', 'Enable tools', 'Configure', 'Disable', 'Delete']);
    const shared = m.sections[0].rows!.find((r) => r.key === 'mc:doc_converter')!;
    expect(labels(shared.acts)).toEqual(['Test connection', 'Enable tools', 'Remove']);
    const asg = m.sections[1];
    expect(asg.title).toBe('Agent tool assignments');
    expect(labels(asg.sacts)).toEqual(['Grant tools']);
    const art = asg.rows!.find((r) => r.key === 'as:Article Agent')!;
    expect(art.cells.map((x) => x.v)).toEqual(['Article Agent', 'hybrid_search, document_get', 'doc_converter: extract_tables', '—']);
    const ro = mcpScreen(mcpCtx(base('sceai', (p) => p === 'agent:read')), {}, noop);
    expect(ro.head.add).toBeUndefined();
    expect(labels(ro.sections[0].rows![0].acts)).toEqual(['Test connection']);
    expect(labels(ro.sections[1].sacts)).toEqual([]);
  });

  it('knows which tools can be granted', () => {
    const b = base();
    expect(grantAvail(b.af, 'sceai', 'kap:transcribe')).toBe(true);
    expect(grantAvail(b.af, 'sceai', 'oxford_economics:CountryRisk')).toBe(false);
    expect(grantCandidates(b.af, 'sceai')).toContain('sceai_dwh_mcp:run_sql_readonly');
    expect(grantCandidates(b.af, 'econ').some((g) => !g.startsWith('kap:'))).toBe(false);
  });

  it('simulates connection checks, validation and discovery', () => {
    const s = base().af.mcp.servers;
    expect(simCheck(s.find((x) => x.n === 'oxford_economics')!).h).toBe('Degraded');
    expect(simCheck(s.find((x) => x.n === 'web_fetch')!)).toEqual({ ok: false, m: 'Not checked · the server is disabled.' });
    const v = { n: 'world_bank', up: 'https://api.worldbank.org/mcp', auth: 'None', cls: 'L1 · Internal', pii: 'Not allowed', dest: '', timeout: '30' };
    expect(validateServer(v, s, false, 0)).toBe('');
    expect(validateServer(v, s, false)).toBe('External servers can receive L0 · Public data only.');
    expect(validateServer({ ...v, cls: 'L0 · Public' }, s, false)).toBe('Add api.worldbank.org to the egress allowlist.');
    expect(validateServer({ ...v, n: 'oxford_economics' }, s, false)).toBe('A server with this name already exists.');
    const d = discover({ ...v, fx: 'Read-only' }, null);
    expect(d.ok).toBe(true);
    expect(d.tools.map((x) => x.n)).toEqual(['wb_indicator', 'wb_country']);
    expect(discover({ up: 'https://api.worldbank.org/v1' }, null).ok).toBe(false);
  });
});

describe('schedules and events', () => {
  it('lists time-based and event-driven triggers', () => {
    const m = schedulesScreen(schedCtx(), {}, noop);
    expect(m.head.tabs?.map((x) => x.label)).toEqual(['Triggers', 'Scheduled Reports']);
    expect(m.sections.map((s) => s.title)).toEqual(['Time-based triggers', 'Event-driven triggers']);
    expect(m.sections[0].rows!.map((r) => r.key)).toEqual(['sc:SCH-01', 'sc:SCH-03']);
    const w = m.sections[0].rows![0];
    expect(w.cells.map((x) => x.v)).toEqual(['Weekly briefing', 'Weekly · Sunday 06:00 AST', 'Sunday 06:00', 'Weekly briefing', '', 'Succeeded · 1 d ago']);
    expect(labels(w.acts)).toEqual(['Open target', 'Run now', 'Edit', 'Disable', 'Delete']);
    expect(m.sections[1].rows![0].cells[2].v).toBe('indicators_csv_ingest');
    expect(m.filters!.count).toBe('3 of 3 triggers');
    const ro = schedulesScreen(schedCtx(base('sceai', () => false)), {}, noop);
    expect(labels(ro.sections[0].sacts)).toEqual([]);
    expect(labels(ro.sections[0].rows![0].acts)).toEqual(['Open target']);
    expect(schedulesScreen(schedCtx(), { on: 'Disabled' }, noop).sections[0].rows!.map((r) => r.key)).toEqual(['sc:SCH-03']);
  });

  it('describes schedules and next runs', () => {
    expect(trigOf({ kind: 'Time-based trigger', rec: 'Hourly', min: '15' })).toBe('Hourly · at minute 15');
    expect(trigOf({ kind: 'Event-driven trigger', ev: 'Knowledge gap recorded', obj: 'Article Agent' })).toBe('Knowledge gap recorded · Article Agent');
    const D = base().D;
    expect(nextOf(D.scheds[2])).toBe('—'); // disabled
    expect(nextOf({ ...D.scheds[2], on: true })).toBe('1st of next month 07:00');
  });

  it('runs the trigger wizard: fields, validation and record', () => {
    const D = base().D;
    const EVS = eventsOf(D, ['indicators_csv_ingest', 'docs_docx_ingest'], ['sceai_indicators']);
    const v = schedValues(D, EVS, null, 'Event-driven trigger');
    expect(schedFields(D, 'SCEAI', EVS, 1, v).map((f) => ('label' in f ? f.label : ''))).toEqual(['Event', 'Pipeline', 'Only when (optional)', 'Frequency limit', 'Trigger']);
    expect(validateSched(D, 0, v)).toBe('Enter a name.');
    const set = vi.fn();
    validateSched(D, 1, { ...v, ev: 'Document added to a collection' }, set, EVS);
    expect(set).toHaveBeenCalledWith('obj', 'sceai_indicators');
    expect(validateSched(D, 1, { kind: 'Time-based trigger', rec: 'Once', date: '24/11' })).toBe('Enter the date as YYYY-MM-DD.');
    const rec = schedRecord(D, { ...v, n: ' Refresh ', t: 'Article Agent', filt: 'status is Succeeded', ver: 'Pinned to current published version' });
    expect(rec).toMatchObject({ n: 'Refresh', kind: 'Event', target: 'agent:Article Agent', ver: 'Pinned v4', trig: 'Ingestion run completed · indicators_csv_ingest · only when status is Succeeded' });
  });
});

describe('scheduled reports', () => {
  it('lists reports with delivery details and history', () => {
    const R = reportsInit();
    const select = vi.fn();
    const m = reportsScreen({ tn: 'SCEAI', reports: R.reports.sceai, history: R.history.sceai, canEdit: true, selId: 'r1', go: { tab: noop }, a: { create: noop, select, runNow: noop } }, {}, noop);
    expect(m.head.add?.l).toBe('Create report');
    expect(m.sections[0].cols).toEqual(['Report', 'Content', 'Delivery schedule', 'Destination', 'Format', 'Next run', 'Last delivery']);
    const r1 = m.sections[0].rows![0];
    expect(r1.cells.slice(1, 5).map((x) => x.v)).toEqual(['Overview KPIs, Agent jobs, Ask AI usage, User feedback, Needs attention', 'Weekly · Sunday 07:00 AST', 'Email · 4 recipients', 'PDF']);
    expect(m.sections[0].rows![3].cells[5].v).toBe('—');
    expect(m.sections[0].rows![3].cells[6].p).toEqual(['draft', 'Paused']);
    r1.onClick!();
    expect(select).toHaveBeenCalledWith('r1');
    expect(m.sections[1].title).toBe('Delivery history');
    expect(m.sections[1].rows).toHaveLength(5);
    const ro = reportsScreen({ tn: 'SCEAI', reports: R.reports.sceai, history: [], canEdit: false, selId: '', go: { tab: noop }, a: { create: noop, select, runNow: noop } }, { st: 'Failed' }, noop);
    expect(ro.head.add).toBeUndefined();
    expect(ro.sections[0].rows!.map((r) => r.key)).toEqual(['rp:r3']);
    expect(labels(ro.sections[0].rows![0].acts)).toEqual(['Open']);
  });

  it('validates a report before saving', () => {
    expect(validateReport({ n: ' ', sec: ['overview'], rcp: ['x'] })).toBe('Enter the report name.');
    expect(validateReport({ n: 'A', sec: [], rcp: ['x'] })).toBe('Select at least one section.');
    expect(validateReport({ n: 'A', sec: ['overview'], rcp: [] })).toBe('Add at least one recipient.');
    expect(validateReport({ n: 'A', sec: ['overview'], rcp: ['x'] })).toBe('');
  });
});

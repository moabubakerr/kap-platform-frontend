import { describe, expect, it, vi } from 'vitest';
import { agentFactoryInit } from '@/v35/data/agentFactory';
import { grantAvail, kapServerFields, mcpRows, mcpScreen, toolInv, type AfBase, type McpCtx } from './build';
import {
  agentGrants, applyLiveMcp, checkHealth, checkMessage, fmtTime, grantKey, HDR_KEEP, HDR_NONE, HDR_SET, kapServerValues, knownTools, newKapServerValues, toKapCreate, toKapPatch,
  toKapRestore, toMcpServer, toolNames, toSrvInfo, validateKapServer, type KapAgentTools, type KapMcpCheck, type KapMcpServer,
} from './fromKap';

// fixtures shaped from MCPServerOut / MCPServerCheckOut / AgentOut (openai.json)
const SRV: KapMcpServer = {
  id: '5b0c3c1e-1111-4a2b-9c3d-000000000001', name: 'hr_directory', type: 'streamable_http', base_url: 'http://hr-mcp:8000/mcp',
  headers: { Authorization: { is_set: true } }, timeout_seconds: 60, tool_max_retries: 3, verify_tls: true, tls_ca_file: null, is_active: true,
  created_at: '2026-11-20T09:15:00Z', updated_at: '2026-11-22T14:03:11Z',
};
const OFF: KapMcpServer = { ...SRV, id: '5b0c3c1e-1111-4a2b-9c3d-000000000002', name: 'old_search', type: 'sse', headers: {}, is_active: false, tls_ca_file: '/certs/ca.pem', verify_tls: false };
const OK: KapMcpCheck = { status: 'ok', checked_at: '2026-11-24T08:00:00Z', reason_code: null, missing_tools: null };
const MISSING: KapMcpCheck = { status: 'ok', checked_at: '2026-11-24T08:00:00Z', reason_code: null, missing_tools: ['lookup_employee'] };
const DOWN: KapMcpCheck = { status: 'unavailable', checked_at: '2026-11-24T08:00:00Z', reason_code: 'connection_error', missing_tools: null };
const AGENTS: KapAgentTools[] = [
  { id: 'a-1', name: 'sandbox_indicators_agent', allowed_tools: ['hybrid_search', 'indicator_value'] },
  { id: 'a-2', name: 'hr_agent', allowed_tools: ['lookup_employee'] },
];

describe('KAP MCP server mapping', () => {
  it('maps KAP fields and leaves the rest honest', () => {
    const s = toMcpServer(SRV, 'sandbox');
    expect(s).toMatchObject({ n: 'hr_directory', own: 'sandbox', up: 'http://hr-mcp:8000/mcp', auth: 'Headers: Authorization', timeout: '60', retries: '3', status: 'Enabled', health: 'Not checked', lastOk: '—', p95: '—', tools: [] });
    expect([s.cls, s.pii, s.fx, s.dest, s.rate, s.vendor]).toEqual(['—', '—', '—', '—', '—', '']);
    expect(s.by).toBe('updated 2026-11-22 14:03 UTC');
    expect(toMcpServer(OFF, 'sandbox')).toMatchObject({ status: 'Disabled', auth: 'None' });
    expect(toSrvInfo(OFF)).toMatchObject({ type: 'sse', active: false, verifyTls: false, caFile: '/certs/ca.pem', headers: [] });
  });

  it('uses the session check for health', () => {
    expect(toMcpServer(SRV, 'sandbox', OK)).toMatchObject({ health: 'Healthy', lastOk: '2026-11-24 08:00 UTC' });
    expect(toMcpServer(SRV, 'sandbox', MISSING)).toMatchObject({ health: 'Degraded', note: 'missing tools: lookup_employee' });
    expect(toMcpServer(SRV, 'sandbox', DOWN)).toMatchObject({ health: 'Failing', lastOk: '—', note: 'connection_error' });
    expect(checkHealth(DOWN)).toBe('Failing');
    expect(checkMessage(OK)).toBe('KAP check OK at 2026-11-24 08:00 UTC');
    expect(checkMessage(DOWN)).toMatch(/unavailable .* OUTBOUND_PRIVATE_ALLOWLIST/);
    expect(checkMessage(MISSING)).toMatch(/missing on the server: lookup_employee/);
    expect(fmtTime(null)).toBe('—');
  });
});

describe('allowed_tools', () => {
  it('keys tools as KAP tools unless a check reported them missing on a server', () => {
    expect(grantKey('hybrid_search')).toBe('kap:hybrid_search');
    expect(grantKey('lookup_employee', { hr_directory: MISSING })).toBe('hr_directory:lookup_employee');
    expect(toolNames(['kap:hybrid_search', 'hr_directory:lookup_employee', 'kap:hybrid_search', 'x'])).toEqual(['hybrid_search', 'lookup_employee', 'x']);
  });

  it('keys grants by the store agent id (name or KAP id) and keeps the KAP ids', () => {
    const { grants, ids } = agentGrants(AGENTS, ['a-2', 'exp_router'], { hr_directory: MISSING });
    expect(grants).toEqual({ sandbox_indicators_agent: ['kap:hybrid_search', 'kap:indicator_value'], 'a-2': ['hr_directory:lookup_employee'] });
    expect(ids).toEqual({ sandbox_indicators_agent: 'a-1', 'a-2': 'a-2' });
    expect(knownTools(AGENTS)).toEqual(['hybrid_search', 'indicator_value', 'lookup_employee']);
  });

  it('replaces only the tenant slice', () => {
    const af = agentFactoryInit();
    const sceai = structuredClone(af.mcp.grants.sceai);
    applyLiveMcp(af.mcp, 'sandbox', [toMcpServer(SRV, 'sandbox')], { hr_agent: ['kap:lookup_employee'] });
    expect(af.mcp.servers.filter((s) => s.own === 'sandbox').map((s) => s.n)).toEqual(['hr_directory']);
    expect(af.mcp.servers.some((s) => s.n === 'oxford_economics')).toBe(true);
    expect(af.mcp.grants.sandbox).toEqual({ hr_agent: ['kap:lookup_employee'] });
    expect(af.mcp.grants.sceai).toEqual(sceai);
    expect(af.mcp.tenTools.sandbox).toEqual({ hr_directory: [] });
    expect(af.mcp.optOut.sandbox).toEqual({ doc_converter: true, web_fetch: true });
  });
});

describe('KAP bodies', () => {
  const v = { ...newKapServerValues(), n: 'hr_directory', up: ' http://hr-mcp:8000/mcp ', sid: '00000000-0000-0000-0000-0000000000aa' };

  it('validates with KAP rules', () => {
    expect(validateKapServer({ ...v, n: 'hr' }, [], false)).toMatch(/4–32/);
    expect(validateKapServer({ ...v, n: 'HR_Dir' }, [], false)).toBe('');
    expect(validateKapServer(v, ['hr_directory'], false)).toMatch(/already exists/);
    expect(validateKapServer({ ...v, up: 'hr-mcp' }, [], false)).toMatch(/URL/);
    expect(validateKapServer({ ...v, sid: 'not-a-uuid' }, [], false)).toMatch(/UUID/);
    expect(validateKapServer({ ...v, timeout: '0' }, [], false, 0)).toBe('');
    expect(validateKapServer({ ...v, timeout: '0' }, [], false)).toMatch(/Timeout/);
    expect(validateKapServer({ ...v, retries: '0' }, [], false)).toMatch(/retries/);
  });

  it('builds the create body', () => {
    expect(toKapCreate(v)).toEqual({
      name: 'hr_directory', type: 'streamable_http', base_url: 'http://hr-mcp:8000/mcp',
      headers: { Authorization: { $secret: { backend: 'vault', secret_id: '00000000-0000-0000-0000-0000000000aa', version: '1' } } },
      timeout_seconds: 60, tool_max_retries: 3, verify_tls: true,
    });
    expect(toKapCreate({ ...v, sid: '', type: 'Server-sent events (SSE)', ca: '/c.pem', tls: 'No' })).toEqual({
      name: 'hr_directory', type: 'sse', base_url: 'http://hr-mcp:8000/mcp', timeout_seconds: 60, tool_max_retries: 3, verify_tls: false, tls_ca_file: '/c.pem',
    });
  });

  it('patches only what changed and keeps headers unless replaced', () => {
    const s = toMcpServer(SRV, 'sandbox');
    const i = toSrvInfo(SRV);
    const v0 = kapServerValues(s, i);
    expect(v0.hdrMode).toBe(HDR_KEEP);
    expect(toKapPatch(v0, s, i)).toEqual({});
    expect(toKapPatch({ ...v0, up: 'http://hr-mcp:9000/mcp', timeout: '30', ca: '/c.pem' }, s, i)).toEqual({ base_url: 'http://hr-mcp:9000/mcp', timeout_seconds: 30, tls_ca_file: '/c.pem' });
    expect(toKapPatch({ ...v0, hdrMode: HDR_NONE }, s, i)).toEqual({ headers: {} });
    expect(toKapPatch({ ...v0, hdrMode: HDR_SET, hdr: 'X-Api-Key', sid: '00000000-0000-0000-0000-0000000000bb', sver: '2' }, s, i)).toEqual({
      headers: { 'X-Api-Key': { $secret: { backend: 'vault', secret_id: '00000000-0000-0000-0000-0000000000bb', version: '2' } } },
    });
    const so = toMcpServer(OFF, 'sandbox');
    const io = toSrvInfo(OFF);
    expect(toKapPatch({ ...kapServerValues(so, io), ca: '' }, so, io)).toEqual({ tls_ca_file: null });
    expect(toKapRestore(so, io)).toEqual({ name: 'old_search', type: 'sse', base_url: 'http://hr-mcp:8000/mcp', timeout_seconds: 60, tool_max_retries: 3, verify_tls: false, tls_ca_file: '/certs/ca.pem' });
  });
});

describe('live builders', () => {
  function liveBase(): AfBase {
    const af = agentFactoryInit();
    const checks = { hr_directory: MISSING };
    const { grants } = agentGrants(AGENTS, af.tenants.sandbox.agents.map((a) => a.id), checks);
    applyLiveMcp(af.mcp, 'sandbox', [toMcpServer(SRV, 'sandbox', MISSING), toMcpServer(OFF, 'sandbox')], grants);
    return {
      t: 'sandbox', tn: 'sandbox', af, D: af.tenants.sandbox, actor: 'admin', can: () => true,
      liveTools: { info: { hr_directory: toSrvInfo(SRV), old_search: toSrvInfo(OFF) }, known: knownTools(AGENTS) },
    };
  }
  const ctx = (b: AfBase): McpCtx => ({ ...b, tests: {}, go: { tab: vi.fn(), agent: vi.fn(), workflow: vi.fn(), mcp: vi.fn(), audit: vi.fn(), tool: vi.fn() }, a: { register: vi.fn(), test: vi.fn(), enableTools: vi.fn(), configure: vi.fn(), toggle: vi.fn(), remove: vi.fn(), grant: vi.fn() } });

  it('lists only KAP servers with KAP actions', () => {
    const b = liveBase();
    expect(mcpRows(b).map((r) => r.n)).toEqual(['hr_directory', 'old_search']);
    const m = mcpScreen(ctx(b), {}, () => {});
    const rows = (m.sections[0] as { rows: { key: string; cells: { v?: unknown }[]; acts?: { l: string }[] }[] }).rows;
    expect(rows.map((r) => (r.acts ?? []).map((a) => a.l))).toEqual([['Test connection', 'Configure', 'Deactivate'], ['Test connection', 'Configure', 'Reactivate']]);
  });

  it('shows KAP-known tools, not the design catalogue, and marks missing ones', () => {
    const b = liveBase();
    const L = toolInv(b);
    expect(L.map((t) => t.key).sort()).toEqual(['hr_directory:lookup_employee', 'kap:hybrid_search', 'kap:indicator_value']);
    expect(L.find((t) => t.n === 'indicator_value')).toMatchObject({ srcL: 'KAP · tenant configuration', st: 'Available', err: '—', calls: 0 });
    expect(L.find((t) => t.n === 'lookup_employee')).toMatchObject({ src: 'Tenant MCP', st: 'Missing on server' });
    expect(grantAvail(b.af, 'sandbox', 'kap:indicator_value', true)).toBe(true);
    expect(grantAvail(b.af, 'sandbox', 'hr_directory:lookup_employee', true)).toBe(false);
  });

  it('offers KAP fields only in the server form', () => {
    const keys = (f: ReturnType<typeof kapServerFields>) => f.map((x) => ('k' in x ? x.k : x.type));
    expect(keys(kapServerFields(0, newKapServerValues(), false))).toEqual(['n', 'type', 'up', 'hdr', 'sbk', 'sid', 'sver']);
    expect(keys(kapServerFields(0, { hdrMode: HDR_KEEP }, true, ['Authorization']))).toEqual(['n', 'type', 'up', 'hdrMode']);
    expect(keys(kapServerFields(1, {}, false))).toEqual(['timeout', 'retries', 'tls', 'ca', 'note']);
  });
});

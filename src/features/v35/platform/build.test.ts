import { describe, expect, it } from 'vitest';
import { mcpInit, registryInit, tenantsInit, type Registry } from '@/v35/data/platform';
import {
  activity, applyKill, applyMcp, applyModel, availChange, blankMcp, blankModel, checkServer, deleteDep, depRow, depRows, depsOf, discoverMcp, mcpUsersAll, mres, platformSummary, provisionSteps, questionsChart,
  saveDefaults, setDepStatus, sharedRow, spark, telemetry, tenantInventory, tenantModels, tenantOverview, tenantRecord, tenantRow, toggleTenant, validateKill, validateMcp, validateModel, validateTenant,
  INV_DEFAULT, type McpForm, type ModelForm,
} from './build';

const R0 = () => registryInit();
const dep = (R: Registry, id: string) => R.deps.find((d) => d.id === id)!;

describe('model registry data', () => {
  it('ports connections, models and endpoint limits', () => {
    const R = R0();
    expect([R.conns.length, R.deps.length]).toEqual([4, 9]);
    const q = dep(R, 'qwen72b-prod');
    expect([q.tpm, q.conc, q.reserve, q.peak]).toEqual(['400k', '32', '30', '81%']);
    expect(q.verified).toEqual(q.caps);
    expect(dep(R, 'partner-llama70b').verified).toEqual([]);
  });

  it('lists the users of a model, including tenant defaults', () => {
    const R = R0();
    const u = depsOf(R, dep(R, 'qwen32b-prod')).map((x) => `${x.t}|${x.k}|${x.n}`);
    expect(u).toEqual(['sandbox|Agent|exp_router', 'SCEAI|Agent|sceai_indicators_oxford (via default agent model)', 'SCEAI|Tenant default|Default agent model', 'sandbox|Tenant default|Default agent model']);
  });

  it('resolves model references (mres)', () => {
    const R = R0();
    expect(mres(R, 'sceai', 'sceai_indicators_oxford')).toMatchObject({ id: 'qwen32b-prod', ref: 'agent_default → qwen32b-prod', ok: true, short: 'Qwen2.5-32B' });
    expect(mres(R, 'sceai', 'sceai_indicators')).toMatchObject({ id: 'embed-prod', dims: '1024-d' });
    expect(mres(R, 'sandbox', 'vision_experiment').ok).toBe(true);
  });

  it('derives table rows and details', () => {
    const R = R0();
    expect(depRows(R, 'whisper').map((r) => r.d.id)).toEqual(['asr-whisper']);
    const r = depRow(R, dep(R, 'asr-whisper'));
    expect(r.ty).toBe('ASR');
    expect(r.prov).toBe('REST');
    expect(r.availL).toBe('SCEAI');
    expect(r.cfg.find((x) => x[0] === 'Languages')?.[1]).toBe('Arabic, English');
    expect(r.cfg.find((x) => x[0] === 'Max audio length')?.[1]).toBe('60');
    expect(r.ops.map((x) => x[0])).toEqual(['Health', 'Last check', 'Errors', 'Requests', 'Latency', 'Quota']);
    expect(depRow(R, dep(R, 'qwen72b-prod')).ops[5][0]).toBe('GPU');
    expect(depRow(R, dep(R, 'partner-llama70b')).status).toEqual(['draft', 'Disabled']);
  });
});

describe('model registry changes', () => {
  it('assigns and withdraws tenants', () => {
    const R = R0();
    expect(toggleTenant(R, 'qwen32b-prod', 'sandbox')).toEqual({ confirm: 'sandbox' });
    const add = toggleTenant(R, 'bge-m3-match', 'econ');
    if ('confirm' in add) throw new Error('unexpected confirm');
    expect(dep(add.next, 'bge-m3-match').ten).toEqual(['sceai', 'econ']);
    expect(add.msg).toBe('"bge-m3-match" made available to Economic Affairs.');
    const rest = toggleTenant(R, 'qwen14b-shared', 'all');
    if ('confirm' in rest) throw new Error('unexpected confirm');
    expect(dep(rest.next, 'qwen14b-shared')).toMatchObject({ all: false, ten: ['sceai', 'econ'] });
    expect(dep(R, 'qwen14b-shared').all).toBe(true); // input unchanged
  });

  it('disables, deletes and emergency-disables', () => {
    const R = R0();
    const off = setDepStatus(R, 'qwen7b-router', false);
    expect(dep(off.next, 'qwen7b-router').status).toBe('Disabled');
    expect(off.evs[0]).toEqual({ action: 'Disabled model', res: 'qwen7b-router', tenants: ['sceai'] });
    const del = deleteDep(R, 'partner-llama70b');
    expect(del.next.conns.map((c) => c.id)).toEqual(['c1', 'c2', 'c4']);
    expect(validateKill('gpt4o-sandbox', { reason: 'short', ack: 'Select' })).toMatch(/at least 8/);
    expect(validateKill('gpt4o-sandbox', { reason: 'Unsafe output seen', ack: 'Select' })).toBe('Confirm the emergency disable.');
    const k = applyKill(R, 'gpt4o-sandbox', ' Unsafe output seen ', 'kap.ops', 'AUD-123456');
    expect(dep(k.next, 'gpt4o-sandbox')).toMatchObject({ status: 'Disabled', kill: { by: 'kap.ops', reason: 'Unsafe output seen', ref: 'AUD-123456' } });
    expect(depRow(k.next, dep(k.next, 'gpt4o-sandbox')).ops.slice(-1)[0]?.[0]).toBe('Emergency disable');
  });

  it('validates and saves the model form', () => {
    const R = R0();
    const F: ModelForm = { mode: 'add', v: blankModel(R, 'LLM') };
    expect(validateModel(R, F)).toBe('Name: use lower-case letters, digits and hyphens.');
    F.v.id = 'qwen72b-prod';
    expect(validateModel(R, F)).toBe('A model with this name already exists.');
    F.v.id = 'mistral-small';
    F.v.model = 'Mistral-Small-24B-Instruct';
    F.v.caps = ['Chat'];
    F.v.ten = ['sandbox'];
    expect(validateModel(R, F)).toBe('Mistral-Small-24B-Instruct is not in the model catalog. Run Test before saving.');
    F.v.tested = { ok: true, lat: '1.2 s' };
    F.v.verified = ['Chat', 'Structured output'];
    expect(validateModel(R, F)).toBe('');
    const r = applyModel(R, F, 'kap.ops');
    expect(dep(r.next, 'mistral-small')).toMatchObject({ conn: 'c1', health: 'Healthy', verified: ['Chat'], status: 'Active', serving: 'Assigned by cluster scheduler' });
    expect(r.msg).toBe('Model "mistral-small" added.');
  });

  it('creates a new connection and rejects duplicate endpoints', () => {
    const R = R0();
    const v = { ...blankModel(R, 'LLM'), id: 'gpt4o-mini-prod', model: 'gpt-4o-mini', caps: ['Chat'], all: true, connMode: 'new' as const, ctype: 'Azure OpenAI' };
    v.c = { ep: 'https://kap-uaen.openai.azure.com', cred: 'managed', region: '', apiver: '2024-10-21', tls: 'Public CA', timeout: '60' };
    expect(validateModel(R, { mode: 'add', v })).toMatch(/already exists \(Azure OpenAI — UAE North\)/);
    v.c.ep = 'https://kap-weu.openai.azure.com';
    expect(validateModel(R, { mode: 'add', v })).toBe('Enter the Azure deployment.');
    v.did = 'gpt-4o-mini-prod';
    expect(validateModel(R, { mode: 'add', v })).toBe('');
    const r = applyModel(R, { mode: 'add', v }, 'kap.ops', 42);
    expect(r.next.conns.slice(-1)[0]).toMatchObject({ id: 'c42', n: 'Azure OpenAI — kap-weu.openai.azure.com', auth: 'Microsoft Entra ID (managed identity)' });
    expect(dep(r.next, 'gpt4o-mini-prod')).toMatchObject({ did: 'gpt-4o-mini-prod', health: 'Not checked' });
  });

  it('keeps tenant model defaults valid', () => {
    const R = R0();
    const V = tenantModels(R, 'sandbox');
    expect(V.rows.map((r) => r.id)).toEqual(['qwen32b-prod', 'qwen14b-shared', 'embed-prod', 'gpt4o-sandbox', 'partner-llama70b']);
    expect(V.rows.slice(-1)[0]?.status).toEqual(['rejected', 'Disabled']);
    expect(V.defaults.map((d) => d.cur)).toEqual(['qwen32b-prod · Qwen2.5-32B-Instruct', 'gpt4o-sandbox · gpt-4o', 'embed-prod · qwen3-embedding']);
    const bad = saveDefaults(R, 'sandbox', { agent: 'partner-llama70b', chat: 'gpt4o-sandbox', embed: 'embed-prod' });
    expect(bad).toEqual({ err: 'Not saved. Default agent model: partner-llama70b is currently unavailable.' });
    const ok = saveDefaults(R, 'sandbox', { agent: 'qwen32b-prod', chat: 'qwen14b-shared', embed: 'embed-prod' });
    if ('err' in ok) throw new Error(ok.err);
    expect(ok.next.tDef.sandbox.chat).toBe('qwen14b-shared');
    expect(ok.evs).toEqual([{ action: 'Changed default chat model', res: 'gpt4o-sandbox → qwen14b-shared', tenants: ['sandbox'], lvl: 'tenant' }]);
    const off = setDepStatus(R, 'gpt4o-sandbox', false).next;
    expect(tenantModels(off, 'sandbox').defaults[1]).toMatchObject({ warn: true, warnMsg: 'gpt4o-sandbox is unavailable (disabled by platform). Select another model.' });
  });
});

describe('MCP registry', () => {
  it('derives shared and tenant rows', () => {
    const M = mcpInit();
    const doc = sharedRow(M, M.servers[0]);
    expect(doc.tenL).toBe('SCEAI, sandbox');
    expect(doc.toolRows).toEqual([{ tn: 'extract_tables', td: 'Tables from PDF and DOCX reports', tt: 'SCEAI, sandbox' }, { tn: 'convert_pdf', td: 'PDF to structured text with layout', tt: 'sandbox' }]);
    expect(sharedRow(M, M.servers[1]).health).toEqual(['draft', '—']);
    const ox = tenantRow(M, M.servers[2]);
    expect([ox.o, ox.k, ox.users]).toEqual(['SCEAI', 'External', ['sceai_indicators_oxford']]);
    expect(mcpUsersAll(M, 'doc_converter').map((u) => u.a)).toEqual(['Article Agent', 'exp_router']);
  });

  it('checks connections and changes availability', () => {
    const M = mcpInit();
    expect(checkServer(M, 'web_fetch')).toMatchObject({ ok: false, msg: 'Not checked · the server is disabled.' });
    const ox = checkServer(M, 'oxford_economics');
    expect(ox.ok).toBe(true);
    expect(ox.next.servers[2].lastOk).toBe('just now');
    const a = availChange(M, 'doc_converter', ['sceai', 'econ']);
    expect([a.lost, a.added, a.hit]).toEqual([['sandbox'], ['econ'], [{ t: 'sandbox', k: 'Agent', n: 'exp_router' }]]);
    expect(a.next.tenTools.econ).toEqual({ doc_converter: [] });
    expect(a.evs[0].res).toBe('doc_converter · +Economic Affairs · −sandbox');
  });

  it('validates, discovers and saves a shared server', () => {
    const M = mcpInit();
    const F: McpForm = { mode: 'add', v: { ...blankMcp(), n: 'world_bank', up: 'https://api.worldbank.org/mcp', ten: ['econ'] }, adv: false, tested: null };
    expect(validateMcp(M, F)).toBe('External servers can receive L0 · Public data only.');
    F.v.cls = 'L0 · Public';
    expect(validateMcp(M, F)).toBe('Add api.worldbank.org to the egress allowlist (Advanced settings).');
    F.v.dest = 'api.worldbank.org:443';
    F.v.secret = 'secret/platform/kap/mcp_shared_token';
    expect(validateMcp(M, F)).toBe('');
    expect(applyMcp(M, F, 'kap.ops')).toEqual({ err: 'Run Test Connection & Discover Tools before saving.' });
    const d = discoverMcp(M, F);
    if ('err' in d) throw new Error(d.err);
    expect(d.tools?.map((t) => t.n)).toEqual(['wb_indicator', 'wb_country']);
    F.tested = d.tools;
    const r = applyMcp(M, F, 'kap.ops');
    if ('err' in r) throw new Error(r.err);
    expect(r.next.servers.slice(-1)[0]).toMatchObject({ n: 'world_bank', own: 'platform', health: 'Healthy', status: 'Enabled' });
    expect(r.next.tenTools.econ).toEqual({ world_bank: [] });
    const notMcp = discoverMcp(M, { ...F, v: { ...F.v, up: 'https://api.worldbank.org/v2' } });
    expect(notMcp).toMatchObject({ ok: false, tools: null });
  });
});

describe('platform overview and tenants', () => {
  it('judges service health from telemetry', () => {
    const S = telemetry(R0(), mcpInit());
    const by = (n: string) => S.find((s) => s.n === n)!;
    expect(by('Model endpoints')).toMatchObject({ status: 'Healthy', shown: '8 of 8 enabled verified healthy', go: 'pModels' });
    expect(by('MCP proxy and servers')).toMatchObject({ status: 'Degraded', shown: '3 of 4 healthy · oxford_economics degraded' });
    expect(by('SIEM forwarding')).toMatchObject({ status: 'Unknown', pill: 'draft' });
    expect(by('Data Bus').status).toBe('Busy');
  });

  it('summarises the platform for a period', () => {
    const TEN = tenantsInit();
    const S = platformSummary(TEN, '7d', telemetry(R0(), mcpInit()));
    expect(S.map((x) => [x.k, x.v, x.d])).toEqual([
      ['Active tenants', '3', '2 need attention'],
      ['Service health', '5 / 10', '4 open alerts'],
      ['Running jobs', '7', 'kap.agent 6 · kap.pipeline 1'],
      ['Failed jobs', '51', 'in 7 days'],
      ['Agent requests', '1,190', 'in 7 days'],
    ]);
    const A = activity(TEN, '7d', 'all');
    expect(A.metrics.find((m) => m[0] === 'Job failure rate')?.[1]).toBe('11.3%');
    expect(A.tenants.map((t) => t.n)).toEqual(['SCEAI', 'Economic Affairs', 'sandbox']);
    expect(A.vals.reduce((x, y) => x + y, 0)).toBeGreaterThan(1180);
    const econ = activity(TEN, '7d', 'econ');
    expect(econ.metrics[0][1]).toBe('412');
    expect(tenantOverview(TEN).attn.map((t) => t.n)).toEqual(['SCEAI', 'sandbox']);
  });

  it('searches, filters, sorts and pages the inventory', () => {
    const TEN = tenantsInit();
    expect(tenantInventory(TEN, { ...INV_DEFAULT, fs: 'At limit' }).rows.map((r) => r.t.n)).toEqual(['SCEAI']);
    expect(tenantInventory(TEN, { ...INV_DEFAULT, sk: 'u', sd: -1 }).rows.map((r) => r.t.k)).toEqual(['econ', 'sceai', 'sandbox', 'default']);
    const p = tenantInventory(TEN, { ...INV_DEFAULT, ps: 2, pg: 2 });
    expect([p.info, p.page, p.rows.length]).toEqual(['3–4 of 4', 'Page 2 of 2', 2]);
    expect(tenantInventory(TEN, { ...INV_DEFAULT, q: 'directorate' }).rows.map((r) => [r.t.n, r.q])).toEqual([['Economic Affairs', '1 / 3']]);
    expect(tenantInventory(TEN, { ...INV_DEFAULT, q: 'zzz' }).empty).toBe(true);
    expect(tenantInventory(TEN, { ...INV_DEFAULT, q: 'Default' }).rows[0].u).toBe('3 service');
  });

  it('validates a new tenant and builds its provisioning checklist', () => {
    const TEN = tenantsInit();
    expect(validateTenant(TEN, 0, { k: 'sceai', n: 'X' })).toBe('A tenant with this key already exists.');
    expect(validateTenant(TEN, 0, { k: 'finance', n: 'sandbox' })).toBe('A tenant with this name already exists.');
    expect(validateTenant(TEN, 1, { agent: '9', pipe: '1' })).toMatch(/between 1 and 8/);
    expect(validateTenant(TEN, 2, { admin: 'fin_admin', email: 'nope' })).toBe('Enter the administrator e-mail address.');
    const v = { k: 'finance', n: 'Finance', d: '', agent: '2', pipe: '1', models: 'Platform defaults', admin: 'fin_admin', email: 'fin@x.qa', idp: 'Keycloak · kap-admin realm' };
    expect(provisionSteps(v)).toEqual(['Tenant record finance created', 'Queue policy kap.agent · max in-flight 2', 'Queue policy kap.pipeline · max in-flight 1', 'Default model providers linked', 'Groups tenant_admins and catalog_readers created', 'Admin user fin_admin created']);
    expect(tenantRecord(v)).toMatchObject({ k: 'finance', st: 'Provisioning', max: 2, d: 'New tenant' });
  });
});

describe('dashboard charts', () => {
  it('builds the questions chart and sparklines', () => {
    const Q = questionsChart([64, 67, 50, 75, 82, 88, 82], [52, 58, 47, 61, 66, 70, 66], ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today']);
    expect(Q.cur.split(' ')[0]).toBe('24.0,57.6');
    expect(Q.pts.slice(-1)[0]).toMatchObject({ l: 'Today', last: true, x: '95.71' });
    expect(Q.grid).toEqual(['100.5', '73.0', '45.5']);
    expect(spark([1, 2, 3])).toBe('0.0,22.0 50.0,12.0 100.0,2.0');
  });
});

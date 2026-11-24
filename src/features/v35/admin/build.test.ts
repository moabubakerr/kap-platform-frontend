import { describe, expect, it, vi } from 'vitest';
import { adminInit, assignedOf, telemetry, type AdminData } from '@/v35/data/admin';
import type { AuditEvent } from '@/v35/data/audit';
import {
  activateLicense, auditRows, auditScreen, licenseScreen, monitoringScreen, pChange, platformConfigScreen, saveAlloc, saveMapping, saveRetention, saveRule, saveVault, secretsScreen, tChange,
  tenantConfigScreen, tenantSecurityScreen, testVault, type AdminCtx,
} from './build';
import { allocKey, mappingError, pGet, refOf, rotState, tGet } from './logic';

const noop = () => {};
const labels = (acts?: { l: string }[]) => (acts ?? []).map((x) => x.l);

function ctx(o: Partial<AdminCtx> = {}, perms: string[] = ['config:manage', 'monitor:manage', 'security:manage', 'license:manage', 'platform:manage']) {
  let D: AdminData = adminInit();
  const events: AuditEvent[] = [];
  const timers: (() => void)[] = [];
  const ui = { form: vi.fn(), confirm: vi.fn(), info: vi.fn(), toast: vi.fn() };
  const c: AdminCtx = {
    actor: 'kap.ops',
    get D() {
      return D;
    },
    get: () => D,
    set: (fn) => {
      const n = structuredClone(D);
      fn(n);
      D = n;
    },
    ui,
    audit: (e) => events.unshift({ id: String(events.length), at: '2026-11-24T10:15:00Z', ...e }),
    canP: (p) => perms.includes(p),
    canT: true,
    T: 'sceai',
    go: vi.fn(),
    openUrl: vi.fn(),
    later: (fn) => void timers.push(fn),
    adminCount: 12,
    events,
    ...o,
  };
  return { c, ui, events, timers, data: () => D };
}

describe('admin data', () => {
  it('ports platform and all three tenant configurations', () => {
    const D = adminInit();
    expect(D.pcfg.keys.map((k) => k.id)).toEqual(['kap-root-kek', 'tenant-sceai-kek', 'tenant-econ-kek', 'tenant-sandbox-kek', 'audit-signing', 'callback-signing']);
    expect([D.tcfg.sceai.creds.length, D.tcfg.econ.creds.length, D.tcfg.sandbox.creds.length]).toEqual([7, 1, 2]);
    expect(assignedOf(D.pcfg, 'econ')).toMatchObject({ agentConc: '3', pipeConc: '2', prio: '2', bulk: '01:00–04:00 AST' });
  });

  it('judges telemetry age: stale and missing are never healthy', () => {
    const s = Object.fromEntries(telemetry(adminInit().pcfg).services.map((x) => [x.n, x]));
    expect(s['Data Bus'].status).toBe('Busy');
    expect(s['Model endpoints'].shown).toBe('8 of 8 enabled verified healthy');
    expect(s['MCP proxy and servers'].shown).toBe('3 of 4 healthy · oxford_economics degraded');
    expect(s['SIEM forwarding'].status).toBe('Unknown');
    expect(s['License service'].pill).toEqual(['hold', 'Stale']);
  });

  it('computes rotation state and vault references', () => {
    expect(rotState(94, 90, 'transit')).toEqual(['rejected', 'Overdue 4 d']);
    expect(rotState(87, 90, '')).toEqual(['hold', 'Due in 3 d']);
    expect(rotState(1, 365, 'hsm')).toEqual(['draft', 'Managed in HSM']);
    const P = adminInit().pcfg;
    expect(refOf(P, 'sceai', 'oxford_api_key')).toBe('kap-vault · tenants/sceai/oxford_api_key');
    expect(refOf(P, 'econ', 'budget_share_secret')).toBe('kv-ea-prod · secrets/budget-share-secret');
    expect(allocKey('SCEAI · kap.agent · max in flight')).toEqual(['sceai', 'kap.agent', 3]);
  });
});

describe('platform configuration', () => {
  it('shows tabs and gates edits on config:manage', () => {
    const { c } = ctx();
    const m = platformConfigScreen(c, undefined, noop);
    expect(m.head.tabs?.map((t) => t.label)).toEqual(['General', 'Workloads & Scheduling', 'Security Defaults', 'Configuration History']);
    expect(m.sections[0].rows!.map((r) => r.cells[0].v)).toEqual(['Installation name', 'Admin session timeout', 'Supported interface languages', 'Default interface language']);
    expect(labels(m.sections[0].rows![0].acts)).toEqual(['Edit']);
    const ro = platformConfigScreen(ctx({}, ['config:read']).c, 'general', noop);
    expect(labels(ro.sections[0].rows![0].acts)).toEqual([]);
  });

  it('versions a change, records it and allows roll back', () => {
    const { c, events, data } = ctx();
    expect(pChange(c, 'Admin session timeout', '30 min')).toBe('No change.');
    expect(pChange(c, 'Admin session timeout', '60 min')).toBe('');
    expect(data().pcfg.general.timeout).toBe('60 min');
    expect(data().pcfg.hist[0]).toMatchObject({ v: 47, key: 'Admin session timeout', old: '30 min', nw: '60 min', by: 'kap.ops' });
    expect(events[0]).toMatchObject({ action: 'Changed platform setting', res: 'Admin session timeout: 30 min → 60 min', lvl: 'platform', area: 'Platform Configuration' });
    const h = platformConfigScreen(c, 'history', noop).sections[0];
    expect(labels(h.rows![0].quick)).toEqual(['Roll back']);
    expect(h.rows!.find((r) => r.key === 'h:43')!.cells[6].p).toEqual(['draft', 'Superseded']);
  });

  it('saves a tenant workload allocation within the queue capacity', () => {
    const { c, data, events } = ctx();
    const r = data().pcfg.alloc[0];
    expect(saveAlloc(c, r, { fs: r[2], mx: '9', pc: r[4], bw: r[5] })).toBe('Max in flight must be a whole number from 1 to 8.');
    expect(saveAlloc(c, r, { fs: r[2], mx: '2', pc: r[4], bw: r[5] })).toBe('');
    expect(pGet(data().pcfg, 'SCEAI · kap.agent · max in flight')).toBe('2');
    expect(events[0]).toMatchObject({ action: 'Changed tenant workload allocation', tenants: ['sceai'] });
    expect(c.ui.toast).toHaveBeenLastCalledWith('SCEAI · kap.agent allocation saved. The tenant limit of 3 is capped at 2.');
  });
});

describe('monitoring', () => {
  it('orders alerts and gates actions', () => {
    const { c } = ctx();
    const m = monitoringScreen(c);
    const al = m.sections[2];
    expect(al.rows!.map((r) => r.key)).toEqual(['al:A-1207', 'al:A-1206', 'al:A-1203', 'al:A-1201', 'al:A-1198']);
    expect(labels(al.rows![0].acts)).toEqual(['Acknowledge', 'Add note…', 'Close…']);
    expect(labels(al.rows![4].acts)).toEqual([]);
    expect(labels(m.sections[3].rows!.find((r) => r.key === 'ru:r7')!.acts)).toEqual(['Open in Grafana']);
    const ro = monitoringScreen(ctx({}, ['monitor:read']).c);
    expect(labels(ro.sections[2].rows![0].acts)).toEqual([]);
    expect(ro.sections[3].sacts).toEqual([]);
  });

  it('validates and adds alert rules', () => {
    const { c, data } = ctx();
    const v = { n: 'Worker busy', metric: 'Worker occupancy', op: '>', thr: '120', dur: '5 min', sev: 'Warning', route: 'On-call' };
    expect(saveRule(c, null, v)).toBe('A percentage threshold cannot exceed 100.');
    expect(saveRule(c, null, { ...v, n: 'MCP server errors', thr: '90' })).toBe('A rule with this name exists.');
    expect(saveRule(c, null, { ...v, thr: '90' })).toBe('');
    expect(data().mon.rules[data().mon.rules.length - 1]).toMatchObject({ n: 'Worker busy', unit: '%', on: true, mg: 'KAP' });
  });
});

describe('unified audit log', () => {
  const live: AuditEvent[] = [
    { id: '1', who: 'sceai_admin', action: 'Created data source', res: 'x · S3', tenants: ['sceai'], lvl: 'tenant', area: 'Data Ingestion Hub', at: '2026-11-24T10:15:00Z' },
    { id: '2', who: 'kap.ops', action: 'Changed platform setting', res: 'y', tenants: [], lvl: 'platform', area: 'Platform Configuration', at: '2026-11-24T10:00:00Z' },
  ];

  it('merges live events before the seed and scopes them to the tenant', () => {
    expect(auditRows(live, null).length).toBe(12);
    expect(auditRows(live, null)[0].action).toBe('Created data source');
    const t = auditRows(live, 'sceai');
    expect(t.every((e) => e.tk.includes('sceai'))).toBe(true);
    expect(t.length).toBe(6);
  });

  it('filters by tenant, area and time and exports', () => {
    const { c, events } = ctx({ events: live });
    const m = auditScreen(c, false, { ten: 'Platform', time: 'Last 7 days' }, noop);
    expect(m.sections[0].cols).toEqual(['When', 'Actor', 'Tenant', 'Area', 'Operation', 'Resource']);
    expect(m.sections[0].rows!.map((r) => r.cells[4].v)).toEqual(['Changed platform setting', 'Returned gpu-03 to the model pool', 'Changed tenant workload allocation']);
    expect(m.filters!.main.map((f) => f.label)).toEqual(['Actor', 'Tenant', 'Operation area', 'Time']);
    const t = auditScreen(c, true, { area: 'Tenant Configuration' }, noop);
    expect(t.filters!.main.map((f) => f.label)).toEqual(['Actor', 'Operation area', 'Time']);
    expect(t.sections[0].rows!.length).toBe(1);
    t.head.add!.f();
    expect(events[0]).toMatchObject({ action: 'Exported audit events', res: '1 events', tenants: ['sceai'], lvl: 'tenant', area: 'Unified Audit Log' });
  });
});

describe('secrets & keys', () => {
  it('rotates a key through requested, completed and verified', () => {
    const { c, timers, events } = ctx();
    const row = () => secretsScreen(c, 'keys', noop).sections[0].rows!.find((r) => r.key === 'k:tenant-sceai-kek')!;
    expect(labels(row().acts)).toEqual(['Rotate']);
    expect(labels(secretsScreen(c, 'keys', noop).sections[0].rows![0].acts)).toEqual([]);
    row().acts![0].f();
    (c.ui.confirm as ReturnType<typeof vi.fn>).mock.calls[0][4]();
    expect(row().cells[5].p).toEqual(['submitted', 'Rotation requested']);
    expect(labels(row().acts)).toEqual([]);
    timers.shift()!();
    expect(labels(row().acts)).toEqual(['Verify']);
    row().acts![0].f();
    expect(row().cells[3].p).toEqual(['approved', 'Verified']);
    expect(events.map((e) => e.action).slice(0, 3)).toEqual(['Verified rotation', 'Rotation completed', 'Requested rotation']);
  });

  it('fails the first callback-signing verification', () => {
    const { c, timers, ui } = ctx();
    const row = () => secretsScreen(c, 'keys', noop).sections[0].rows!.find((r) => r.key === 'k:callback-signing')!;
    expect(labels(row().acts)).toEqual(['Rotate…']);
    row().acts![0].f();
    ui.form.mock.calls[0][3]({ ov: '24 h' });
    timers.shift()!();
    row().acts![0].f();
    expect(row().cells[3].p).toEqual(['rejected', 'Failing']);
    row().acts![0].f();
    expect(row().cells[3].p).toEqual(['approved', 'Verified']);
  });

  it('lists service credentials with their consumers', () => {
    const { c } = ctx();
    const rows = secretsScreen(c, 'creds', noop).sections[0].rows!;
    expect(rows.length).toBe(9);
    expect(rows[0].cells.map((x) => x.v)).toEqual(['vllm_client_cert', 'Client certificate', 'Internal vLLM Cluster', 'Internal PKI', '', '120 d ago', 'Expires in 245 d']);
    expect(labels(rows[0].acts)).toEqual([]);
    expect(rows[4].cells[4].p).toEqual(['rejected', 'Failing']);
    expect(labels(rows[4].acts)).toEqual(['Replace value…']);
  });

  it('adds, tests and maps vault backends', () => {
    const { c, data, ui } = ctx();
    expect(saveVault(c, null, { n: 'AWS prod', ty: 'AWS Secrets Manager', ep: 'https://secretsmanager.me-central-1.amazonaws.com', auth: 'Managed identity' })).toBe('AWS Secrets Manager supports: IAM role.');
    expect(saveVault(c, null, { n: 'AWS prod', ty: 'AWS Secrets Manager', ep: 'https://secretsmanager.me-central-1.amazonaws.com', auth: 'IAM role' })).toBe('');
    const v = data().pcfg.vaults[2];
    expect(v).toMatchObject({ id: 'aws-prod', st: 'Not tested' });
    expect(saveMapping(c, 'sandbox', 'AWS prod', 'Dedicated')).toBe('Select a connected backend.');
    testVault(c, v);
    expect(data().pcfg.vaults[2].st).toBe('Connected');
    expect(mappingError(data().pcfg, 'sandbox', 'kv-ea-prod', 'Shared')).toBe('Economic Affairs key vault is dedicated to another tenant.');
    expect(saveMapping(c, 'sandbox', 'AWS prod', 'Dedicated')).toBe('');
    expect(data().pcfg.vmap.sandbox).toEqual({ v: 'aws-prod', mode: 'Dedicated' });
    // the platform vault is still used: removal is blocked
    const kv = secretsScreen(c, 'vaults', noop).sections[0].rows![0];
    kv.acts!.find((a) => a.l === 'Remove')!.f();
    expect(ui.info).toHaveBeenCalled();
  });
});

describe('license management', () => {
  it('shows capacity and activates offline codes', () => {
    const { c, data } = ctx();
    const m = licenseScreen(c);
    expect(m.head.add?.l).toBe('Activate license');
    expect(m.sections[1].rows!.map((r) => r.cells[3].p![1])).toEqual(['30%', '24%', '31%', '100%']);
    expect(activateLicense(c, 'bad')).toBe('Enter a code in the form KAP-XXXX-XXXX-XXXX.');
    expect(activateLicense(c, 'kap-ab12-cd34-ef56')).toBe('');
    expect(data().pcfg.license).toMatchObject({ until: '31 Dec 2028', code: 'KAP-AB12-CD34-EF56' });
    expect(licenseScreen(ctx({}, ['license:read']).c).head.add).toBeUndefined();
  });
});

describe('tenant configuration', () => {
  it('gates edits on tenant:configure and locks platform-owned rows', () => {
    const { c } = ctx();
    const m = tenantConfigScreen(c, 'general', noop);
    expect(m.sections[0].rows![0].lockTip).toBe('Set by the platform');
    expect(labels(m.sections[0].rows![1].acts)).toEqual(['Edit']);
    const ro = tenantConfigScreen(ctx({ canT: false }).c, 'general', noop);
    expect(ro.sections[0].rows!.every((r) => !r.acts?.length)).toBe(true);
    expect(tenantConfigScreen(ctx({ T: null }).c, 'general', noop).sections[0].callout).toBeTruthy();
  });

  it('shows resources within the platform allocation', () => {
    const { c } = ctx();
    const rs = tenantConfigScreen(c, 'res', noop).sections[0].rows!;
    expect(rs.map((r) => r.cells[0].v)).toEqual(['kap.agent concurrency', 'kap.pipeline concurrency', 'Requests per API credential', 'Max tool calls per run', 'Max run duration', 'Model tokens', 'Storage', 'Oxford Economics calls per month']);
    expect(rs[0].cells.map((x) => x.v)).toEqual(['kap.agent concurrency', '8 in flight', '3 in flight', '3', '3 in flight']);
    expect(rs[5].lockTip).toBe('Set by the platform');
    expect(tenantConfigScreen(ctx({ T: 'econ' }).c, 'res', noop).sections[0].rows!.length).toBe(7);
  });

  it('records tenant changes and retention rules', () => {
    const { c, data, events } = ctx();
    expect(tChange(c, 'Time zone', 'UTC')).toBe('');
    expect(data().tcfg.sceai.hist[0]).toMatchObject({ v: 15, area: 'General', key: 'Time zone', old: 'Asia/Qatar', nw: 'UTC' });
    expect(events[0]).toMatchObject({ action: 'Changed tenant setting', tenants: ['sceai'], lvl: 'tenant', area: 'Tenant Configuration' });
    expect(saveRetention(c, 'Runs and traces', '1 year', 'Purge')).toBe('No change.');
    expect(saveRetention(c, 'Runs and traces', '3 years', 'Archive')).toBe('');
    expect(tGet(data().tcfg.sceai, 'Runs and traces · retention')).toBe('3 years');
    expect(events[0].res).toBe('Runs and traces · 1 year → 3 years, Purge → Archive');
    const h = tenantConfigScreen(c, 'history', noop).sections[0];
    expect(h.rows!.slice(0, 2).map((r) => r.cells[2].v)).toEqual(['Runs and traces · then', 'Runs and traces · retention']);
  });
});

describe('tenant security', () => {
  it('lists credential references and the tenant key', () => {
    const { c } = ctx();
    const m = tenantSecurityScreen(c);
    const rows = m.sections[0].rows!;
    expect(rows.length).toBe(7);
    expect(labels(rows.find((r) => r.key === 'tc:callback_hmac')!.acts)).toEqual(['Rotate']);
    expect(labels(rows[0].acts)).toEqual(['Replace value…']);
    expect(rows.find((r) => r.key === 'tc:callback_hmac')!.cells[6].p).toEqual(['hold', 'Due in 3 d']);
    expect(m.sections[1].rows![0].cells[0].v).toBe('tenant-sceai-kek');
    expect(labels(tenantSecurityScreen(ctx({ canT: false }).c).sections[0].rows![0].acts)).toEqual([]);
  });

  it('replaces a tenant secret and verifies its consumer', () => {
    const { c, ui, events } = ctx();
    const row = () => tenantSecurityScreen(c).sections[0].rows![0];
    row().acts![0].f();
    expect(ui.form.mock.calls[0][3]({ v: 'short' })).toBe('The value looks too short.');
    expect(ui.form.mock.calls[0][3]({ v: 'AKIA-new-long-value' })).toBe('');
    expect(events[0]).toMatchObject({ action: 'Replaced tenant secret', area: 'Security & Credentials', tenants: ['sceai'] });
    expect(labels(row().acts)).toEqual(['Verify']);
    row().acts![0].f();
    expect(row().cells[3].p).toEqual(['approved', 'Verified']);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { adminInit, type AdminData } from '@/v35/data/admin';
import type { AuditEvent } from '@/v35/data/audit';
import { auditScreen, tenantConfigScreen, type AdminCtx, type KapAuditView, type KapConfigView } from './build';
import {
  actionOfType, areaOfType, auditKv, auditQuery, auditRowOf, configRows, KAP_AREAS, KAP_EVENT_TYPES, planBody, planItems, rollbackBody, rollbackMsg, typesOfArea, whoOf,
  type KapAuditDetails, type KapAuditSummary, type KapConfigPlan, type KapConfigVersion, type KapRollbackOut,
} from './fromKap';

const NOW = Date.parse('2026-11-24T12:00:00Z');
const UID = '3f2a9c1e-1111-4222-8333-944455556666';

const ev = (o: Partial<KapAuditSummary> = {}): KapAuditSummary => ({
  id: 'e1',
  occurred_at: '2026-11-24T10:15:00Z',
  event_type: 'agent.created',
  result: 'success',
  subject_type: 'user',
  subject_id: UID,
  tenant_id: 't-sbx',
  object_type: 'agent',
  object_id: 'a-42',
  source_ip: '10.0.0.5',
  request_id: 'req-1',
  reason_code: null,
  provider_key: null,
  client_id: null,
  ...o,
});

const ver = (o: Partial<KapConfigVersion> = {}): KapConfigVersion => ({
  id: 'v-3',
  tenant_id: 't-sbx',
  version: 3,
  created_at: '2026-11-20T08:00:00Z',
  author_id: UID,
  author_display: 'sbx_admin',
  source: 'api_update',
  restored_from_version_id: null,
  is_current: true,
  structure_hash: 'abc123',
  ...o,
});

const plan = (o: Partial<KapConfigPlan> = {}): KapConfigPlan => ({
  tenant_id: 't-sbx',
  selected_version_id: 'v-1',
  selected_version: 1,
  current_version: 3,
  expected_current_version: 3,
  changed: true,
  resulting_version: 4,
  sections: {
    agents: { counts: { created: 0, updated: 2, reactivated: 0, deactivated: 1 }, created: [], updated: ['exp_router', 'helper'], reactivated: [], deactivated: ['vision_experiment'] },
    mcp_servers: { counts: { created: 1, updated: 0, reactivated: 0, deactivated: 0 }, created: ['wb'], updated: [], reactivated: [], deactivated: [] },
  },
  collection_resets: ['sbx_docs'],
  changed_connectors: [],
  rebuild_schedules: true,
  execution_parameter_changes: [{ resource_type: 'agent', resource_id: 'a1', name: 'exp_router', task_priority_before: 1, task_priority_after: 3, max_in_flight_tasks_before: 2, max_in_flight_tasks_after: 2 }],
  quota_exceeded: [],
  ...o,
});

function ctx(o: Partial<AdminCtx> = {}) {
  const D: AdminData = adminInit();
  const events: AuditEvent[] = [];
  const ui = { form: vi.fn(), confirm: vi.fn(), info: vi.fn(), toast: vi.fn() };
  const c: AdminCtx = {
    actor: 'sbx_admin', D, get: () => D, set: vi.fn(), ui, audit: vi.fn(), canP: () => true, canT: true, T: 'sandbox',
    go: vi.fn(), openUrl: vi.fn(), later: vi.fn(), adminCount: 3, events, ...o,
  };
  return { c, ui };
}

describe('KAP audit events', () => {
  it('maps event types to console areas and readable actions', () => {
    expect(areaOfType('agent_job.finished')).toBe('Agent Factory');
    expect(areaOfType('rbac.group.member_added')).toBe('Identity & Access');
    expect(areaOfType('model_provider.check')).toBe('Model Providers Registry');
    expect(actionOfType('rbac.group.member_added')).toBe('RBAC group member added');
    expect(actionOfType('auth.login')).toBe('Signed in');
    expect(actionOfType('m2m.token.issued')).toBe('M2M token issued');
    // every KAP event type has a console area
    expect(KAP_EVENT_TYPES.every((t) => areaOfType(t) !== 'KAP')).toBe(true);
    expect(typesOfArea('Model Providers Registry')).toEqual(['model_provider.created', 'model_provider.updated', 'model_provider.deleted', 'model_provider.check', 'model_provider.rate_limit_incident']);
    expect(KAP_AREAS).toContain('Data Ingestion Hub');
  });

  it('shows the subject by type and short id (KAP has no names)', () => {
    expect(whoOf(ev())).toBe('User 3f2a9c1e…');
    expect(whoOf(ev({ subject_type: 'system', subject_id: null }))).toBe('System');
    expect(whoOf(ev({ subject_type: 'service_account', subject_id: null, client_id: 'etl' }))).toBe('Service account · client etl');
  });

  it('maps a summary to an audit row marked as from KAP', () => {
    const r = auditRowOf(ev({ result: 'failure' }), 'sandbox', NOW);
    expect(r).toMatchObject({ who: 'User 3f2a9c1e…', tk: ['sandbox'], area: 'Agent Factory', action: 'Agent created', res: 'agent · a-42', kap: { id: 'e1', type: 'agent.created', failed: true } });
    expect(r.ts).toBe(Date.parse('2026-11-24T10:15:00Z'));
    expect(r.age).toBeCloseTo(1.75 / 24, 5);
    expect(r.when).toMatch(/^Today · \d\d:\d\d$/);
    expect(auditRowOf(ev({ occurred_at: '2026-10-01T09:00:00Z' }), 'sandbox', NOW).when).toMatch(/^2026-10-01 \d\d:\d\d$/);
  });

  it('details panel: summary first, then recorded time and data once loaded', () => {
    const e = ev();
    const last = <T,>(xs: T[]) => xs[xs.length - 1];
    expect(last(auditKv(e, undefined))).toEqual(['Details', 'Loading details from KAP…']);
    expect(last(auditKv(e, { err: 'Forbidden' }))[1]).toContain('Forbidden');
    const d: KapAuditDetails = { ...e, recorded_at: '2026-11-24T10:15:01Z', data: { name: 'exp_router', changes: { a: 1 } } };
    const kv = auditKv(e, d);
    expect(kv).toContainEqual(['Recorded', '2026-11-24 10:15 UTC']);
    expect(kv).toContainEqual(['data.name', 'exp_router', true]);
    expect(kv).toContainEqual(['data.changes', '{"a":1}', true]);
    expect(kv).toContainEqual(['Event id', 'e1', true]);
  });

  it('maps filters to KAP query parameters', () => {
    expect(auditQuery({}, { limit: 50, offset: 0 }, NOW)).toEqual({ limit: 50, offset: 0 });
    const q = auditQuery({ area: 'Model Providers Registry', time: 'Last 7 days', res: 'Failure', subj: 'Service account' }, { limit: 25, offset: 50 }, NOW);
    expect(q).toMatchObject({ limit: 25, offset: 50, result: 'failure', subject_type: 'service_account', occurred_at__ge: '2026-11-17T12:00:00.000Z' });
    expect(q.event_type__in).toHaveLength(5);
    // a console-only area matches no KAP event
    expect(auditQuery({ area: 'Unified Audit Log' }, { limit: 50, offset: 0 }, NOW).event_type__in).toEqual(['__none__']);
    expect(auditQuery({ area: 'Any', time: 'Any time', res: 'Any', subj: 'Any' }, { limit: 50, offset: 0 }, NOW)).toEqual({ limit: 50, offset: 0 });
  });

  it('audit screen merges session and KAP events for the live tenant (no seed events), pages KAP', () => {
    const { c } = ctx();
    c.events.push({ id: 's1', who: 'sbx_admin', action: 'Changed tenant setting', res: 'Time zone: UTC → Asia/Qatar', tenants: ['sandbox'], lvl: 'tenant', area: 'Tenant Configuration', at: '2026-11-24T11:00:00Z' });
    const K: KapAuditView = { events: [ev(), ev({ id: 'e2', occurred_at: '2026-11-24T11:30:00Z', event_type: 'model_provider.check' })], total: 120, offset: 50, limit: 50, setPage: vi.fn(), openId: null, open: vi.fn(), details: {}, now: NOW };
    const m = auditScreen(c, true, {}, vi.fn(), K);
    const s = m.sections[0];
    // newest first across both sources
    expect(s.rows!.map((r) => r.cells[3].v)).toEqual(['Model provider check', 'Changed tenant setting', 'Agent created']);
    expect(s.rows!.map((r) => r.cells[0].sub)).toEqual(['KAP', 'Console session', 'KAP']);
    // KAP rows open through the page (details load on open)
    s.rows![0].onClick!();
    expect(K.open).toHaveBeenCalledWith('e2');
    expect(s.rows![0].kv).toBeUndefined();
    expect(s.pager).toMatchObject({ l: 'KAP events 51–52 of 120', pg: 'Page 2 of 3', prevOff: false, nextOff: false });
    s.pager!.next();
    expect(K.setPage).toHaveBeenCalledWith(100, 50);
    expect(m.filters!.main.map((f) => f.label)).toEqual(['Actor', 'Operation area', 'Time', 'Result', 'Subject']);
    expect(m.filters!.count).toBe('2 of 120 KAP events · 1 console events');
    // the opened row carries its details
    const m2 = auditScreen(c, true, {}, vi.fn(), { ...K, openId: 'e1' });
    expect(m2.sections[0].openKey).toBe('kap:e1');
    expect(m2.sections[0].rows!.find((r) => r.key === 'kap:e1')!.kv!.some((x) => x.k === 'Event' && x.v === 'agent.created')).toBe(true);
    // a Failure filter keeps session events out (they succeeded)
    expect(auditScreen(c, true, { res: 'Failure' }, vi.fn(), K).sections[0].rows!.every((r) => r.key.startsWith('kap:'))).toBe(true);
    // other tenants keep the seed events and no pager
    expect(auditScreen(ctx({ T: 'sceai' }).c, true, {}, vi.fn()).sections[0].pager).toBeUndefined();
  });
});

describe('KAP configuration versions', () => {
  it('maps versions to history rows, newest first, with restored-from', () => {
    const rows = configRows([ver({ id: 'v-1', version: 1, is_current: false, source: 'yaml_import', author_display: null, author_id: null }), ver({ id: 'v-3', version: 3, restored_from_version_id: 'v-1', source: 'admin_rollback' })]);
    expect(rows.map((r) => [r.v, r.source, r.by, r.from, r.current])).toEqual([
      ['v3', 'Rollback (admin)', 'sbx_admin', 'v1', true],
      ['v1', 'YAML import', 'System', '—', false],
    ]);
    expect(rows[0].kv).toContainEqual(['Structure hash', 'abc123', true]);
  });

  it('describes a rollback plan', () => {
    const p = plan();
    const items = planItems(p);
    expect(items).toContainEqual({ a: 'Agents', b: '2 updated', c: 'exp_router, helper' });
    expect(items).toContainEqual({ a: 'Agents', b: '1 deactivated', c: 'vision_experiment' });
    expect(items).toContainEqual({ a: 'MCP servers', b: '1 created', c: 'wb' });
    expect(items).toContainEqual({ a: 'Collections', b: '1 reset (reindexed)', c: 'sbx_docs' });
    expect(items).toContainEqual({ a: 'Schedules', b: 'Rebuilt' });
    expect(items).toContainEqual({ a: 'Execution · agent', b: 'exp_router', c: 'priority 1 → 3' });
    expect(planBody(p)).toContain('as v4 (current: v3)');
    expect(planBody(plan({ changed: false }))).toContain('writes no new version');
    expect(rollbackBody(p)).toEqual({ expected_current_version: 3 });
  });

  it('reports the rollback result', () => {
    const out: KapRollbackOut = { tenant_id: 't', selected_version_id: 'v-1', previous_version: 3, changed: true, resulting_version: ver({ version: 4 }), post_commit_pending: true };
    expect(rollbackMsg(out)).toContain('restored as v4');
    expect(rollbackMsg(out)).toContain('still pending');
    expect(rollbackMsg({ ...out, changed: false })).toContain('No change');
  });

  it('Configuration History tab shows KAP versions with preview and roll back', () => {
    const { c } = ctx();
    const K: KapConfigView = { versions: [ver(), ver({ id: 'v-1', version: 1, is_current: false })], preview: vi.fn(), rollback: vi.fn() };
    const m = tenantConfigScreen(c, 'history', vi.fn(), K);
    const rows = m.sections[0].rows!;
    expect(m.sections[0].cols).toEqual(['Version', 'Source', 'Changed by', 'When', 'Restored from', 'Status']);
    expect(rows.map((r) => r.cells[5].p?.[1])).toEqual(['Current', 'Superseded']);
    expect(rows[0].acts).toEqual([]);
    expect(rows[1].acts!.map((a) => a.l)).toEqual(['Preview rollback', 'Roll back…']);
    rows[1].acts![1].f();
    expect(K.rollback).toHaveBeenCalledWith(K.versions[1]);
    rows[1].quick![0].f();
    expect(K.preview).toHaveBeenCalledWith(K.versions[1]);
    // without tenant:configure: no actions
    expect(tenantConfigScreen(ctx({ canT: false }).c, 'history', vi.fn(), K).sections[0].rows![1].acts).toEqual([]);
    // other tabs keep the session settings
    expect(tenantConfigScreen(c, 'general', vi.fn(), K).sections[0].form).toBe(true);
  });
});

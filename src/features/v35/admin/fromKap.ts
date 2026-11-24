/**
 * KAP → tenant administration (live tenant). Pure mapping of KAP audit events
 * (`AuditEventSummary`, `AuditEventDetails`) onto the Unified Audit Log rows,
 * of the audit filters onto KAP query parameters, and of KAP configuration
 * versions (`ConfigVersionOut`, `ConfigVersionPlanOut`, `ConfigRollbackOut`)
 * onto the Configuration History tab.
 *
 * What KAP has and what it doesn't (API v1.1):
 * - Audit events are typed (`event_type`), carry a result, a subject (type and
 *   id, no name), an object (type and id, no name) and request facts. The
 *   details add `recorded_at` and safe additional `data`.
 * - Configuration versions are metadata only (version, source, author, time,
 *   restored-from, current flag, structure hash): no per-setting diff. A
 *   rollback restores the whole version; the preview lists what would change.
 * - KAP has no API for the console's General, Language, Resources and Data
 *   Lifecycle settings; those tabs stay session-only for the live tenant.
 */
import type { AuditRow } from './build';

// ---------------------------------------------------------------- KAP shapes (openai.json)

export type KapAuditResult = 'success' | 'failure';
export type KapSubjectType = 'user' | 'service_account' | 'system' | 'anonymous';

export interface KapAuditSummary {
  id: string;
  occurred_at: string;
  event_type: string;
  result: KapAuditResult;
  subject_type: KapSubjectType;
  subject_id: string | null;
  tenant_id: string | null;
  object_type: string | null;
  object_id: string | null;
  source_ip: string | null;
  request_id: string | null;
  reason_code: string | null;
  provider_key: string | null;
  client_id: string | null;
}
export interface KapAuditDetails extends KapAuditSummary {
  recorded_at: string;
  data: Record<string, unknown>;
}

export type KapConfigSource = 'yaml_import' | 'cli_rollback' | 'rest_api' | 'api_update' | 'admin_rollback' | 'api_rollback' | 'db_import';
export interface KapConfigVersion {
  id: string;
  tenant_id: string;
  version: number;
  created_at: string;
  author_id: string | null;
  author_display: string | null;
  source: KapConfigSource;
  restored_from_version_id: string | null;
  is_current: boolean;
  structure_hash: string;
}
export interface KapPlanSection {
  counts: { created: number; updated: number; reactivated: number; deactivated: number };
  created: string[];
  updated: string[];
  reactivated: string[];
  deactivated: string[];
}
export interface KapExecParamChange {
  resource_type: string;
  resource_id: string | null;
  name: string;
  task_priority_before: number | null;
  task_priority_after: number | null;
  max_in_flight_tasks_before: number | null;
  max_in_flight_tasks_after: number | null;
}
export interface KapConfigPlan {
  tenant_id: string;
  selected_version_id: string;
  selected_version: number;
  current_version: number;
  expected_current_version: number;
  changed: boolean;
  resulting_version: number;
  sections: Record<string, KapPlanSection>;
  collection_resets: string[];
  changed_connectors: string[];
  rebuild_schedules: boolean;
  execution_parameter_changes: KapExecParamChange[];
  quota_exceeded: string[];
}
export interface KapRollbackOut {
  tenant_id: string;
  selected_version_id: string;
  previous_version: number;
  changed: boolean;
  resulting_version: KapConfigVersion;
  post_commit_pending: boolean;
}

// ---------------------------------------------------------------- formatting

/** '2026-11-20T14:03:11Z' → '2026-11-20 14:03 UTC' ('—' when missing). */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Short form of an id KAP gives without a name (first 8 characters). */
export const shortId = (id: string | null | undefined) => (id ? (id.length > 12 ? `${id.slice(0, 8)}…` : id) : '');

// ---------------------------------------------------------------- audit events

/** Console area of a KAP event type, by its first segment. Areas match the hub names the console records. */
const AREA: Record<string, string> = {
  configuration: 'Tenant Configuration',
  tenant: 'Tenant Configuration',
  tenant_queue_policy: 'Tenant Configuration',
  user: 'Identity & Access',
  rbac: 'Identity & Access',
  auth: 'Identity & Access',
  oauth_client: 'Identity & Access',
  m2m: 'Identity & Access',
  model_provider: 'Model Providers Registry',
  agent: 'Agent Factory',
  agent_job: 'Agent Factory',
  agent_schema: 'Agent Factory',
  mcp_server: 'AI Agent Tools',
  connector: 'Data Ingestion Hub',
  pipeline: 'Data Ingestion Hub',
  file: 'Data Ingestion Hub',
  collection: 'Business Data Hub',
  entity_type: 'Business Data Hub',
  indicator_observation: 'Business Data Hub',
  secret: 'Secrets & Keys',
};

/** Every `AuditEventType` of KAP API v1.1. */
export const KAP_EVENT_TYPES = [
  'configuration.rollback', 'user.created', 'user.updated', 'user.activated', 'user.deactivated', 'user.password_changed',
  'rbac.role.created', 'rbac.role.updated', 'rbac.role.deleted', 'rbac.role.permissions_replaced', 'rbac.group.created', 'rbac.group.updated', 'rbac.group.deleted',
  'rbac.group.member_added', 'rbac.group.member_removed', 'rbac.group.access_granted', 'rbac.group.access_revoked', 'auth.login',
  'model_provider.created', 'model_provider.updated', 'model_provider.deleted', 'model_provider.check', 'model_provider.rate_limit_incident',
  'agent.created', 'agent.updated', 'agent.deleted', 'agent_job.dispatched', 'agent_job.cancellation_requested', 'agent_job.finished', 'agent_job.delivery_failed',
  'agent_schema.created', 'agent_schema.updated', 'agent_schema.deleted', 'connector.created', 'connector.updated', 'connector.activated', 'connector.deactivated',
  'entity_type.created', 'entity_type.updated', 'entity_type.deleted', 'mcp_server.created', 'mcp_server.updated', 'mcp_server.activated', 'mcp_server.deactivated',
  'pipeline.created', 'pipeline.updated', 'pipeline.run_requested', 'pipeline.job_cancel_requested', 'pipeline.activated', 'pipeline.deleted',
  'collection.created', 'collection.updated', 'collection.activated', 'collection.deactivated', 'file.deleted', 'file.reprocess_requested',
  'tenant.created', 'tenant.updated', 'tenant_queue_policy.created', 'tenant_queue_policy.updated', 'oauth_client.created', 'oauth_client.updated', 'oauth_client.revoked',
  'm2m.token.issued', 'm2m.token.revoked', 'secret.written', 'secret.migrated', 'indicator_observation.updated',
] as const;

export const areaOfType = (t: string) => AREA[t.split('.')[0]] ?? 'KAP';

/** KAP event types of a console area (for `event_type__in`). */
export const typesOfArea = (area: string): string[] => KAP_EVENT_TYPES.filter((t) => areaOfType(t) === area);

/** Areas KAP events can have, in a stable order. */
export const KAP_AREAS: string[] = [...new Set(KAP_EVENT_TYPES.map(areaOfType))];

const WORD: Record<string, string> = { rbac: 'RBAC', m2m: 'M2M', oauth: 'OAuth', mcp: 'MCP', auth: 'Sign-in' };

/** 'rbac.group.member_added' → 'RBAC group member added'. */
export function actionOfType(t: string): string {
  if (t === 'auth.login') return 'Signed in';
  const words = t.split(/[._]/).filter(Boolean).map((w) => WORD[w] ?? w);
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const SUBJECT_L: Record<KapSubjectType, string> = { user: 'User', service_account: 'Service account', system: 'System', anonymous: 'Anonymous' };
export const subjectTypeOf = (l: string): KapSubjectType | undefined => (Object.keys(SUBJECT_L) as KapSubjectType[]).find((k) => SUBJECT_L[k] === l);

/** Actor label: KAP gives the subject's type and id, not its name. */
export function whoOf(e: Pick<KapAuditSummary, 'subject_type' | 'subject_id' | 'client_id'>): string {
  const t = SUBJECT_L[e.subject_type] ?? e.subject_type;
  if (e.subject_id) return `${t} ${shortId(e.subject_id)}`;
  if (e.client_id) return `${t} · client ${e.client_id}`;
  return t;
}

export function resOf(e: Pick<KapAuditSummary, 'object_type' | 'object_id' | 'provider_key'>): string {
  const o = [e.object_type, e.object_id].filter(Boolean).join(' · ');
  return o || (e.provider_key ? `provider ${e.provider_key}` : '—');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'Today · 14:03' for today (local time), else '2026-11-20 14:03'. */
export function whenOf(iso: string, now: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const n = new Date(now);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === n.toDateString()) return `Today · ${hm}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

/** A KAP audit event as a Unified Audit Log row. */
export function auditRowOf(e: KapAuditSummary, tenant: string, now: number): AuditRow {
  const ts = Date.parse(e.occurred_at);
  return {
    when: whenOf(e.occurred_at, now),
    age: Number.isNaN(ts) ? 0 : Math.max(0, (now - ts) / 86_400_000),
    ts: Number.isNaN(ts) ? 0 : ts,
    who: whoOf(e),
    tk: [tenant],
    ten: tenant,
    area: areaOfType(e.event_type),
    action: actionOfType(e.event_type),
    res: resOf(e),
    kap: { id: e.id, type: e.event_type, failed: e.result === 'failure' },
  };
}

/** Details panel of a KAP event: the summary fields, then the details once loaded. */
export function auditKv(e: KapAuditSummary, d: KapAuditDetails | { err: string } | undefined): [string, string, boolean?][] {
  const base: [string, string, boolean?][] = [
    ['Source', 'KAP audit log'],
    ['Event', e.event_type, true],
    ['Result', e.result === 'failure' ? `Failure${e.reason_code ? ` · ${e.reason_code}` : ''}` : 'Success'],
    ['Occurred', fmtTime(e.occurred_at)],
    ['Subject', [SUBJECT_L[e.subject_type] ?? e.subject_type, e.subject_id].filter(Boolean).join(' · '), true],
    ['Object type', e.object_type ?? '—'],
    ['Object id', e.object_id ?? '—', true],
    ['Client', e.client_id ?? '—', true],
    ['Provider key', e.provider_key ?? '—', true],
    ['Source IP', e.source_ip ?? '—', true],
    ['Request id', e.request_id ?? '—', true],
    ['Event id', e.id, true],
  ];
  if (!d) return [...base, ['Details', 'Loading details from KAP…']];
  if ('err' in d) return [...base, ['Details', `Could not load details from KAP: ${d.err}`]];
  const data = Object.entries(d.data ?? {}).map(([k, v]): [string, string, boolean] => [`data.${k}`, valueText(v), true]);
  return [...base, ['Recorded', fmtTime(d.recorded_at)], ...(data.length ? data : [['Additional data', 'None'] as [string, string]])];
}

function valueText(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v || '—';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}

/** Audit filters of the live tenant that KAP applies itself. */
export interface KapAuditFilters {
  /** console area → `event_type__in` */
  area?: string;
  /** 'Today' / 'Last 7 days' / 'Last 30 days' → `occurred_at__ge` */
  time?: string;
  /** 'Success' / 'Failure' → `result` */
  res?: string;
  /** subject type label → `subject_type` */
  subj?: string;
}

const DAYS: Record<string, number> = { 'Last 7 days': 7, 'Last 30 days': 30 };

/** KAP query for the audit list (filters + page). Filters KAP can't apply (actor, free text) stay client-side. */
export function auditQuery(F: KapAuditFilters, page: { limit: number; offset: number }, now: number): Record<string, string | number | string[]> {
  const q: Record<string, string | number | string[]> = { limit: page.limit, offset: page.offset };
  const set = (x?: string) => !!x && x !== 'Any' && x !== 'Any time';
  if (set(F.area)) {
    const types = typesOfArea(F.area!);
    // an area no KAP event belongs to (e.g. a console-only hub): ask for nothing rather than everything
    q.event_type__in = types.length ? types : ['__none__'];
  }
  if (set(F.time)) {
    const start = F.time === 'Today' ? new Date(new Date(now).setHours(0, 0, 0, 0)) : new Date(now - (DAYS[F.time!] ?? 0) * 86_400_000);
    q.occurred_at__ge = start.toISOString();
  }
  if (F.res === 'Success' || F.res === 'Failure') q.result = F.res.toLowerCase();
  const st = F.subj ? subjectTypeOf(F.subj) : undefined;
  if (st) q.subject_type = st;
  return q;
}

// ---------------------------------------------------------------- configuration versions

export const SOURCE_L: Record<KapConfigSource, string> = {
  yaml_import: 'YAML import',
  cli_rollback: 'Rollback (CLI)',
  rest_api: 'REST API',
  api_update: 'API change',
  admin_rollback: 'Rollback (admin)',
  api_rollback: 'Rollback (API)',
  db_import: 'Database import',
};

export interface ConfigVersionRow {
  id: string;
  v: string;
  source: string;
  by: string;
  at: string;
  from: string;
  current: boolean;
  kv: [string, string, boolean?][];
}

/** KAP configuration versions → Configuration History rows (newest first). */
export function configRows(vs: KapConfigVersion[]): ConfigVersionRow[] {
  const num = new Map(vs.map((x) => [x.id, x.version]));
  return vs
    .slice()
    .sort((a, b) => b.version - a.version)
    .map((x) => {
      const from = x.restored_from_version_id ? (num.has(x.restored_from_version_id) ? `v${num.get(x.restored_from_version_id)}` : shortId(x.restored_from_version_id)) : '—';
      const by = x.author_display || (x.author_id ? `User ${shortId(x.author_id)}` : 'System');
      return {
        id: x.id,
        v: `v${x.version}`,
        source: SOURCE_L[x.source] ?? x.source,
        by,
        at: fmtTime(x.created_at),
        from,
        current: x.is_current,
        kv: [
          ['Version', `v${x.version}${x.is_current ? ' · current' : ''}`],
          ['Source', SOURCE_L[x.source] ?? x.source],
          ['Author', [x.author_display, x.author_id].filter(Boolean).join(' · ') || 'System', true],
          ['Created', fmtTime(x.created_at)],
          ['Restored from', from],
          ['Structure hash', x.structure_hash, true],
          ['Version id', x.id, true],
          ['Contents', 'KAP returns version metadata only: the stored snapshot is not shown. Preview a rollback to see what it would change.'],
        ],
      };
    });
}

/** 'mcp_servers' → 'Mcp servers' → 'MCP servers'. */
const sectionLabel = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ').replace(/^Mcp\b/, 'MCP');

/** A rollback plan as dialog lines: [what, change, names]. */
export function planItems(p: KapConfigPlan): { a: string; b?: string; c?: string }[] {
  const out: { a: string; b?: string; c?: string }[] = [];
  const names = (xs: string[]) => (xs.length > 6 ? `${xs.slice(0, 6).join(', ')} and ${xs.length - 6} more` : xs.join(', '));
  for (const [k, s] of Object.entries(p.sections ?? {})) {
    for (const op of ['created', 'updated', 'reactivated', 'deactivated'] as const) {
      const n = s.counts?.[op] ?? s[op]?.length ?? 0;
      if (n) out.push({ a: sectionLabel(k), b: `${n} ${op}`, c: names(s[op] ?? []) });
    }
  }
  if (p.collection_resets?.length) out.push({ a: 'Collections', b: `${p.collection_resets.length} reset (reindexed)`, c: names(p.collection_resets) });
  if (p.changed_connectors?.length) out.push({ a: 'Connector schedules', b: `${p.changed_connectors.length} changed`, c: names(p.changed_connectors) });
  if (p.rebuild_schedules) out.push({ a: 'Schedules', b: 'Rebuilt' });
  for (const x of p.execution_parameter_changes ?? []) {
    const parts = [
      x.task_priority_before !== x.task_priority_after ? `priority ${x.task_priority_before ?? '—'} → ${x.task_priority_after ?? '—'}` : '',
      x.max_in_flight_tasks_before !== x.max_in_flight_tasks_after ? `max in flight ${x.max_in_flight_tasks_before ?? '—'} → ${x.max_in_flight_tasks_after ?? '—'}` : '',
    ].filter(Boolean);
    out.push({ a: `Execution · ${x.resource_type}`, b: x.name, c: parts.join(', ') || 'changed' });
  }
  if (p.quota_exceeded?.length) out.push({ a: 'Quota exceeded', b: 'Blocks the rollback', c: p.quota_exceeded.join(', ') });
  return out;
}

/** One-line summary of a rollback plan. */
export function planBody(p: KapConfigPlan): string {
  if (!p.changed) return `v${p.selected_version} matches the current configuration (v${p.current_version}). Rolling back writes no new version.`;
  return `Restores the whole configuration of v${p.selected_version} as v${p.resulting_version} (current: v${p.current_version}). Nothing is written by this preview.${p.quota_exceeded?.length ? ' A tenant quota would be exceeded: KAP will refuse the rollback.' : ''}`;
}

export const rollbackBody = (p: KapConfigPlan) => ({ expected_current_version: p.expected_current_version });

/** Toast after a rollback. */
export function rollbackMsg(r: KapRollbackOut): string {
  if (!r.changed) return `No change: the selected version matches v${r.previous_version}.`;
  return `Configuration restored as v${r.resulting_version.version}.${r.post_commit_pending ? ' Follow-up work (reindexing, schedules) is still pending in KAP and will be retried.' : ''}`;
}

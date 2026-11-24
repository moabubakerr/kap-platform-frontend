/**
 * Platform & tenant administration data (v35): platform configuration
 * (`pcfgInit`), per-tenant configuration (`tcfgInit`), monitoring alerts, rules
 * and routes (`opsData`), telemetry snapshot (`telemetry`), platform service
 * credentials (`secretsInit`), languages (`langList`) and the seed events of the
 * Unified Audit Log. Session store: actions change it like the prototype's
 * `setP` / `setT` / `setM` / `rotUpd`.
 */
import { createStore } from '@/engine/store';
import type { DsStatus } from '@/engine/types';

export type AdminTenant = 'sceai' | 'econ' | 'sandbox';
export const ADMIN_TENANTS: AdminTenant[] = ['sceai', 'econ', 'sandbox'];
export const isAdminTenant = (t: string | null | undefined): t is AdminTenant => !!t && (ADMIN_TENANTS as string[]).includes(t);
/** Tenant display names (prototype `TN`). */
export const TN: Record<string, string> = { sceai: 'SCEAI', econ: 'Economic Affairs', sandbox: 'sandbox' };

export const LANGS: [string, string][] = [['en', 'English'], ['ar', 'Arabic'], ['fr', 'French'], ['ru', 'Russian'], ['es', 'Spanish'], ['de', 'German'], ['tr', 'Turkish'], ['fa', 'Persian'], ['ur', 'Urdu'], ['he', 'Hebrew'], ['zh', 'Chinese (Simplified)'], ['hi', 'Hindi']];
/** code → name */
export const LN: Record<string, string> = Object.fromEntries(LANGS);
/** name → code */
export const LC: Record<string, string> = Object.fromEntries(LANGS.map(([k, n]) => [n, k]));
export const langNames = (codes: string[]) => codes.map((c) => LN[c]).join(', ');

export type Meta = [string, string];

export interface HistEntry { v: number; area: string; key: string; old: string; nw: string; by: string; at: string }

export interface PlatformKey {
  id: string;
  p: string;
  /** vault backend id, or 'hsm' */
  v: string;
  deps: string[];
  health: string;
  chk: string;
  rot: string;
  age: number;
  every: number;
  mode: 'hsm' | 'transit' | 'overlap';
  how: string;
}

export interface Vault { id: string; n: string; ty: string; ep: string; auth: string; ns: string; caps: string[]; st: string; chk: string; by: string; err?: string }
export interface VaultMap { v: string; mode: 'Shared' | 'Dedicated' }

export interface License {
  tier: string;
  id: string;
  until: string;
  daysLeft: number;
  tenants: number;
  admins: number;
  runs: number;
  runsUsed: number;
  gpu: number;
  gpuUsed: number;
  modules: string[];
  connectors: string[];
  code?: string;
}

/** [queue, deployed workers, max in flight, priority levels] */
export type Queue = [string, number, number, string];
/** [tenant, queue, fair share, max in flight, priority ceiling, bulk window] */
export type Alloc = [AdminTenant, string, string, string, string, string];

export interface Pcfg {
  general: { name: string; timeout: string; langs: string[]; defLang: string };
  gmeta: Record<'name' | 'timeout' | 'langs' | 'defLang', Meta>;
  info: { hosting: string; release: string; released: string; maint: string; maintNote: string };
  security: { cls: string; pii: string; egress: string; guard: string[] };
  smeta: Record<'cls' | 'pii' | 'egress' | 'guard', Meta>;
  queues: Queue[];
  alloc: Alloc[];
  sched: Record<string, string>;
  run: { tools: string; dur: string };
  hist: HistEntry[];
  keys: PlatformKey[];
  credPolicy: { life: string; meta: Meta };
  vaults: Vault[];
  vmap: Record<string, VaultMap>;
  license: License;
}

export interface TenantCred { n: string; pur: string; exp: string; use: string; path: string; rot: string; age: number; every: number; st: string; chk: string; mode: 'replace' | 'generate' }

export interface Tcfg {
  general: { display: string; contact: string; tz: string; callback: string; conn: string[] };
  idp: string;
  lang: { langs: string[]; def: string; answer: string };
  lim: { agentConc: string; pipeConc: string; rpm: string; tools: string; dur: string; prio: string; oxford: string };
  sched: { reports: string };
  usage: Record<string, string>;
  /** [data, retention, then, last run] */
  life: [string, string, string, string][];
  /** [request, scope, status, completed] */
  erasure: [string, string, string, string][];
  hist: HistEntry[];
  creds: TenantCred[];
}

export interface AlertLog { at: string; who: string; what: string }
export interface Alert {
  id: string;
  sev: 'Critical' | 'Warning' | 'Info';
  comp: string;
  issue: string;
  st: 'Open' | 'Acknowledged' | 'Investigating' | 'Recovered' | 'Closed';
  first: string;
  last: string;
  n: number;
  owner: string;
  rule: string;
  ev: string;
  ack?: string;
  rec?: string;
  closed?: string;
  log?: AlertLog[];
}
export interface AlertRule { id: string; n: string; metric: string; op: string; thr: string; unit: string; dur: string; sev: string; route: string; on: boolean; fired: string; mg?: 'KAP' | 'Grafana' }
export interface Route { n: string; ch: string; dest: string; sev: string[] }

export type RotStage = 'Requested' | 'Completed' | 'Verified' | 'Verification failed';
export interface RotState {
  stage?: RotStage;
  by?: string;
  req?: string;
  done?: string;
  doneNote?: string;
  ver?: string;
  tries: number;
  deps: Record<string, string>;
  detail?: Record<string, string>;
}

export interface AdminData {
  pcfg: Pcfg;
  tcfg: Record<AdminTenant, Tcfg>;
  mon: { alerts: Alert[]; rules: AlertRule[]; routes: Route[] };
  /** rotation lifecycle per key / credential id (prototype `st.rot`) */
  rot: Record<string, RotState>;
}

const HOW_TRANSIT = 'Creates a new key version. Existing data keys are re-wrapped in the background; earlier versions stay available until re-wrapping completes.';

export function pcfgInit(): Pcfg {
  return {
    general: { name: 'KAP · production', timeout: '30 min', langs: ['en', 'ar', 'fr', 'ru'], defLang: 'en' },
    gmeta: { name: ['m.alkuwari', '211 d ago'], timeout: ['m.alkuwari', '142 d ago'], langs: ['m.alkuwari', '190 d ago'], defLang: ['m.alkuwari', '211 d ago'] },
    info: { hosting: 'On-premise · Kubernetes · DC1', release: '2026.11.1', released: '9 d ago', maint: 'Friday 02:00–04:00 AST', maintNote: 'Announced to tenant administrators; does not pause scheduled jobs' },
    security: { cls: 'L0 · Public', pii: 'Not allowed', egress: 'Platform allowlist plus reviewed tenant entries', guard: ['PII detection'] },
    smeta: { cls: ['m.alkuwari', '142 d ago'], pii: ['m.alkuwari', '142 d ago'], egress: ['m.alkuwari', '96 d ago'], guard: ['m.alkuwari', '3 d ago'] },
    queues: [['kap.agent', 8, 8, '1–5'], ['kap.pipeline', 2, 2, '1–3']],
    alloc: [
      ['sceai', 'kap.agent', '40%', '3', '3', 'Not restricted'],
      ['sceai', 'kap.pipeline', '30%', '2', '2', '02:00–05:00 AST'],
      ['econ', 'kap.agent', '30%', '3', '2', 'Not restricted'],
      ['econ', 'kap.pipeline', '30%', '2', '1', '01:00–04:00 AST'],
      ['sandbox', 'kap.agent', '10%', '4', '1', 'Not restricted'],
      ['sandbox', 'kap.pipeline', '10%', '2', '1', '22:00–06:00 AST'],
    ],
    sched: { dispatch: 'Interactive first, then scheduled, then bulk', 'kap.agent': '1', 'kap.pipeline': '2' },
    run: { tools: '25', dur: '300 s' },
    hist: [
      { v: 46, area: 'Security Defaults', key: 'AI input guardrails', old: 'Prompt injection, Jailbreak', nw: 'Prompt injection, Jailbreak, PII detection', by: 'm.alkuwari', at: '3 d ago' },
      { v: 45, area: 'Workloads & Scheduling', key: 'Max tool calls per run', old: '20', nw: '25', by: 'm.alkuwari', at: '61 d ago' },
      { v: 44, area: 'Workloads & Scheduling', key: 'SCEAI · kap.agent · max in flight', old: '2', nw: '3', by: 'r.haddad', at: '70 d ago' },
      { v: 43, area: 'General', key: 'Admin session timeout', old: '60 min', nw: '30 min', by: 'm.alkuwari', at: '142 d ago' },
      { v: 42, area: 'General', key: 'Supported interface languages', old: 'English, Arabic', nw: 'English, Arabic, French, Russian', by: 'm.alkuwari', at: '190 d ago' },
    ],
    keys: [
      { id: 'kap-root-kek', p: 'Root key-encryption key', v: 'hsm', deps: ['Vault seal', 'Tenant key-encryption keys'], health: 'Verified', chk: '2 min ago', rot: '211 d ago', age: 211, every: 365, mode: 'hsm', how: 'Rotated in the HSM during a key ceremony. KAP does not rotate this key.' },
      { id: 'tenant-sceai-kek', p: 'Key-encryption key · SCEAI', v: 'kap-vault', deps: ['SCEAI collections', 'SCEAI secrets', 'SCEAI traces'], health: 'Verified', chk: '2 min ago', rot: '30 d ago', age: 30, every: 180, mode: 'transit', how: HOW_TRANSIT },
      { id: 'tenant-econ-kek', p: 'Key-encryption key · Economic Affairs', v: 'kv-ea-prod', deps: ['Economic Affairs collections', 'Economic Affairs secrets'], health: 'Verified', chk: '2 min ago', rot: '30 d ago', age: 30, every: 180, mode: 'transit', how: HOW_TRANSIT },
      { id: 'tenant-sandbox-kek', p: 'Key-encryption key · sandbox', v: 'kap-vault', deps: ['sandbox collections', 'sandbox secrets'], health: 'Verified', chk: '2 min ago', rot: '31 d ago', age: 31, every: 180, mode: 'transit', how: HOW_TRANSIT },
      { id: 'audit-signing', p: 'Signs Unified Audit Log records', v: 'kap-vault', deps: ['Unified Audit Log', 'SIEM forwarder'], health: 'Verified', chk: '2 min ago', rot: '94 d ago', age: 94, every: 90, mode: 'transit', how: 'Creates a new signing version. Earlier versions are kept for verifying existing records and are never deleted while records signed with them are retained.' },
      { id: 'callback-signing', p: 'Signs outbound callbacks · HMAC-SHA256 with timestamp', v: 'kap-vault', deps: ['Callback dispatcher', 'Tenant callback receivers'], health: 'Verified', chk: '2 min ago', rot: '40 d ago', age: 40, every: 180, mode: 'overlap', how: 'Callbacks are signed with both versions during the overlap window you choose, so receivers can switch to the new version.' },
    ],
    credPolicy: { life: '90 days', meta: ['m.alkuwari', '3 d ago'] },
    vaults: [
      { id: 'kap-vault', n: 'KAP platform vault', ty: 'OpenBao', ep: 'https://vault.kap.internal:8200', auth: 'Kubernetes service account', ns: 'kap', caps: ['Secrets', 'Keys'], st: 'Connected', chk: '1 min ago', by: 'kap.ops · 210 d ago' },
      { id: 'kv-ea-prod', n: 'Economic Affairs key vault', ty: 'Azure Key Vault', ep: 'https://kv-ea-prod.vault.azure.net', auth: 'Managed identity', ns: '', caps: ['Secrets', 'Keys'], st: 'Connected', chk: '1 min ago', by: 'm.alkuwari · 40 d ago' },
    ],
    vmap: { platform: { v: 'kap-vault', mode: 'Shared' }, sceai: { v: 'kap-vault', mode: 'Shared' }, econ: { v: 'kv-ea-prod', mode: 'Dedicated' }, sandbox: { v: 'kap-vault', mode: 'Shared' } },
    license: {
      tier: 'Production · on-premise',
      id: 'KAP-PRD-2026-0142',
      until: '31 Dec 2027',
      daysLeft: 403,
      tenants: 10,
      admins: 50,
      runs: 200000,
      runsUsed: 61480,
      gpu: 4,
      gpuUsed: 4,
      modules: ['Data Ingestion Hub', 'Business Data Hub', 'AI Agent Factory', 'AI Governance', 'AI Confidence Hub', 'Speech and vision models'],
      connectors: ['S3', 'PostgreSQL', 'REST', 'SharePoint', 'SFTP'],
    },
  };
}

export function tcfgInit(): Record<AdminTenant, Tcfg> {
  return {
    sceai: {
      general: { display: 'Supreme Council for Economic Affairs and Investment', contact: 'kap.admin@sceai.gov.qa', tz: 'Asia/Qatar', callback: 'dashboards.sceai.gov.qa', conn: ['S3', 'PostgreSQL', 'REST', 'SharePoint'] },
      idp: 'Microsoft Entra ID · OIDC',
      lang: { langs: ['ar', 'en'], def: 'en', answer: 'Language of the question' },
      lim: { agentConc: '3', pipeConc: '2', rpm: '60', tools: '15', dur: '180 s', prio: '2', oxford: '2,000' },
      sched: { reports: 'Sunday 06:00–08:00 AST' },
      usage: { agentConc: '3 in flight', pipeConc: '0 in flight', rpm: '22 peak', tokens: '41.2M (69%)', storage: '3.1 GB (31%)', oxford: '412 this month', tools: 'Highest this week: 15', dur: 'Longest this week: 171 s' },
      life: [['Runs and traces', '1 year', 'Purge', '6 h ago'], ['Session working memory', 'Session close', 'Clear', 'Continuous'], ['Knowledge gap records', '180 days', 'Purge', '1 d ago'], ['Uploaded source files', '3 years', 'Archive', '2 d ago']],
      erasure: [['ER-0003', 'Data subject request · 2 records', 'Completed · certificate issued', '9 d ago']],
      hist: [
        { v: 14, area: 'General', key: 'Callback allowlist', old: '—', nw: 'dashboards.sceai.gov.qa', by: 'sceai_admin', at: '12 d ago' },
        { v: 13, area: 'Resources & Scheduling', key: 'Max tool calls per run', old: '20', nw: '15', by: 'm.alkuwari', at: '61 d ago' },
        { v: 12, area: 'Language Preferences', key: 'Enabled languages', old: 'English', nw: 'Arabic, English', by: 'sceai_admin', at: '96 d ago' },
      ],
      creds: [
        { n: 'sceai_bucket_key', pur: 'Object storage access key', exp: '—', use: 'Data source · sceai_bucket', path: 'sceai_bucket_key', rot: '18 d ago', age: 18, every: 90, st: 'Verified', chk: 'Connector sync 2 h ago', mode: 'replace' },
        { n: 'oxford_api_key', pur: 'Provider API key', exp: 'in 140 d', use: 'MCP server · oxford_economics', path: 'oxford_api_key', rot: '41 d ago', age: 41, every: 180, st: 'Verified', chk: 'MCP check 18 min ago', mode: 'replace' },
        { n: 'callback_hmac', pur: 'Callback signing secret', exp: '—', use: 'Outbound callbacks · dashboards-svc', path: 'callback_hmac', rot: '87 d ago', age: 87, every: 90, st: 'Verified', chk: 'Last callback 1 h ago', mode: 'generate' },
        { n: 'sceai_dwh_reader', pur: 'Database login', exp: '—', use: 'MCP server · sceai_dwh_mcp', path: 'sceai_dwh_reader', rot: '—', age: 0, every: 0, st: 'Not verified', chk: 'Server registered · not used by an agent yet', mode: 'replace' },
        { n: 'sceai_cms_client', pur: 'OAuth client secret', exp: 'in 210 d', use: 'Data source · sceai_cms_feed', path: 'sceai_cms_client', rot: '25 d ago', age: 25, every: 180, st: 'Verified', chk: 'Connection test 3 h ago', mode: 'replace' },
        { n: 'projects_db_reader', pur: 'Database login', exp: '—', use: 'Data source · sceai_projects_db', path: 'projects_db_reader', rot: '12 d ago', age: 12, every: 90, st: 'Verified', chk: 'Connection test 3 h ago', mode: 'replace' },
        { n: 'synapse_sp_secret', pur: 'Service principal secret', exp: 'in 64 d', use: 'Data source · sceai_dwh', path: 'synapse_sp_secret', rot: '116 d ago', age: 116, every: 180, st: 'Verified', chk: 'Connection test 1 d ago', mode: 'replace' },
      ],
    },
    econ: {
      general: { display: 'Economic Affairs directorate', contact: 'ea.admin@economy.gov.qa', tz: 'Asia/Qatar', callback: '—', conn: ['SharePoint', 'SFTP'] },
      idp: 'Microsoft Entra ID · OIDC',
      lang: { langs: ['ar', 'en'], def: 'ar', answer: 'Tenant default language' },
      lim: { agentConc: '3', pipeConc: '2', rpm: '60', tools: '20', dur: '300 s', prio: '1', oxford: '—' },
      sched: { reports: 'Not restricted' },
      usage: { agentConc: '1 in flight', pipeConc: '0 in flight', rpm: '9 peak', tokens: '12.4M (31%)', storage: '1.2 GB (12%)', oxford: '—', tools: 'Highest this week: 9', dur: 'Longest this week: 64 s' },
      life: [['Runs and traces', '1 year', 'Purge', '5 h ago'], ['Session working memory', 'Session close', 'Clear', 'Continuous']],
      erasure: [],
      hist: [{ v: 6, area: 'General', key: 'Contact address', old: 'kap.ops@kap.internal', nw: 'ea.admin@economy.gov.qa', by: 'ea_admin', at: '90 d ago' }],
      creds: [{ n: 'budget_share_secret', pur: 'SharePoint client secret', exp: 'in 116 d', use: 'Data source · budget_reports_share', path: 'budget_share_secret', rot: '64 d ago', age: 64, every: 180, st: 'Verified', chk: 'Connector sync 5 h ago', mode: 'replace' }],
    },
    sandbox: {
      general: { display: 'AI team experiments', contact: 'ai-team@kap.internal', tz: 'Asia/Qatar', callback: '—', conn: ['S3', 'REST'] },
      idp: 'Keycloak · kap-admin realm',
      lang: { langs: ['en', 'ar', 'fr', 'ru'], def: 'en', answer: 'Language of the question' },
      lim: { agentConc: '4', pipeConc: '2', rpm: '30', tools: '25', dur: '300 s', prio: '1', oxford: '—' },
      sched: { reports: 'Not restricted' },
      usage: { agentConc: '2 in flight', pipeConc: '1 in flight', rpm: '14 peak', tokens: '3.9M (39%)', storage: '0.8 GB (16%)', oxford: '—', tools: 'Highest this week: 22', dur: 'Longest this week: 290 s' },
      life: [['Runs and traces', '30 days', 'Purge', '2 h ago'], ['Session working memory', 'Session close', 'Clear', 'Continuous']],
      erasure: [],
      hist: [{ v: 3, area: 'Language Preferences', key: 'Enabled languages', old: 'English, Arabic', nw: 'English, Arabic, French, Russian', by: 'sbx_admin', at: '20 d ago' }],
      creds: [
        { n: 'sbx_bucket_key', pur: 'Object storage access key', exp: '—', use: 'Data source · sbx_bucket', path: 'sbx_bucket_key', rot: '31 d ago', age: 31, every: 90, st: 'Verified', chk: 'Connector sync 1 d ago', mode: 'replace' },
        { n: 'sbx_graph_secret', pur: 'Application client secret', exp: 'in 30 d', use: 'Data source · sbx_mailbox', path: 'sbx_graph_secret', rot: '60 d ago', age: 60, every: 90, st: 'Verified', chk: 'Connection test 1 d ago', mode: 'replace' },
      ],
    },
  };
}

/** Tenant allocation assigned by the platform (prototype `tcfgInit` · `assigned`), derived from the current platform allocations. */
export function assignedOf(P: Pcfg, t: AdminTenant) {
  const al = (q: string) => P.alloc.find((x) => x[0] === t && x[1] === q);
  return {
    agentConc: al('kap.agent')?.[3] ?? '—',
    pipeConc: al('kap.pipeline')?.[3] ?? '—',
    prio: al('kap.agent')?.[4] ?? '—',
    bulk: al('kap.pipeline')?.[5] ?? '—',
    tokens: { sceai: '60M / month', econ: '40M / month', sandbox: '10M / month' }[t],
    storage: { sceai: '10 GB', econ: '10 GB', sandbox: '5 GB' }[t],
    rpm: '60 / min',
  };
}

export function opsInit(): AdminData['mon'] {
  return {
    alerts: [
      { id: 'A-1207', sev: 'Warning', comp: 'kap.agent queue · SCEAI', issue: 'SCEAI at its kap.agent concurrency limit; 1 job waiting', st: 'Open', first: '22 min ago', last: '4 min ago', n: 3, owner: 'Platform operations', rule: 'r1', ev: 'Data Bus metrics 15 s ago: 3 of 3 in flight, oldest waiting 41 s' },
      { id: 'A-1206', sev: 'Critical', comp: 'SIEM forwarder', issue: 'No heartbeat for 47 min; audit events are queued locally', st: 'Open', first: '47 min ago', last: '1 min ago', n: 9, owner: 'Security operations', rule: 'r6', ev: 'Audit service reports 1,284 events queued for forwarding' },
      { id: 'A-1203', sev: 'Warning', comp: 'MCP server oxford_economics · SCEAI', issue: 'Returned 502 twice in 24 h', st: 'Open', first: '1 d ago', last: '18 min ago', n: 2, owner: 'SCEAI tenant administrators', rule: 'r2', ev: 'MCP proxy logs: 2 × HTTP 502 from services.oxfordeconomics.com' },
      { id: 'A-1201', sev: 'Warning', comp: 'kap.pipeline · sandbox', issue: 'Re-index running 41 min; expected about 15 min', st: 'Acknowledged', ack: 'r.haddad · 52 min ago', first: '1 h ago', last: '2 min ago', n: 1, owner: 'Platform operations', rule: 'r5', ev: 'Pipeline job metrics: run 112 at 41 min, progress 63%', log: [{ at: '52 min ago', who: 'r.haddad', what: 'Acknowledged alert' }] },
      { id: 'A-1198', sev: 'Info', comp: 'Model serving · gpu-03', issue: 'Node unavailable; capacity reduced', st: 'Recovered', rec: 'Monitoring confirmed recovery 3 h ago: gpu-03 passed health checks for 10 min', first: '5 h ago', last: '3 h ago', n: 1, owner: 'Platform operations', rule: 'r7', ev: 'Node exporter: gpu-03 down 5 h ago, up 3 h ago', log: [{ at: '3 h ago', who: 'Monitoring', what: 'Condition cleared; alert recovered' }] },
    ],
    rules: [
      { id: 'r1', n: 'Queue wait at tenant limit', metric: 'Queue wait time', op: '>', thr: '10', unit: 'min', dur: '5 min', sev: 'Warning', route: 'Platform operations', on: true, fired: '4 min ago' },
      { id: 'r2', n: 'MCP server errors', metric: 'MCP error rate', op: '>', thr: '5', unit: '%', dur: '15 min', sev: 'Warning', route: 'Tenant administrators', on: true, fired: '18 min ago' },
      { id: 'r3', n: 'Model endpoint near token limit', metric: 'Tokens per minute vs endpoint limit', op: '>', thr: '90', unit: '%', dur: '10 min', sev: 'Warning', route: 'Platform operations', on: true, fired: '3 d ago' },
      { id: 'r4', n: 'License expiry', metric: 'Days until license expiry', op: '<', thr: '60', unit: 'days', dur: 'Immediately', sev: 'Info', route: 'Platform administrators', on: true, fired: 'Never' },
      { id: 'r5', n: 'Processing job failures', metric: 'Job failure rate', op: '>', thr: '5', unit: '%', dur: '1 h', sev: 'Critical', route: 'On-call', on: true, fired: '2 d ago' },
      { id: 'r6', n: 'Audit forwarding stopped', metric: 'SIEM forwarding lag', op: '>', thr: '10', unit: 'min', dur: '5 min', sev: 'Critical', route: 'Security operations', on: true, fired: '47 min ago' },
      { id: 'r7', n: 'GPU node unavailable', metric: 'GPU nodes passing health checks', op: '<', thr: '4', unit: 'nodes', dur: '2 min', sev: 'Warning', route: 'Platform operations', on: true, fired: '5 h ago', mg: 'Grafana' },
    ],
    routes: [
      { n: 'Platform operations', ch: 'ITSM ticket', dest: 'itsm.kap.internal · queue KAP-OPS', sev: ['Critical', 'Warning'] },
      { n: 'On-call', ch: 'ITSM page', dest: 'itsm.kap.internal · on-call rota', sev: ['Critical'] },
      { n: 'Security operations', ch: 'SIEM and e-mail', dest: 'soc@kap.internal', sev: ['Critical', 'Warning'] },
      { n: 'Platform administrators', ch: 'E-mail', dest: 'kap-admins@kap.internal', sev: ['Warning', 'Info'] },
      { n: 'Tenant administrators', ch: 'E-mail', dest: 'Contact address of the affected tenant', sev: ['Warning'] },
    ],
  };
}

export function adminInit(): AdminData {
  return { pcfg: pcfgInit(), tcfg: tcfgInit(), mon: opsInit(), rot: {} };
}

export const adminStore = createStore<AdminData>(adminInit);

// ------------------------------------------------------------------ platform service credentials (secretsInit) and their consumers
/** [vault path, kind, connection type] */
export const SECRETS: [string, string, string][] = [
  ['secret/platform/kap/vllm_client_cert', 'Client certificate', 'vllm'],
  ['secret/platform/kap/vllm_bearer_token', 'Bearer token', 'vllm'],
  ['secret/platform/kap/azure_openai_prod_key', 'API key', 'azure'],
  ['secret/platform/kap/azure_openai_uaen_key', 'API key', 'azure'],
  ['secret/platform/kap/partner_llm_key', 'API key', 'oai'],
  ['secret/platform/kap/openai_compat_token', 'Bearer token', 'oai'],
  ['secret/platform/kap/speech_gw_token', 'Bearer token', 'rest'],
  ['secret/platform/kap/biometrics_api_key', 'API key', 'rest'],
  ['secret/platform/kap/grpc_client_cert', 'Client certificate', 'grpc'],
];

/** Model provider connections that use a platform secret (snapshot of the prototype's `regInit().conns`). */
export interface RegConn { id: string; n: string; ep: string; secret: string; health: string; lastOk: string; errors: string }
export const REG_CONNS: RegConn[] = [
  { id: 'c1', n: 'Internal vLLM Cluster', ep: 'https://vllm.kap.internal/v1', secret: 'secret/platform/kap/vllm_client_cert', health: 'Healthy', lastOk: '1 min ago', errors: '0 in 24 h' },
  { id: 'c2', n: 'Azure OpenAI — UAE North', ep: 'https://kap-uaen.openai.azure.com', secret: '', health: 'Healthy', lastOk: '4 min ago', errors: '0 in 24 h' },
  { id: 'c3', n: 'Partner LLM API', ep: 'https://api.partner-llm.example/v1', secret: 'secret/platform/kap/partner_llm_key', health: 'Failing', lastOk: '6 d ago', errors: '14 TLS timeouts in 24 h' },
  { id: 'c4', n: 'KAP Speech Gateway', ep: 'https://speech-gw.kap.internal/v1', secret: 'secret/platform/kap/speech_gw_token', health: 'Healthy', lastOk: '3 min ago', errors: '0 in 24 h' },
];
/** Model deployments per connection (`regInit().deps`): [id, connection, status, health, lastOk]. */
export const REG_DEPS: [string, string, string, string, string][] = [
  ['qwen72b-prod', 'c1', 'Active', 'Healthy', '1 min ago'],
  ['qwen32b-prod', 'c1', 'Active', 'Healthy', '1 min ago'],
  ['qwen14b-shared', 'c1', 'Active', 'Healthy', '1 min ago'],
  ['qwen7b-router', 'c1', 'Active', 'Healthy', '1 min ago'],
  ['embed-prod', 'c1', 'Active', 'Healthy', '1 min ago'],
  ['bge-m3-match', 'c1', 'Active', 'Healthy', '1 min ago'],
  ['gpt4o-sandbox', 'c2', 'Active', 'Healthy', '4 min ago'],
  ['partner-llama70b', 'c3', 'Disabled', 'Failing', '6 d ago'],
  ['asr-whisper', 'c4', 'Active', 'Healthy', '3 min ago'],
];
/** MCP servers that are enabled and not suspended (`mcpInit().servers`): [name, health]. */
const MCP_ON: [string, string][] = [['doc_converter', 'Healthy'], ['oxford_economics', 'Degraded'], ['sceai_indicator_tools', 'Healthy'], ['sceai_dwh_mcp', 'Healthy']];

// ------------------------------------------------------------------ telemetry (stale or missing telemetry is never shown as healthy)
/** minutes since a relative time ("4 min ago"), or null when unknown */
export function ageMin(s: string | null | undefined): number | null {
  let m: RegExpExecArray | null;
  if (!s || s === '—') return null;
  if (s === 'just now') return 0;
  if ((m = /^(\d+) s ago$/.exec(s))) return +m[1] / 60;
  if ((m = /^(\d+) min ago$/.exec(s))) return +m[1];
  if ((m = /^(\d+) h ago$/.exec(s))) return +m[1] * 60;
  if ((m = /^(\d+) d ago$/.exec(s))) return +m[1] * 1440;
  return null;
}

export interface Service { n: string; status: string; pill: [DsStatus, string]; why: string; shown: string; src: string; last: string; link?: [string, string] }
export interface QueueTelemetry { q: string; depth: number; oldest: string; deployed: number; avail: number; health: string; active: number; failed: number; last: string; fresh: boolean }

export function telemetry(P: Pcfg) {
  const judge = (rep: string, last: string | null): [string, DsStatus, string] => {
    const a = ageMin(last);
    if (a == null) return ['Unknown', 'draft', 'No telemetry received'];
    if (a > 30) return ['Unknown', 'draft', `No telemetry for ${Math.round(a)} min`];
    if (a > 5) return ['Stale', 'hold', `Last report ${Math.round(a)} min ago`];
    return [rep, (({ Healthy: 'approved', Busy: 'hold', Degraded: 'hold', Failing: 'rejected' }) as Record<string, DsStatus>)[rep] ?? 'draft', ''];
  };
  const dOn = REG_DEPS.filter((d) => d[2] === 'Active');
  const dOk = dOn.filter((d) => d[3] === 'Healthy' && (ageMin(d[4]) ?? 99) <= 5);
  const dFail = dOn.filter((d) => d[3] === 'Failing');
  const dUnv = dOn.filter((d) => !dOk.includes(d) && !dFail.includes(d));
  const mOk = MCP_ON.filter((s) => s[1] === 'Healthy');
  const mBad = MCP_ON.filter((s) => s[1] !== 'Healthy');
  const newest = dOn.map((d) => d[4]).filter((x) => ageMin(x) != null).sort((x, y) => ageMin(x)! - ageMin(y)!)[0] ?? null;
  const Q = [
    { q: 'kap.agent', depth: 1, oldest: '41 s', deployed: P.queues[0][1], avail: 7, health: '7 healthy · 1 restarting', active: 6, failed: 0, last: '15 s ago' },
    { q: 'kap.pipeline', depth: 0, oldest: '—', deployed: P.queues[1][1], avail: 2, health: '2 healthy', active: 1, failed: 1, last: '15 s ago' },
  ];
  const vOk = P.vaults.filter((v) => v.st === 'Connected').length;
  const raw: [string, string, string, string, string | null, [string, string]?][] = [
    ['KAP API and console', 'Healthy', '3 of 3 replicas ready', 'Kubernetes readiness probes', '20 s ago'],
    ['Data Bus', Q[0].depth + Q[1].depth > 0 ? 'Busy' : 'Healthy', `${Q[0].depth + Q[1].depth} task waiting · ${Q[0].active + Q[1].active} active`, 'Data Bus metrics API', '15 s ago'],
    [
      'Model endpoints',
      dFail.length || dUnv.length ? 'Degraded' : 'Healthy',
      `${dOk.length} of ${dOn.length} enabled verified healthy${dFail.length ? ` · failing: ${dFail.map((d) => d[0]).join(', ')}` : ''}${dUnv.length ? ` · not verified: ${dUnv.map((d) => d[0]).join(', ')}` : ''}`,
      'Endpoint health checks',
      newest,
      ['Open Model Providers Registry', '/platform/models'],
    ],
    ['MCP proxy and servers', mBad.length ? 'Degraded' : 'Healthy', `${mOk.length} of ${MCP_ON.length} healthy${mBad.length ? ` · ${mBad.map((s) => `${s[0]} ${s[1].toLowerCase()}`).join(', ')}` : ''}`, 'MCP proxy checks', '1 min ago', ['Open MCP Registry', '/platform/mcp']],
    ['Ingestion and processing', 'Degraded', '1 run above expected duration (sandbox re-index, 41 min)', 'Pipeline job metrics', '1 min ago'],
    ['Identity providers', 'Healthy', 'Microsoft Entra ID and Keycloak OIDC discovery reachable', 'Synthetic sign-in probe', '2 min ago'],
    ['Secret store', vOk === P.vaults.length ? 'Healthy' : 'Degraded', `${vOk} of ${P.vaults.length} vault backends reachable`, 'Vault backend health checks', '1 min ago'],
    ['Unified Audit Log', 'Healthy', 'Records written and signed', 'Audit service metrics', '40 s ago'],
    ['SIEM forwarding', 'Healthy', 'Forwarding to SIEM', 'SIEM forwarder heartbeat', '47 min ago'],
    ['License service', 'Healthy', `Valid until ${P.license.until}`, 'License service check', '12 min ago'],
  ];
  const services: Service[] = raw.map(([n, rep, detail, src, last, link]) => {
    const [s, pill, why] = judge(rep, last);
    return { n, status: s, pill: [pill, s], why, shown: why ? `${why} · last reported: ${detail}` : detail, src, last: last || 'Never', link };
  });
  const queues: QueueTelemetry[] = Q.map((w) => ({ ...w, fresh: (ageMin(w.last) ?? 99) <= 5 }));
  const external: [string, string, string, [DsStatus, string], string][] = [
    ['Grafana', 'Dashboards, metrics and Grafana-managed alert rules', 'https://grafana.kap.internal', ['approved', 'Reachable'], 'Link checked 2 min ago'],
    ['Log platform', 'Application and access logs', 'https://logs.customer.internal', ['approved', 'Reachable'], 'Link checked 2 min ago'],
    ['SIEM', 'Security events forwarded from the Unified Audit Log', 'https://siem.customer.internal', ['draft', 'Unknown'], 'Forwarder heartbeat missing for 47 min'],
  ];
  return { services, queues, external };
}

// ------------------------------------------------------------------ Unified Audit Log seed events
export interface SeedEvent { when: string; age: number; who: string; tk: AdminTenant[]; area: string; action: string; res: string }
export const SEED_AUDIT: SeedEvent[] = (
  [
    ['3 h ago', 0.1, 'm.alkuwari', [], 'Model Providers Registry', 'Returned gpu-03 to the model pool', 'gpu-03'],
    ['5 h ago', 0.2, 'sceai_admin', ['sceai'], 'AI Agent Tools', 'Changed permitted tools', 'oxford_economics · CountryRisk disabled'],
    ['2 d ago', 2, 'r.haddad', [], 'Platform Configuration', 'Changed tenant workload allocation', 'SCEAI · kap.agent · max in flight 2 → 3'],
    ['6 d ago', 6, 'm.alkuwari', ['sceai'], 'Agents', 'Changed limits', 'sceai_indicators_agent · request_limit 15 → 20'],
    ['9 d ago', 9, 'sceai_admin', ['sceai'], 'User & Permission Management', 'Created API credential', 'dashboards-svc'],
    ['12 d ago', 12, 'sceai_admin', ['sceai'], 'Tenant Configuration', 'Changed tenant setting', 'Callback allowlist: — → dashboards.sceai.gov.qa'],
    ['20 d ago', 20, 'sbx_admin', ['sandbox'], 'Tenant Configuration', 'Changed tenant setting', 'Enabled languages: English, Arabic → English, Arabic, French, Russian'],
    ['31 d ago', 31, 'm.alkuwari', ['sandbox'], 'Tenants', 'Created tenant', 'sandbox'],
    ['61 d ago', 61, 'r.haddad', ['sceai'], 'MCP Registry', 'Registered MCP server', 'oxford_economics'],
    ['90 d ago', 90, 'ea_admin', ['econ'], 'Tenant Configuration', 'Changed tenant setting', 'Contact address'],
  ] as [string, number, string, AdminTenant[], string, string, string][]
).map(([when, age, who, tk, area, action, res]) => ({ when, age, who, tk, area, action, res }));

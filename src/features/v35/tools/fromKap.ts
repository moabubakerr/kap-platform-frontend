/**
 * KAP → AI Agent Tools store (live tenant). Pure mapping of KAP MCP servers
 * (`MCPServerOut`, `MCPServerCheckOut`) and agents' `allowed_tools` onto the
 * agent factory's MCP registry types, plus the KAP bodies for writes.
 *
 * What KAP has and what it doesn't (API v1.1):
 * - MCP servers are tenant-scoped: name, type, base_url, headers (write-only;
 *   only `is_set` comes back), timeout, tool retries, TLS settings, is_active.
 *   DELETE deactivates; creating the same name again restores the server.
 * - KAP does not list the tools a server offers. Tools are tenant
 *   configuration (not editable over REST); a check reports `missing_tools`
 *   (configured tools the server no longer offers).
 * - Agents carry `allowed_tools` (plain tool names); that is the only tool
 *   assignment KAP has. No per-tenant tool enablement, no shared (platform)
 *   servers, no classification / personal-data / side-effect / egress / rate
 *   limit fields, no emergency disable.
 */
import type { FormValues } from '@/engine/dialogs';
import type { McpRegistry, McpServer } from '@/v35/data/agentFactory';

// ---- KAP shapes (openai.json)

export type KapMcpType = 'streamable_http' | 'sse';
export interface KapMcpServer {
  id: string;
  name: string;
  type: KapMcpType;
  base_url: string;
  headers: Record<string, { is_set: boolean }>;
  timeout_seconds: number;
  tool_max_retries: number;
  verify_tls: boolean;
  tls_ca_file: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type KapCheckReason = 'connection_error' | 'tls_error' | 'timeout' | 'protocol_error' | 'secret_unavailable';
export interface KapMcpCheck {
  status: 'ok' | 'unavailable';
  checked_at: string;
  reason_code: KapCheckReason | null;
  missing_tools: string[] | null;
}
/** The part of `AgentOut` this hub uses. */
export interface KapAgentTools {
  id: string;
  name: string;
  allowed_tools: string[];
}

/** KAP facts about a server that the registry type has no field for. */
export interface KapSrvInfo {
  id: string;
  type: KapMcpType;
  active: boolean;
  verifyTls: boolean;
  caFile: string | null;
  /** header names; values are never returned */
  headers: string[];
  created: string;
  updated: string;
}

export const TYPE_L: Record<KapMcpType, string> = { streamable_http: 'Streamable HTTP', sse: 'Server-sent events (SSE)' };
export const typeOfLabel = (l: string): KapMcpType => (l === TYPE_L.sse ? 'sse' : 'streamable_http');

/** '2026-11-20T14:03:11Z' → '2026-11-20 14:03 UTC' ('—' when missing). */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

const REASON: Record<KapCheckReason, string> = {
  connection_error: 'could not connect to the server. A host on a private network must be on KAP’s OUTBOUND_PRIVATE_ALLOWLIST (SSRF guard) and reachable from KAP’s network.',
  tls_error: 'the TLS handshake failed (certificate not trusted or invalid). Check Verify TLS and the CA bundle.',
  timeout: 'the server did not answer within the timeout.',
  protocol_error: 'the server did not answer the MCP handshake. Register the endpoint of an MCP-compatible server.',
  secret_unavailable: 'a header secret could not be read from the Secret Provider.',
};

/** One-line result of `POST mcp-servers/{id}/check`. */
export function checkMessage(c: KapMcpCheck): string {
  const missing = c.missing_tools?.length ? ` · configured tools missing on the server: ${c.missing_tools.join(', ')}` : '';
  if (c.status === 'ok') return `KAP check OK at ${fmtTime(c.checked_at)}${missing}`;
  return `KAP check: unavailable at ${fmtTime(c.checked_at)} · ${c.reason_code ? REASON[c.reason_code] ?? c.reason_code : 'no reason given'}${missing}`;
}
/** Health shown for a checked server: missing tools degrade an otherwise reachable server. */
export const checkHealth = (c: KapMcpCheck) => (c.status !== 'ok' ? 'Failing' : c.missing_tools?.length ? 'Degraded' : 'Healthy');

/** KAP server → registry record. Fields KAP doesn't have are '—'; tools are not listed by KAP. */
export function toMcpServer(k: KapMcpServer, tenant: string, check?: KapMcpCheck | null): McpServer {
  const hs = Object.keys(k.headers || {});
  return {
    n: k.name,
    own: tenant,
    vendor: '',
    up: k.base_url,
    dest: '—',
    auth: hs.length ? `Headers: ${hs.map((h) => `${h}${k.headers[h]?.is_set ? '' : ' (not set)'}`).join(', ')}` : 'None',
    secret: '',
    cls: '—',
    pii: '—',
    fx: '—',
    timeout: String(k.timeout_seconds),
    rate: '—',
    retries: String(k.tool_max_retries),
    disc: '—',
    status: k.is_active ? 'Enabled' : 'Disabled',
    susp: false,
    health: check ? checkHealth(check) : 'Not checked',
    lastOk: check?.status === 'ok' ? fmtTime(check.checked_at) : '—',
    p95: '—',
    ...(check ? { note: check.status === 'ok' ? (check.missing_tools?.length ? `missing tools: ${check.missing_tools.join(', ')}` : undefined) : check.reason_code ?? undefined } : {}),
    by: `updated ${fmtTime(k.updated_at)}`,
    tools: [],
  };
}

export const toSrvInfo = (k: KapMcpServer): KapSrvInfo => ({
  id: k.id, type: k.type, active: k.is_active, verifyTls: k.verify_tls, caFile: k.tls_ca_file, headers: Object.keys(k.headers || {}), created: k.created_at, updated: k.updated_at,
});

// ---- tool assignments

/**
 * Registry key of a KAP tool name. KAP names carry no server, so a tool is
 * `kap:<name>` (built-in or configuration tool) unless a check of a server
 * reported it missing there (then `<server>:<name>`, shown as unavailable).
 */
export function grantKey(name: string, checks: Record<string, KapMcpCheck | undefined> = {}): string {
  const srv = Object.entries(checks).find(([, c]) => c?.missing_tools?.includes(name));
  return `${srv ? srv[0] : 'kap'}:${name}`;
}
/** Registry keys → KAP `allowed_tools` (plain names, order kept, no duplicates). */
export const toolNames = (keys: string[]) => [...new Set(keys.map((k) => k.split(':').pop()!.trim()).filter(Boolean))];

/**
 * Agents' tool grants keyed the way the store names agents. `storeIds` are the
 * tenant's agent ids in the store; a KAP agent matches by name or id, else its
 * name is used. Also returns store agent id → KAP agent id for PATCH.
 */
export function agentGrants(agents: KapAgentTools[], storeIds: string[], checks: Record<string, KapMcpCheck | undefined> = {}) {
  const grants: Record<string, string[]> = {};
  const ids: Record<string, string> = {};
  for (const a of agents) {
    const sid = storeIds.find((x) => x === a.name) ?? storeIds.find((x) => x === a.id) ?? a.name;
    grants[sid] = (a.allowed_tools || []).map((n) => grantKey(n, checks));
    ids[sid] = a.id;
  }
  return { grants, ids };
}

/** Every tool name KAP agents in the tenant are allowed (a known-valid catalogue), plus `hybrid_search`. */
export const knownTools = (agents: KapAgentTools[]) => [...new Set(['hybrid_search', ...agents.flatMap((a) => a.allowed_tools || [])])].sort();

/**
 * Replace tenant t's MCP slice with KAP data: its own servers, no per-tenant
 * tool enablement (KAP has none), grants from `allowed_tools`, and opt out of
 * the design's shared platform servers (KAP has no shared servers).
 */
export function applyLiveMcp(mcp: McpRegistry, t: string, servers: McpServer[], grants: Record<string, string[]>) {
  mcp.servers = mcp.servers.filter((s) => s.own !== t).concat(servers);
  mcp.tenTools[t] = Object.fromEntries(servers.map((s) => [s.n, [] as string[]]));
  mcp.grants[t] = grants;
  mcp.optOut[t] = Object.fromEntries(mcp.servers.filter((s) => s.own === 'platform').map((s) => [s.n, true]));
}

// ---- server form ↔ KAP bodies

export const HDR_KEEP = 'Keep current headers';
export const HDR_SET = 'Replace with a secret reference';
export const HDR_NONE = 'Remove all headers';
export const BACKENDS = ['vault', 'azure_key_vault'];

export const newKapServerValues = (): FormValues => ({
  n: '', type: TYPE_L.streamable_http, up: '', hdrMode: HDR_SET, hdr: 'Authorization', sbk: 'vault', sid: '', sver: '1',
  timeout: '60', retries: '3', tls: 'Yes', ca: '',
});
export const kapServerValues = (s: McpServer, i: KapSrvInfo): FormValues => ({
  n: s.n, type: TYPE_L[i.type], up: s.up, hdrMode: i.headers.length ? HDR_KEEP : HDR_SET, hdr: i.headers[0] || 'Authorization', sbk: 'vault', sid: '', sver: '1',
  timeout: s.timeout, retries: s.retries, tls: i.verifyTls ? 'Yes' : 'No', ca: i.caFile || '',
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** KAP's own rules for a server (step: 0 connection, 1 limits; default all). */
export function validateKapServer(v: FormValues, names: string[], isEdit: boolean, step = 9): string {
  const n = String(v.n || '');
  if (!/^[a-zA-Z0-9_]{4,32}$/.test(n)) return 'Name: 4–32 letters, digits or underscores.';
  if (!isEdit && names.includes(n)) return 'A server with this name already exists.';
  const up = String(v.up || '').trim();
  if (!/^https?:\/\/[^/\s]+/.test(up)) return 'Enter the MCP server URL (http:// or https://).';
  if (up.length > 512) return 'The URL is longer than 512 characters.';
  if (v.hdrMode === HDR_SET && String(v.sid || '').trim()) {
    if (!/^[A-Za-z0-9-]+$/.test(String(v.hdr || ''))) return 'Header name: letters, digits and hyphens (e.g. Authorization).';
    if (!UUID.test(String(v.sid).trim())) return 'Secret ID must be the UUID of the stored secret.';
    if (!String(v.sver || '').trim()) return 'Enter the secret version.';
  }
  if (step < 1) return '';
  const to = Number(v.timeout);
  if (!Number.isInteger(to) || to < 1 || to > 1024) return 'Timeout: whole seconds from 1 to 1024.';
  const r = Number(v.retries);
  if (!Number.isInteger(r) || r < 1 || r > 10) return 'Tool retries: 1 to 10.';
  return '';
}

/** headers body from the form, or undefined to leave them as they are. */
function headersOf(v: FormValues, isEdit: boolean): Record<string, unknown> | undefined {
  if (v.hdrMode === HDR_NONE) return isEdit ? {} : undefined;  if (v.hdrMode === HDR_KEEP) return undefined;
  const sid = String(v.sid || '').trim();
  if (!sid) return undefined;
  return { [String(v.hdr).trim()]: { $secret: { backend: v.sbk || 'vault', secret_id: sid, version: String(v.sver).trim() } } };
}

/** `POST /api/mcp-servers` body. */
export function toKapCreate(v: FormValues): Record<string, unknown> {
  const h = headersOf(v, false);
  return {
    name: String(v.n).trim(),
    type: typeOfLabel(v.type),
    base_url: String(v.up).trim(),
    ...(h ? { headers: h } : {}),
    timeout_seconds: Number(v.timeout),
    tool_max_retries: Number(v.retries),
    verify_tls: v.tls !== 'No',
    ...(String(v.ca || '').trim() ? { tls_ca_file: String(v.ca).trim() } : {}),
  };
}

/** `PATCH /api/mcp-servers/{id}` body: only what changed (type can't change). */
export function toKapPatch(v: FormValues, s: McpServer, i: KapSrvInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const up = String(v.up).trim();
  if (up !== s.up) out.base_url = up;
  if (Number(v.timeout) !== Number(s.timeout)) out.timeout_seconds = Number(v.timeout);
  if (Number(v.retries) !== Number(s.retries)) out.tool_max_retries = Number(v.retries);
  const tls = v.tls !== 'No';
  if (tls !== i.verifyTls) out.verify_tls = tls;
  const ca = String(v.ca || '').trim() || null;
  if (ca !== (i.caFile || null)) out.tls_ca_file = ca;
  const h = headersOf(v, true);
  if (h) out.headers = h;
  return out;
}

/**
 * Body to bring a deactivated server back (`POST` under the same name). Header
 * values are write-only, so they cannot be sent again.
 */
export const toKapRestore = (s: McpServer, i: KapSrvInfo): Record<string, unknown> => ({
  name: s.n, type: i.type, base_url: s.up, timeout_seconds: Number(s.timeout), tool_max_retries: Number(s.retries), verify_tls: i.verifyTls, ...(i.caFile ? { tls_ca_file: i.caFile } : {}),
});

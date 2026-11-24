/**
 * KAP → Model Providers Registry (live tenant). Pure mapping of the sandbox
 * tenant's KAP model providers (`ModelProviderOut`, `ModelProviderCheckOut`)
 * onto registry entries (`Dep` + `Conn`), and the KAP bodies for writes.
 *
 * What KAP has and what it doesn't (API v1.1):
 * - Model providers are tenant-scoped: name, provider type (`openai`,
 *   `openai-api-compatible`, `azure-openai`), model type (`chat`,
 *   `embedding`), model name, base URL, params, config (`auth_method` for
 *   Azure), api key (a secret reference, write-only: only `is_set` comes back),
 *   rpm / tpm limits and `max_wait_seconds`.
 * - `POST /check` probes the base URL and the model and reports a status.
 * - DELETE deactivates the provider; creating the same name again restores it.
 *   KAP refuses (409) while another resource references it.
 * - No enable/disable, no emergency disable, no capability list (tool calling,
 *   structured output, vision), no context window, no per-tenant availability
 *   (a provider belongs to its tenant), no request / latency / utilisation
 *   metrics. Those stay as honest defaults ('—', 'Not checked').
 */
import type { FormField, FormValues } from '@/engine/dialogs';
import type { Conn, Dep, Health, Registry, TKey } from '@/v35/data/platform';

// ---- KAP shapes (openai.json)

export type KapProviderType = 'openai' | 'openai-api-compatible' | 'azure-openai';
export type KapModelType = 'chat' | 'embedding';
export interface KapModelProvider {
  id: string;
  name: string;
  model_provider: KapProviderType;
  model_type: KapModelType;
  model_name: string;
  base_url: string;
  params: Record<string, unknown>;
  config: Record<string, unknown>;
  api_key: { is_set: boolean };
  rpm: number | null;
  tpm: number | null;
  max_wait_seconds: number;
  created_at: string;
  updated_at: string;
}
export type KapCheckStatus = 'ok' | 'unreachable' | 'unauthorized' | 'invalid_model' | 'invalid_model_type' | 'unexpected_status' | 'rate_limited' | 'limiter_unavailable';
export interface KapProviderCheck {
  status: KapCheckStatus;
  checked_at: string;
  detail: string;
  provider_status_code?: number | null;
  retry_after_seconds?: number | null;
}

/** KAP facts kept beside the registry (the registry types have no field for them). */
export interface KapModels {
  /** registry entry id → KAP provider */
  byDep: Record<string, KapModelProvider>;
  /** KAP provider id → last check result (session) */
  checks: Record<string, KapProviderCheck>;
}

export const LIVE_TENANT: TKey = 'sandbox';
export const KAP_CONN_PREFIX = 'kapc:';

export const PROVIDER_L: Record<KapProviderType, string> = { 'openai-api-compatible': 'OpenAI-compatible API', openai: 'OpenAI', 'azure-openai': 'Azure OpenAI' };
export const providerOfLabel = (l: string): KapProviderType => (Object.keys(PROVIDER_L) as KapProviderType[]).find((k) => PROVIDER_L[k] === l) ?? 'openai-api-compatible';
/** Registry connection types (CONN_TYPES keys) of KAP provider types. */
const CONN_TYPE: Record<KapProviderType, string> = { 'openai-api-compatible': 'OpenAI-compatible API', openai: 'OpenAI-compatible API', 'azure-openai': 'Azure OpenAI' };
export const MODEL_TYPE_L: Record<KapModelType, string> = { chat: 'Chat', embedding: 'Embedding' };

/** '2026-11-20T14:03:11Z' → '2026-11-20 14:03 UTC' ('—' when missing). */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

const hostOf = (u: string) => (u || '').replace(/^https?:\/\//, '').split('/')[0];
const isEntra = (p: Pick<KapModelProvider, 'model_provider' | 'config'>) => p.model_provider === 'azure-openai' && p.config?.auth_method === 'entra_id';

// ---- check results

const DETAIL: Record<string, string> = {
  available: 'Base URL and model answered.',
  base_url_unreachable: 'KAP could not reach the base URL. A host on a private network must be on KAP’s OUTBOUND_PRIVATE_ALLOWLIST (SSRF guard) and reachable from KAP’s network.',
  base_url_unauthorized: 'The base URL refused the credentials.',
  base_url_unexpected_status: 'The base URL answered with an unexpected status.',
  model_unreachable: 'The model endpoint could not be reached.',
  model_not_found: 'The provider does not serve this model name.',
  model_type_not_allowed: 'The model does not support the configured model type.',
  model_unexpected_status: 'The model answered with an unexpected status.',
  local_rate_limit: 'KAP’s own rate limit for this provider is exhausted.',
  upstream_rate_limit: 'The provider rate-limited the check.',
  rate_limit_store_unavailable: 'KAP’s rate-limit store is unavailable.',
  api_key_rejected: 'The provider rejected the API key.',
  entra_id_access_denied: 'The workload identity has no access to the Azure resource (a new role can take several minutes).',
  entra_id_token_unavailable: 'No Microsoft Entra ID token could be obtained.',
  network_access_denied: 'The network rules of the Azure resource refused the call.',
  entra_id_host_not_allowed: 'The host is not among the Azure OpenAI hosts assigned to this tenant.',
};

export const healthOfCheck = (s: KapCheckStatus): Health => (s === 'ok' ? 'Healthy' : s === 'rate_limited' || s === 'limiter_unavailable' ? 'Degraded' : 'Failing');

/** Test banner text of a KAP check. */
export function checkMsg(c: KapProviderCheck): string {
  const d = DETAIL[c.detail] ?? c.detail;
  const code = c.provider_status_code ? ` (provider status ${c.provider_status_code})` : '';
  const retry = c.retry_after_seconds ? ` Retry after ${Math.ceil(c.retry_after_seconds)} s.` : '';
  return c.status === 'ok' ? `KAP check passed at ${fmtTime(c.checked_at)}: ${d}` : `KAP check: ${c.status.replace(/_/g, ' ')} · ${d}${code}${retry}`;
}

// ---- KAP → registry

const limitL = (p: Pick<KapModelProvider, 'rpm' | 'tpm'>) =>
  [p.rpm ? `${p.rpm.toLocaleString('en-US')} requests / min` : '', p.tpm ? `${p.tpm.toLocaleString('en-US')} tokens / min` : ''].filter(Boolean).join(' · ') || 'Not limited in KAP';

/** One registry connection per KAP provider type and base URL. */
export function toConn(p: KapModelProvider): Conn {
  return {
    id: `${KAP_CONN_PREFIX}${p.model_provider}:${p.base_url}`,
    n: `KAP · ${hostOf(p.base_url) || p.base_url}`,
    type: CONN_TYPE[p.model_provider],
    ep: p.base_url,
    region: '',
    apiver: '',
    auth: isEntra(p) ? 'Microsoft Entra ID (managed identity)' : p.api_key?.is_set ? 'API key (secret reference in KAP)' : 'None',
    secret: '',
    tls: '—',
    timeout: '—',
    status: 'Enabled',
    health: 'Not checked',
    lastOk: '—',
    errors: '—',
    req: '—',
    lat: '—',
    util: '—',
    by: `KAP · ${fmtTime(p.updated_at)}`,
  };
}

/** A KAP provider as a registry entry assigned to the live tenant. */
export function toDep(p: KapModelProvider, id: string, check?: KapProviderCheck): Dep {
  const h = check ? healthOfCheck(check.status) : 'Not checked';
  return {
    id,
    type: p.model_type === 'embedding' ? 'Embedding' : 'LLM',
    did: p.model_name,
    conn: toConn(p).id,
    model: p.model_name,
    vendor: PROVIDER_L[p.model_provider],
    cat: p.model_type === 'embedding' ? 'Embedding' : 'LLM',
    // KAP knows only the model type; capabilities beyond it are not recorded
    caps: p.model_type === 'embedding' ? ['Embeddings'] : ['Chat'],
    dims: '',
    params: {},
    limit: limitL(p),
    serving: '',
    status: 'Active',
    health: h,
    lastOk: check?.status === 'ok' ? fmtTime(check.checked_at) : '—',
    errors: check && check.status !== 'ok' ? `Last check: ${check.status.replace(/_/g, ' ')}` : '—',
    req: '—',
    lat: '—',
    util: '—',
    all: false,
    ten: [LIVE_TENANT],
    tpm: p.tpm ? p.tpm.toLocaleString('en-US') : '',
    verified: check?.status === 'ok' ? (p.model_type === 'embedding' ? ['Embeddings'] : ['Chat']) : [],
  };
}

/**
 * Replace the live entries of the registry with the tenant's KAP providers.
 * Sample entries stay (other tenants). An entry's id is the KAP name, or
 * `<name>-kap` when a sample entry already uses that name.
 */
export function mergeKap(R: Registry, prev: KapModels, providers: KapModelProvider[]): { next: Registry; kapm: KapModels } {
  const next = structuredClone(R);
  next.deps = next.deps.filter((d) => !prev.byDep[d.id]);
  next.conns = next.conns.filter((c) => !c.id.startsWith(KAP_CONN_PREFIX));
  const taken = new Set(next.deps.map((d) => d.id));
  const byDep: Record<string, KapModelProvider> = {};
  const seenConn = new Set<string>();
  for (const p of providers.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const id = taken.has(p.name) ? `${p.name}-kap` : p.name;
    taken.add(id);
    byDep[id] = p;
    const c = toConn(p);
    if (!seenConn.has(c.id)) {
      seenConn.add(c.id);
      next.conns.push(c);
    }
    next.deps.push(toDep(p, id, prev.checks[p.id]));
  }
  const live = new Set(providers.map((p) => p.id));
  const checks = Object.fromEntries(Object.entries(prev.checks).filter(([k]) => live.has(k)));
  return { next, kapm: { byDep, checks } };
}

/** Apply a check result to the registry entry of a KAP provider. */
export function applyCheck(R: Registry, id: string, p: KapModelProvider, c: KapProviderCheck): Registry {
  const next = structuredClone(R);
  const i = next.deps.findIndex((d) => d.id === id);
  if (i >= 0) next.deps[i] = toDep(p, id, c);
  return next;
}

/** Configuration lines of a live entry's details. */
export function kapCfg(p: KapModelProvider): [string, string, boolean?][] {
  const params = Object.keys(p.params ?? {}).length ? JSON.stringify(p.params) : 'None';
  return [
    ['Source', 'KAP model provider · tenant sandbox'],
    ['Name in KAP', p.name, true],
    ['Provider type', PROVIDER_L[p.model_provider]],
    ['Model type', MODEL_TYPE_L[p.model_type]],
    [p.model_provider === 'azure-openai' ? 'Deployment' : 'Model name', p.model_name, true],
    ['Base URL', p.base_url, true],
    ['Credential', isEntra(p) ? 'Microsoft Entra ID (workload identity)' : p.api_key?.is_set ? 'API key set (secret reference; the value never leaves KAP)' : 'No API key'],
    ['Rate limits', limitL(p)],
    ['Max wait', `${p.max_wait_seconds} s per model call`],
    ['Params', params, true],
    ['Created', fmtTime(p.created_at)],
    ['Updated', fmtTime(p.updated_at)],
    ['KAP id', p.id, true],
  ];
}

// ---- forms and bodies

const NAME_RE = /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const BACKENDS = ['vault', 'azure_key_vault'];
const AUTH_L: Record<string, string> = { api_key: 'API key', entra_id: 'Microsoft Entra ID (workload identity)' };
const authOfLabel = (l: string) => (l === AUTH_L.entra_id ? 'entra_id' : 'api_key');

/** Fields of the create (p = null) and edit forms. */
export function providerFields(p: KapModelProvider | null): FormField[] {
  const secretHint = p ? 'Leave empty to keep the current key reference.' : 'KAP stores a reference to an existing secret version (Vault or Azure Key Vault); write the key there first.';
  return [
    ...(p ? [] : [{ type: 'note', tone: 'info', label: 'Created in KAP for the sandbox tenant', text: 'KAP model providers belong to one tenant. The new provider is available to sandbox only.' } as FormField]),
    { k: 'name', label: 'Name', type: 'text', val: p?.name ?? '', ph: 'e.g. qwen-chat', hint: '4–64 characters: lower-case letters, digits, - and _.' },
    p
      ? { k: 'prov', label: 'Provider type', type: 'text', ro: true, val: PROVIDER_L[p.model_provider] }
      : { k: 'prov', label: 'Provider type', type: 'select', opts: Object.values(PROVIDER_L), val: PROVIDER_L['openai-api-compatible'] },
    p
      ? { k: 'mt', label: 'Model type', type: 'text', ro: true, val: MODEL_TYPE_L[p.model_type] }
      : { k: 'mt', label: 'Model type', type: 'select', opts: Object.values(MODEL_TYPE_L), val: 'Chat' },
    { k: 'model', label: 'Model name', type: 'text', val: p?.model_name ?? '', ph: 'e.g. qwen72b', hint: 'The served model name (the deployment name for Azure OpenAI).' },
    { k: 'url', label: 'Base URL', type: 'text', val: p?.base_url ?? '', ph: 'http://vllm:8000/v1', hint: 'Private hosts must be on KAP’s OUTBOUND_PRIVATE_ALLOWLIST. Azure: the resource’s v1 endpoint ending with /openai/v1.' },
    { k: 'auth', label: 'Azure sign-in (Azure OpenAI only)', type: 'select', opts: [AUTH_L.api_key, AUTH_L.entra_id], val: AUTH_L[String(p?.config?.auth_method ?? 'api_key')] ?? AUTH_L.api_key },
    { k: 'be', label: 'Key secret backend', type: 'select', opts: BACKENDS, val: 'vault' },
    { k: 'sid', label: 'Key secret id', type: 'text', val: '', ph: 'UUID of the secret', hint: secretHint },
    { k: 'sver', label: 'Key secret version', type: 'text', val: '', ph: 'e.g. 1' },
    { k: 'rpm', label: 'Requests per minute', type: 'num', val: p?.rpm != null ? String(p.rpm) : '', hint: 'Empty: no request limit.' },
    { k: 'tpm', label: 'Tokens per minute', type: 'num', val: p?.tpm != null ? String(p.tpm) : '', hint: 'Empty: no token limit.' },
    { k: 'wait', label: 'Max wait (seconds)', type: 'num', val: String(p?.max_wait_seconds ?? 30), hint: 'Time one model call may wait for budget, cooldown and retries (0.1–300).' },
  ];
}

const str = (v: unknown) => String(v ?? '').trim();
const optInt = (v: unknown, hi: number, label: string): number | null | string => {
  const s = str(v).replace(/,/g, '');
  if (!s) return null;
  if (!/^\d+$/.test(s) || +s < 1 || +s > hi) return `${label} must be a whole number from 1 to ${hi.toLocaleString('en-US')}, or empty.`;
  return +s;
};

type Body = Record<string, unknown>;

/** Validate the form and build the body: `{ body }` or `{ err }`. */
function common(v: FormValues, prov: KapProviderType, editing: boolean): { err: string } | { name: string; model: string; url: string; rpm: number | null; tpm: number | null; wait: number; auth: string; key: Body | null } {
  const name = str(v.name);
  if (name.length < 4 || name.length > 64 || !NAME_RE.test(name)) return { err: 'Name: 4–64 lower-case letters, digits, - or _, starting and ending with a letter or digit.' };
  const model = str(v.model);
  if (!model || model.length > 64) return { err: 'Enter the model name (up to 64 characters).' };
  const url = str(v.url);
  if (!/^https?:\/\/[^\s/]+/.test(url) && !(prov === 'openai' && !url)) return { err: 'Enter the base URL (http:// or https://).' };
  if (prov === 'azure-openai' && !/\/openai\/v1\/?$/.test(url)) return { err: 'Azure OpenAI: the base URL is the resource’s v1 endpoint and ends with /openai/v1.' };
  const rpm = optInt(v.rpm, 100_000, 'Requests per minute');
  if (typeof rpm === 'string') return { err: rpm };
  const tpm = optInt(v.tpm, 100_000_000, 'Tokens per minute');
  if (typeof tpm === 'string') return { err: tpm };
  const wait = Number(str(v.wait) || '30');
  if (!(wait >= 0.1 && wait <= 300)) return { err: 'Max wait must be between 0.1 and 300 seconds.' };
  const auth = prov === 'azure-openai' ? authOfLabel(String(v.auth)) : 'api_key';
  const sid = str(v.sid);
  const sver = str(v.sver);
  let key: Body | null = null;
  if (auth === 'entra_id') {
    if (sid) return { err: 'With Microsoft Entra ID sign-in KAP refuses an API key: leave the secret empty.' };
    if (!/^https:\/\/[^/]+\.openai\.azure\.com\//.test(url)) return { err: 'With Microsoft Entra ID the base URL host must end with .openai.azure.com.' };
  } else if (sid || sver || !editing) {
    if (!UUID_RE.test(sid)) return { err: 'Enter the key secret id (a UUID of an existing secret).' };
    if (!sver) return { err: 'Enter the key secret version.' };
    key = { $secret: { backend: BACKENDS.includes(String(v.be)) ? String(v.be) : 'vault', secret_id: sid, version: sver } };
  }
  return { name, model, url, rpm, tpm, wait, auth, key };
}

/** POST /model-providers body. */
export function toKapCreate(v: FormValues): { err: string } | { body: Body } {
  const prov = providerOfLabel(String(v.prov));
  const c = common(v, prov, false);
  if ('err' in c) return c;
  const settings: Body = { model_name: c.model, ...(c.url ? { base_url: c.url } : {}), ...(c.key ? { api_key: c.key } : {}) };
  const body: Body = {
    name: c.name,
    model_provider: prov,
    model_type: String(v.mt) === 'Embedding' ? 'embedding' : 'chat',
    settings,
    max_wait_seconds: c.wait,
    ...(c.rpm != null ? { rpm: c.rpm } : {}),
    ...(c.tpm != null ? { tpm: c.tpm } : {}),
    ...(prov === 'azure-openai' ? { config: { auth_method: c.auth } } : {}),
  };
  return { body };
}

/** PATCH /model-providers/{id} body: only what changed. `{ body: {} }` = no change. */
export function toKapPatch(p: KapModelProvider, v: FormValues): { err: string } | { body: Body } {
  const c = common(v, p.model_provider, true);
  if ('err' in c) return c;
  const body: Body = {};
  const settings: Body = {};
  if (c.name !== p.name) body.name = c.name;
  if (c.model !== p.model_name) settings.model_name = c.model;
  if (c.url && c.url !== p.base_url) settings.base_url = c.url;
  if (c.key) settings.api_key = c.key;
  if (Object.keys(settings).length) body.settings = settings;
  if (c.rpm !== p.rpm) body.rpm = c.rpm;
  if (c.tpm !== p.tpm) body.tpm = c.tpm;
  if (c.wait !== p.max_wait_seconds) body.max_wait_seconds = c.wait;
  if (p.model_provider === 'azure-openai' && c.auth !== (p.config?.auth_method ?? 'api_key')) {
    if (c.auth === 'api_key' && !c.key) return { err: 'Switching to API key sign-in needs the key secret id and version.' };
    body.config = { auth_method: c.auth };
  }
  return { body };
}

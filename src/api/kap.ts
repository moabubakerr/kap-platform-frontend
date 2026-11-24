/**
 * KAP through the platform API: `/api/platform/t/{tenantId}/kap/{path}` →
 * KAP `/api/{path}` with the tenant's credentials (platform-api `kap_proxy.py`).
 * Errors keep KAP's `{type, message, data}` shape.
 *
 * Agent jobs are not submitted here: use `submitJob` from `platformLive.ts`
 * (the platform adds its callback so traces link).
 */
export interface KapPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_next: boolean;
}

export class KapApiError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    message: string,
    readonly data: unknown = {},
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | (string | number)[] | null | undefined>;

function qs(q?: Query): string {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v == null) continue;
    for (const x of Array.isArray(v) ? v : [v]) p.append(k, String(x));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const kapUrl = (tenantId: string, path: string, q?: Query) => `/api/platform/t/${tenantId}/kap/${path.replace(/^\/+/, '')}${qs(q)}`;

/** One KAP call. Resolves to the JSON body (undefined for 204). */
export async function kap<T = unknown>(tenantId: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown, q?: Query): Promise<T> {
  const r = await fetch(kapUrl(tenantId, path, q), {
    method,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!r.ok) {
    const msg = json?.message ?? (r.status === 502 || r.status === 504 ? 'The platform API or KAP is not reachable.' : text.slice(0, 200) || r.statusText);
    throw new KapApiError(r.status, json?.type ?? 'error', kapMessage(msg, json?.data), json?.data);
  }
  return json as T;
}

/** KAP validation errors carry field details in `data`; fold the first few into the message. */
function kapMessage(msg: string, data: any): string {
  const errs = data?.kap_body?.data?.errors ?? data?.errors;
  if (Array.isArray(errs) && errs.length) {
    const parts = errs.slice(0, 3).map((e: any) => [Array.isArray(e.loc) ? e.loc.filter((x: unknown) => x !== 'body').join('.') : e.field, e.msg ?? e.message].filter(Boolean).join(': '));
    return `${msg} (${parts.join('; ')})`;
  }
  return msg;
}

export const kapGet = <T = unknown>(tenantId: string, path: string, q?: Query) => kap<T>(tenantId, 'GET', path, undefined, q);

/** Every item of a paged KAP list (200 per page), up to `max`. */
export async function kapAll<T>(tenantId: string, path: string, q?: Query, max = 2000): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; out.length < max; offset += 200) {
    const page = await kapGet<KapPage<T>>(tenantId, path, { ...q, limit: 200, offset });
    out.push(...page.items);
    if (!page.has_next) break;
  }
  return out.slice(0, max);
}

/** Message for a dialog or banner. */
export const kapError = (e: unknown): string => (e instanceof Error ? e.message : String(e));

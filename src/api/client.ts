/**
 * API client. In this phase every resource is served from src/mocks behind
 * `query()`; swapping to the real REST APIs means changing only this file
 * (and the per-feature `src/api/*.ts` adapters that map server shapes to the
 * console's types).
 *
 * Real backends, when wired (same-origin, proxied by Vite / nginx):
 *   /api/kap/*   → KAP API      (Bearer JWT + X-Tenant-ID; RBAC via groups → roles → grants)
 *   /api/askai/* → Ask AI admin (/admin/messages, /admin/feedback, /admin/catalogue, /admin/stats …)
 */
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

export const USE_MOCKS = true;

const LATENCY_MS = 180;

/** Resolve mock data with a small delay so loading states are exercised. */
export function mock<T>(data: T | (() => T), latency = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(typeof data === 'function' ? (data as () => T)() : data), latency));
}

/** Thin useQuery wrapper so features declare data as (key, loader). */
export function useApi<T>(key: readonly unknown[], loader: () => Promise<T>, opts?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>) {
  return useQuery<T>({ queryKey: key, queryFn: loader, staleTime: 60_000, ...opts });
}

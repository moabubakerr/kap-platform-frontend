/**
 * Shared audit trail (session). Every hub records its actions here; the
 * Unified Audit Log screens (tenant and platform) read it. Event shape follows
 * the prototype's `ev()`: { who, action, res, tenants, lvl, area, at }.
 * When the platform layer has an audit API this becomes its client.
 */
import { createStore } from '@/engine/store';
import type { TenantKey } from '@/v35/iam';

export interface AuditEvent {
  id: string;
  /** account that acted (the "view as" uid) */
  who: string;
  /** what happened, e.g. "Created data source" */
  action: string;
  /** the record, e.g. "sceai_bucket · S3" */
  res: string;
  tenants: TenantKey[];
  /** 'tenant' or 'platform' */
  lvl: 'tenant' | 'platform';
  /** hub or area, e.g. "Data Ingestion Hub" */
  area: string;
  /** ISO time */
  at: string;
}

export const auditStore = createStore<AuditEvent[]>(() => []);

let seq = 0;
/** Record an event (newest first). */
export function recordAudit(e: Omit<AuditEvent, 'id' | 'at'> & { at?: string }) {
  auditStore.update((list) => {
    list.unshift({ id: `ev-${Date.now()}-${++seq}`, at: e.at ?? new Date().toISOString(), ...e });
  });
}

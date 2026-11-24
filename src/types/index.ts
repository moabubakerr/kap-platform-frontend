// Console domain types. Shapes are the console's own; per-feature adapters
// in src/api map KAP API / Ask AI admin API responses onto them.

export type JobStatus = 'running' | 'succeeded' | 'failed' | 'cancelled' | 'queued';

export interface Agent {
  id: string; // slug used in routes (KAP agent name)
  uuid: string; // KAP agent UUID
  name: string;
  description: string;
  type: string; // planner_and_executor | pipeline · <stage>
  group: string; // 'Indicator agents · jobs' | 'Ask AI · chat'
  kind: 'kap' | 'pipeline';
  model: string;
  collections: string[];
  toolsCount: number | null;
  oxford: boolean;
  calls24h: number;
  successRate: number; // %
  status: 'healthy' | 'degraded';
}

export interface Job {
  id: string; // short id (8 hex) — full uuid in `uuid`
  uuid: string;
  status: JobStatus;
  agent: string;
  user: string;
  question: string;
  reason?: string;
  duration: string;
  durationS: number;
  retries: number;
  rel: string;
  abs: string;
  createdAt: string; // ISO
  toolCalls: number;
  modelRequests: number;
  /** live tenants: whether model calls were linked to this job (platform API) */
  traceStatus?: 'pending' | 'linked' | 'ambiguous' | 'none';
  traceCalls?: number;
}

export interface ConsoleUser {
  username: string;
  displayName: string;
  role: 'administrator' | 'analyst' | 'viewer';
  groups: string[];
  lastSeen: string;
  email?: string;
  auth: string;
  kind: 'person' | 'service';
}

export interface Tool {
  name: string;
  description: string;
  source: 'local' | 'documents' | 'oxford';
  calls7d: number;
  errorRate: string;
}

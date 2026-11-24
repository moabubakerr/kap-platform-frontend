// Tools & MCP servers (design-ref/screens/mcp.html; app.js mcpTools / builtin).
import { TOOLS, SOURCE_COLOR } from './core';

export interface McpServer {
  name: string;
  url: string;
  host: string;
  status: 'degraded' | 'healthy';
  lastCheck: string;
  p95: string;
  toolsCount: number;
  usedBy: string[];
  errors24h: string;
  check: { handshake: string; tlsUntil: string; tools: string[] };
}

export interface McpTool {
  name: string;
  description: string;
  usedBy: string;
  calls7d: number;
  errorRate: string;
  p95: string;
}

export interface BuiltinTool {
  name: string;
  source: 'local' | 'documents';
  description: string;
  usedBy: string[];
  calls7d: number;
  errorRate: string;
}

export const MCP_SERVERS: McpServer[] = [
  {
    name: 'oxford_economics',
    url: 'https://services.oxfordeconomics.com/mcp',
    host: 'services.oxfordeconomics.com',
    status: 'degraded',
    lastCheck: '2 min ago',
    p95: '2.6 s',
    toolsCount: 2,
    usedBy: ['sceai_indicators_oxford'],
    errors24h: '2 × 502',
    check: { handshake: '412 ms', tlsUntil: '03 Aug 2027', tools: ['EconomicData', 'EconomicAnalysis'] },
  },
];

export const MCP_TOOLS: McpTool[] = [
  { name: 'EconomicData', description: 'Public macro data series by country and indicator', usedBy: 'sceai_indicators_oxford', calls7d: 15, errorRate: '20%', p95: '2.6 s' },
  { name: 'EconomicAnalysis', description: 'Forecasts and narrative analysis', usedBy: 'sceai_indicators_oxford', calls7d: 4, errorRate: '0%', p95: '3.3 s' },
];

export const BUILTIN_TOOLS: BuiltinTool[] = TOOLS.filter((t) => t.source !== 'oxford').map((t) => ({
  name: t.name,
  source: t.source as 'local' | 'documents',
  description: t.description,
  usedBy: ['sceai_indicators_agent', 'sceai_indicators_oxford'],
  calls7d: t.calls7d,
  errorRate: t.errorRate,
}));

export const TOOL_SOURCE = {
  local: { label: 'Local data', color: SOURCE_COLOR.local },
  documents: { label: 'Documents', color: SOURCE_COLOR.documents },
  oxford: { label: 'Oxford (external)', color: SOURCE_COLOR.oxford },
} as const;

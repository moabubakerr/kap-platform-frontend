import { mock, useApi } from './client';
import { BUILTIN_TOOLS, MCP_SERVERS, MCP_TOOLS } from '@/mocks/mcp';

// GET /api/mcp/servers, /api/mcp/servers/{name}/tools, /api/tools?source=builtin
export const useMcpServers = () => useApi(['mcp', 'servers'], () => mock(MCP_SERVERS));
export const useMcpTools = () => useApi(['mcp', 'tools'], () => mock(MCP_TOOLS));
export const useBuiltinTools = () => useApi(['tools', 'builtin'], () => mock(BUILTIN_TOOLS));

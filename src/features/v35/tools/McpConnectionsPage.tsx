import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { emptyTenant, mcpScreen, modHead, TOOLS_TABS, type ListFilters } from './build';
import { useMcpCtx } from './useTools';

/**
 * AI Agent Tools · MCP Connections (route /tools/mcp/:serverId?): shared and
 * tenant MCP servers with connection tests, permitted tools, configuration and
 * the agents' tool assignments. `serverId` opens that connection's details.
 */
export default function McpConnectionsPage() {
  const { serverId } = useParams();
  const c = useMcpCtx();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs(['MCP Connections', serverId]);
  if (!c.ok) {
    const head = modHead('AI Agent Tools', TOOLS_TABS, 'mcpconn', (v) => c.nav(v === 'mcpconn' ? `${c.base}/tools/mcp` : `${c.base}/tools`));
    return <ScreenView model={emptyTenant(head, 'MCP servers', c.tn, c.key === 'default')} />;
  }
  return <ScreenView key={serverId ?? ''} model={mcpScreen(c, f, setF, serverId ? `mc:${serverId}` : undefined)} />;
}

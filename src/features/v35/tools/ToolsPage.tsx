import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { emptyTenant, modHead, toolsScreen, TOOLS_TABS, type ListFilters } from './build';
import { useToolsCtx } from './useTools';

/** AI Agent Tools · Tools (route /tools?open=tl:<server>:<tool>): one inventory of every tool available to the tenant. */
export default function ToolsPage() {
  const c = useToolsCtx();
  const [sp] = useSearchParams();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs(['Tools']);
  if (!c.ok) {
    const head = modHead('AI Agent Tools', TOOLS_TABS, 'tools', (v) => c.nav(v === 'mcpconn' ? `${c.base}/tools/mcp` : `${c.base}/tools`));
    return <ScreenView model={emptyTenant(head, 'tools', c.tn, c.key === 'default')} />;
  }
  return <ScreenView model={toolsScreen(c, f, setF, sp.get('open') ?? undefined)} />;
}

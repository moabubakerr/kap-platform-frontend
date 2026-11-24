import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { agentsMapScreen } from './build';
import { useWorkflows } from './useWorkflows';

/** Tenant Agents Map (route /workflows/map): agents, workflows and tools of the tenant. */
export default function AgentsMapPage() {
  const c = useWorkflows();
  const [sel, setSel] = React.useState<string | null>(null);
  useCrumbs(['Tenant Agents Map']);
  return <ScreenView model={agentsMapScreen(c, sel, setSel)} />;
}

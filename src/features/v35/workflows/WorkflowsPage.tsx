import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { workflowsScreen, type ListFilters } from './build';
import { useWorkflows } from './useWorkflows';
import { WfLiveBanner } from './WfLiveBanner';

/** AI Agent Factory · Agent Workflows (route /workflows). */
export default function WorkflowsPage() {
  const c = useWorkflows();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs([]);
  return (
    <>
      <WfLiveBanner c={c} />
      <ScreenView model={workflowsScreen(c, f, setF)} />
    </>
  );
}

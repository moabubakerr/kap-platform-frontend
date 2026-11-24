import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { PIPE_TABS, pipeScreen } from './build';
import { useIngest } from './useIngest';

/** Pipeline detail (route /pipelines/:pipelineId/:tab?): Overview · Configuration · Runs · Dependencies. */
export default function PipelinePage() {
  const { pipelineId = '', tab } = useParams();
  const c = useIngest();
  const [sel, setSel] = React.useState<string | null>(null);
  React.useEffect(() => setSel(null), [pipelineId]);
  const model = pipeScreen(c, pipelineId, tab, (v) => c.go.pipe(pipelineId, v), sel, setSel);
  useCrumbs([pipelineId, model.head.tabs ? PIPE_TABS.find((x) => x.value === model.head.tab)?.label : undefined]);
  return <ScreenView model={model} />;
}

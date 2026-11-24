import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { evidenceScreen, type ListFilters } from './build';
import { useConfidence } from './useConfidence';

/** AI Confidence Hub · Answer Evidence (route /evidence): every answer with grounding, citations, detected problems and assessment. */
export default function EvidencePage() {
  const { ctx, tn } = useConfidence();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs([]);
  if (!ctx) return <ScreenView model={{ head: { title: 'Answer Evidence' }, sections: [{ empty: `No answer evidence records in ${tn}. The system tenant holds no business data or workloads.`, cols: [], rows: [] }] }} />;
  return <ScreenView model={evidenceScreen(ctx, f, setF)} />;
}

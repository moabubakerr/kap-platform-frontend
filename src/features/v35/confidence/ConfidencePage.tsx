import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { confovScreen } from './build';
import { useConfidence } from './useConfidence';

/** AI Confidence Hub · Overview (route /confidence): grounding, citation coverage, flagged answers, evidence quality by agent, feedback trend. */
export default function ConfidencePage() {
  const { ctx, tn } = useConfidence();
  useCrumbs([]);
  if (!ctx) return <ScreenView model={{ head: { title: 'AI Confidence Hub' }, sections: [{ empty: `No answers in ${tn}. The system tenant holds no business data or workloads.`, cols: [], rows: [] }] }} />;
  return <ScreenView model={confovScreen(ctx)} />;
}

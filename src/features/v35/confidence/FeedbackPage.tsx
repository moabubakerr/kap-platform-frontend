import * as React from 'react';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { feedbackScreen, type ListFilters } from './build';
import { useConfidence } from './useConfidence';

/** AI Confidence Hub · Feedback (route /feedback): negative feedback on answers; Open goes to the conversation. */
export default function FeedbackPage() {
  const { ctx, tn } = useConfidence();
  const [f, setF] = React.useState<ListFilters>({});
  useCrumbs([]);
  if (!ctx) return <ScreenView model={{ head: { title: 'Feedback' }, sections: [{ empty: `No feedback in ${tn}. The system tenant holds no business data or workloads.`, cols: [], rows: [] }] }} />;
  return <ScreenView model={feedbackScreen(ctx, f, setF)} />;
}

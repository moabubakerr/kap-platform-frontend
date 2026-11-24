import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { policiesScreen } from './build';
import { useConfidence } from './useConfidence';

/**
 * AI Governance · Policy Library (route /policies). The v35 design has no
 * builder for this screen and shows an empty state; this is that empty state
 * plus the guardrails the library will hold.
 */
export default function PoliciesPage() {
  const { tn, isDefault } = useConfidence();
  useCrumbs([]);
  return <ScreenView model={policiesScreen(tn, isDefault)} />;
}

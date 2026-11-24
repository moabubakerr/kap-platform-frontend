import { ScreenView } from '@/engine/ScreenView';
import { identityProvidersScreen } from './build';
import { useIamCtx } from './useIamCtx';

/** Identity provider configuration with group mappings (route /platform/identity). */
export default function IdentityProvidersPage() {
  return <ScreenView model={identityProvidersScreen(useIamCtx())} />;
}

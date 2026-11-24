/**
 * The sandbox tenant's KAP model providers in the Model Providers Registry.
 * The registry is platform-scope, so the live tenant is named explicitly.
 * Loading replaces the live entries of `registryStore`; sample entries stay.
 */
import { createStore } from '@/engine/store';
import { kapAll } from '@/api/kap';
import { useLiveLoad } from '@/v35/live';
import { registryStore } from '@/v35/data/platform';
import { LIVE_TENANT, mergeKap, type KapModelProvider, type KapModels } from './fromKap';

export const kapModelsStore = createStore<KapModels>(() => ({ byDep: {}, checks: {} }));

export function useKapModels() {
  const live = useLiveLoad('kap-models', LIVE_TENANT, async (tid) => {
    const providers = await kapAll<KapModelProvider>(tid, 'model-providers');
    const { next, kapm } = mergeKap(registryStore.get(), kapModelsStore.get(), providers);
    kapModelsStore.set(kapm);
    registryStore.set(next);
  });
  const kapm = kapModelsStore.use();
  return { live, kapm };
}

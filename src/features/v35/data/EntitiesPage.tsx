import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { ENTITY_TABS, entitiesScreen } from './build';
import { NoBusinessData, useDataHub } from './useDataHub';

/**
 * Business Entities · tenant ontology (route /entities?tab=…&type=…):
 * Entity Types · Relationship Types · Ontology Map · Extracted Entities · Agent Usage.
 */
export default function EntitiesPage() {
  const h = useDataHub();
  const [sp, setSp] = useSearchParams();
  const [sel, setSel] = React.useState<string | null>(null);
  const tab = sp.get('tab') ?? 'types';
  const type = sp.get('type') ?? 'All types';
  useCrumbs([tab === 'types' ? undefined : ENTITY_TABS.find(([k]) => k === tab)?.[1]]);
  const setParam = (k: string, v: string, dflt: string) =>
    setSp((p) => {
      const n = new URLSearchParams(p);
      if (v === dflt) n.delete(k);
      else n.set(k, v);
      return n;
    });
  if (!h) return <NoBusinessData title="Business Entities" />;
  return (
    <ScreenView
      model={entitiesScreen(h, {
        tab,
        setTab: (v) => setSp(v === 'types' ? {} : { tab: v }),
        type,
        setType: (v) => setParam('type', v, 'All types'),
        sel,
        setSel,
      })}
    />
  );
}

import * as React from 'react';
import { ScreenView } from '@/engine/ScreenView';
import { documentResults, documentsScreen } from './build';
import { dataSession, UD_DEFAULT, type UdFilters } from './session';
import { NoBusinessData, useDataHub } from './useDataHub';

/** Business Data Hub · Unstructured Data (route /unstructured). Filters persist per tenant for the session. */
export default function DocumentsPage() {
  const h = useDataHub();
  const sess = dataSession.use();
  const t = h?.t ?? '';
  const F: UdFilters = { ...UD_DEFAULT, ...(sess.udF[t] ?? {}) };
  const setF = (f: UdFilters) => dataSession.update((s) => { s.udF[t] = f; });
  const ids = h ? documentResults(h, F).ids : [];
  const idsKey = ids.join('\n');

  // the result list drives Previous / Next on the document page
  React.useEffect(() => {
    if (!t) return;
    const cur = dataSession.get().udIds[t];
    if (cur && cur.join('\n') === idsKey) return;
    dataSession.update((s) => { s.udIds[t] = idsKey ? idsKey.split('\n') : []; });
  }, [t, idsKey]);

  if (!h) return <NoBusinessData title="Unstructured Data" />;
  return <ScreenView model={documentsScreen(h, F, setF)} />;
}

import * as React from 'react';
import { documentResults, documentsScreen } from './build';
import { liveDocumentsScreen } from './liveBuild';
import { combineLive, useLiveDocs } from './liveData';
import { dataSession, UD_DEFAULT, type UdFilters } from './session';
import { DataScreen, NoBusinessData, useDataHub } from './useDataHub';

/** Business Data Hub · Unstructured Data (route /unstructured). Filters persist per tenant for the session. Live tenant: files of KAP's document collections. */
export default function DocumentsPage() {
  const h = useDataHub();
  const docs = useLiveDocs(h?.t);
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
  return <DataScreen live={combineLive(h.status, docs)} what="documents" model={h.live ? liveDocumentsScreen(h, F, setF) : documentsScreen(h, F, setF)} />;
}

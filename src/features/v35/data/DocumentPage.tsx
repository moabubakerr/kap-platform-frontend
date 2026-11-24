import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { DOCUMENT_TABS, documentScreen } from './build';
import { liveDocumentScreen } from './liveBuild';
import { combineLive, useLiveFile } from './liveData';
import { dataSession } from './session';
import { DataScreen, NoBusinessData, useDataHub } from './useDataHub';

/** Document detail (route /unstructured/:documentId/:tab?): Overview · Source files & versions · Processing · Extracted content · Entities · Usage. */
export default function DocumentPage() {
  const { documentId = '', tab } = useParams();
  const h = useDataHub();
  const sess = dataSession.use();
  useCrumbs([documentId, DOCUMENT_TABS.find(([k]) => k === tab)?.[1]]);
  // live tenant: the file with its detail and versions
  const file = useLiveFile(h?.t, documentId);
  if (!h) return <NoBusinessData title={documentId} />;
  const results = sess.udIds[h.t] ?? null;
  return <DataScreen live={combineLive(h.status, file)} what="documents" model={h.live ? liveDocumentScreen(h, documentId, tab, results) : documentScreen(h, documentId, tab, results)} />;
}

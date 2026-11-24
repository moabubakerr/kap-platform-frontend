import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { DOCUMENT_TABS, documentScreen } from './build';
import { dataSession } from './session';
import { NoBusinessData, useDataHub } from './useDataHub';

/** Document detail (route /unstructured/:documentId/:tab?): Overview · Source files & versions · Processing · Extracted content · Entities · Usage. */
export default function DocumentPage() {
  const { documentId = '', tab } = useParams();
  const h = useDataHub();
  const sess = dataSession.use();
  useCrumbs([documentId, DOCUMENT_TABS.find(([k]) => k === tab)?.[1]]);
  if (!h) return <NoBusinessData title={documentId} />;
  return <ScreenView model={documentScreen(h, documentId, tab, sess.udIds[h.t] ?? null)} />;
}

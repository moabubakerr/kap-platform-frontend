import { datasetsScreen } from './build';
import { DataScreen, NoBusinessData, useDataHub } from './useDataHub';

/** Business Data Hub · Structured Data (route /structured). Live tenant: indicator collections from KAP. */
export default function DatasetsPage() {
  const h = useDataHub();
  if (!h) return <NoBusinessData title="Structured Data" />;
  return <DataScreen live={h.status} what="datasets" model={datasetsScreen(h)} />;
}

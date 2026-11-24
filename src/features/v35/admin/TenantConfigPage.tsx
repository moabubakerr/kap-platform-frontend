import { useNavigate, useParams } from 'react-router-dom';
import { ScreenView } from '@/engine/ScreenView';
import { tenantConfigScreen } from './build';
import { useAdmin } from './useAdmin';

/** Tenant Configuration (route /p/:tenant/configuration/:tab?): General · Language Preferences · Resources & Scheduling · Data Lifecycle · Configuration History. */
export default function TenantConfigPage() {
  const { tab } = useParams();
  const nav = useNavigate();
  const c = useAdmin();
  return <ScreenView model={tenantConfigScreen(c, tab, (t) => nav(`${c.base}/configuration${t === 'general' ? '' : `/${t}`}`))} />;
}

import { useNavigate, useParams } from 'react-router-dom';
import { ScreenView } from '@/engine/ScreenView';
import { SESSION_ONLY_NOTE, tenantConfigScreen } from './build';
import { useAdmin } from './useAdmin';
import { LiveStrip, useKapConfig } from './useKapAdmin';

/**
 * Tenant Configuration (route /p/:tenant/configuration/:tab?): General · Language Preferences · Resources & Scheduling · Data Lifecycle · Configuration History.
 * For the live tenant, Configuration History shows KAP's configuration versions (preview and roll back in KAP);
 * the other tabs stay session-only because KAP has no API for them.
 */
export default function TenantConfigPage() {
  const { tab } = useParams();
  const nav = useNavigate();
  const c = useAdmin();
  const { live, K } = useKapConfig(c, c.T);
  const hist = tab === 'history';
  return (
    <>
      {hist ? <LiveStrip live={live} what="configuration versions" /> : <LiveStrip live={live} note={SESSION_ONLY_NOTE} />}
      <ScreenView model={tenantConfigScreen(c, tab, (t) => nav(`${c.base}/configuration${t === 'general' ? '' : `/${t}`}`), K)} />
    </>
  );
}

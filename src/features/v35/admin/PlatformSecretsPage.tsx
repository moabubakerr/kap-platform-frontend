import { useNavigate, useParams } from 'react-router-dom';
import { ScreenView } from '@/engine/ScreenView';
import { secretsScreen } from './build';
import { useAdmin } from './useAdmin';

/** Secrets & Keys (route /platform/secrets/:tab?): Encryption Keys · Service & Integration Credentials · Vault Backends (with tenant mapping). */
export default function PlatformSecretsPage() {
  const { tab } = useParams();
  const nav = useNavigate();
  const c = useAdmin();
  return <ScreenView model={secretsScreen(c, tab, (t) => nav(`/platform/secrets${t === 'keys' ? '' : `/${t}`}`))} />;
}

import { useNavigate, useParams } from 'react-router-dom';
import { ScreenView } from '@/engine/ScreenView';
import { platformConfigScreen } from './build';
import { useAdmin } from './useAdmin';

/** Platform Configuration (route /platform/configuration/:tab?): General · Workloads & Scheduling · Security Defaults · Configuration History. */
export default function PlatformConfigPage() {
  const { tab } = useParams();
  const nav = useNavigate();
  const c = useAdmin();
  return <ScreenView model={platformConfigScreen(c, tab, (t) => nav(`/platform/configuration${t === 'general' ? '' : `/${t}`}`))} />;
}

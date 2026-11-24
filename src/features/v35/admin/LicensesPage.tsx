import { ScreenView } from '@/engine/ScreenView';
import { licenseScreen } from './build';
import { useAdmin } from './useAdmin';

/** License Management (route /platform/licenses). */
export default function LicensesPage() {
  return <ScreenView model={licenseScreen(useAdmin())} />;
}

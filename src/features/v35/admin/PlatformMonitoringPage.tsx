import { ScreenView } from '@/engine/ScreenView';
import { monitoringScreen } from './build';
import { useAdmin } from './useAdmin';

/** Monitoring & Alerts (route /platform/monitoring): platform health, queues, alerts, rules, routes, external monitoring. */
export default function PlatformMonitoringPage() {
  return <ScreenView model={monitoringScreen(useAdmin())} />;
}

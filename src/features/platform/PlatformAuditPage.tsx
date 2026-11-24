import { usePlatformAudit } from '@/api/platform';
import { GenericTablePage } from './GenericTablePage';

export default function PlatformAuditPage() {
  const { data } = usePlatformAudit();
  return <GenericTablePage data={data} />;
}

import { usePlatformQueues } from '@/api/platform';
import { GenericTablePage } from './GenericTablePage';

export default function QueuesPage() {
  const { data } = usePlatformQueues();
  return <GenericTablePage data={data} />;
}

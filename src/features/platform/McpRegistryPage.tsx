import { usePlatformMcp } from '@/api/platform';
import { GenericTablePage } from './GenericTablePage';

export default function McpRegistryPage() {
  const { data } = usePlatformMcp();
  return <GenericTablePage data={data} />;
}

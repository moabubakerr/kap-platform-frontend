import { usePlatformModels } from '@/api/platform';
import { GenericTablePage } from './GenericTablePage';

export default function ModelServingPage() {
  const { data } = usePlatformModels();
  return <GenericTablePage data={data} />;
}

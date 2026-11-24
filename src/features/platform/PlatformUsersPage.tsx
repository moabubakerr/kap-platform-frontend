import { usePlatformUsers } from '@/api/platform';
import { GenericTablePage } from './GenericTablePage';

export default function PlatformUsersPage() {
  const { data } = usePlatformUsers();
  return <GenericTablePage data={data} />;
}

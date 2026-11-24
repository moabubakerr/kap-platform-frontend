import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useUsers } from '@/api/core';
import { roleTone } from '@/mocks/identity';
import type { ConsoleUser } from '@/types';
import { Avatar, ListSkeleton, MonoLink, readOnly } from './identity-ui';

export default function UsersPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data } = useUsers();

  const columns = React.useMemo<ColumnDef<ConsoleUser, any>[]>(
    () => [
      {
        id: 'username',
        header: 'Username',
        accessorKey: 'username',
        cell: ({ row }) => (
          <span className="flex items-center gap-2.5">
            <Avatar name={row.original.username} />
            <MonoLink to={`${base}/users/${row.original.username}`}>{row.original.username}</MonoLink>
          </span>
        ),
      },
      { id: 'displayName', header: 'Display name', accessorKey: 'displayName' },
      { id: 'role', header: 'Role', accessorKey: 'role', cell: ({ row }) => <Badge tone={roleTone(row.original.role)}>{row.original.role}</Badge> },
      {
        id: 'groups',
        header: 'Groups',
        accessorFn: (u) => u.groups.join(', '),
        cell: ({ row }) => (
          <span className="font-mono text-[12.5px]">
            {row.original.groups.map((g, i) => (
              <React.Fragment key={g}>
                {i > 0 && ', '}
                <MonoLink to={`${base}/groups`} className="text-ink-body">
                  {g}
                </MonoLink>
              </React.Fragment>
            ))}
          </span>
        ),
      },
      { id: 'lastSeen', header: 'Last sign-in', accessorKey: 'lastSeen', enableSorting: false, cell: ({ getValue }) => <span className="text-ink-muted">{getValue<string>()}</span> },
    ],
    [base],
  );

  return (
    <ProjectPage resource="users">
      <Page className="gap-4">
        <PageHeader
          title="Users"
          count={data?.length ?? 6}
          description="People and service identities in SCEAI. Access comes from group membership."
          actions={
            <Button onClick={readOnly}>
              <Plus size={16} />
              Create user
            </Button>
          }
        />
        {data ? <DataTable data={data} columns={columns} onRowClick={(u) => nav(`${base}/users/${u.username}`)} emptyTitle="No users yet" /> : <ListSkeleton rows={6} />}
      </Page>
    </ProjectPage>
  );
}

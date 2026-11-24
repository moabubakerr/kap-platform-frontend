import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { IconTile } from '@/components/common/primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useGrants, useGroups } from '@/api/identity';
import { groupMembers, roleTone, type Grant, type Group } from '@/mocks/identity';
import { Avatar, ListSkeleton, MonoLink, readOnly, resourceHref } from '@/features/users/identity-ui';

export default function GroupsPage() {
  const groups = useGroups();
  const grants = useGrants();
  const ready = groups.data && grants.data;

  return (
    <ProjectPage resource="groups">
      <Page className="gap-4">
        <PageHeader
          title="Groups"
          count={groups.data?.length ?? 3}
          description="Users join groups; groups receive roles on resources through access grants."
          actions={
            <Button onClick={readOnly}>
              <Plus size={16} />
              Create group
            </Button>
          }
        />
        {ready ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' }}>
            {groups.data!.map((g) => (
              <GroupCard key={g.name} g={g} grants={grants.data!.grants.filter((x) => x.group === g.name)} />
            ))}
          </div>
        ) : (
          <ListSkeleton rows={6} />
        )}
      </Page>
    </ProjectPage>
  );
}

function GroupCard({ g, grants }: { g: Group; grants: Grant[] }) {
  const base = useBase();
  const members = groupMembers(g.name);
  return (
    <section className="card flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <IconTile size={32}>
          <Users size={16} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-ink-strong">{g.name}</span>
            {g.platform && <Badge tone="neutral">platform</Badge>}
          </div>
          <div className="text-xs text-ink-muted">
            {members.length} {members.length === 1 ? 'member' : 'members'} · {grants.length} {grants.length === 1 ? 'grant' : 'grants'} · created {g.created}
          </div>
        </div>
      </div>
      <div className="text-[13px] text-ink-muted">{g.description}</div>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink-muted">Members</div>
        <div className="flex flex-col border-t border-line-subtle">
          {members.map((u) => (
            <Link key={u.username} to={`${base}/users/${u.username}`} className="flex items-center gap-2.5 border-b border-line-subtle py-1.5 text-[13px] hover:bg-surface-hover hover:no-underline">
              <Avatar name={u.username} size={22} />
              <span className="font-mono text-[12.5px] text-brand">{u.username}</span>
              <span className="min-w-0 flex-1 truncate text-ink-muted">{u.displayName}</span>
              <span className="text-xs text-ink-subtle">{u.lastSeen}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-muted">
          Grants
          <Link to={`${base}/grants`} className="font-medium text-brand">
            Open matrix
          </Link>
        </div>
        <div className="flex flex-col border-t border-line-subtle">
          {grants.map((x) => (
            <div key={x.id} className="grid items-center gap-2 border-b border-line-subtle py-1.5 text-[13px]" style={{ gridTemplateColumns: '52px auto minmax(0,1fr)' }}>
              <span className="font-mono text-[12px] text-ink-muted">{x.id}</span>
              <Badge tone={roleTone(x.role)}>{x.role}</Badge>
              <span className="min-w-0 truncate">
                {x.scope === 'ALL' ? (
                  <span className="text-ink-body">
                    <span className="font-mono text-[12px] text-ink-muted">ALL</span> · {x.note}
                  </span>
                ) : (
                  <>
                    <MonoLink to={resourceHref(base, x.resource!)}>{x.resource}</MonoLink>
                    <span className="text-ink-muted"> · {x.note}</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

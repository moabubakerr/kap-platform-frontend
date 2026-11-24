import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Plus, UserX } from 'lucide-react';
import { Page } from '@/components/common/layout';
import { EmptyState, Skeleton } from '@/components/common/primitives';
import { LinkTabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { useUserDetail } from '@/api/identity';
import type { UserDetail } from '@/mocks/identity';
import { Avatar, MonoLink, PlainTable, readOnly, resourceHref } from './identity-ui';

const TAB_LABEL: Record<string, string> = { profile: 'Profile', groups: 'Groups', tokens: 'API tokens', signin: 'Sign-in activity' };

const signsInWith = (auth: string) => (auth.startsWith('QDI') ? 'signs in with QDI' : auth === 'API token' ? 'authenticates with an API token' : `signs in with ${auth}`);

export default function UserDetailPage() {
  const { userId, tab = 'profile' } = useParams();
  const base = useBase();
  const { data, isLoading } = useUserDetail(userId);
  useCrumbs([data?.user.username ?? userId, TAB_LABEL[tab] ?? 'Profile']);

  return (
    <ProjectPage resource="users">
      <Page className="gap-4">
        {isLoading ? (
          <div className="card flex flex-col gap-3 p-4">
            <Skeleton className="h-11 w-80" />
            <Skeleton className="h-9" />
            <Skeleton className="h-40" />
          </div>
        ) : !data ? (
          <EmptyState
            icon={<UserX size={22} />}
            title="User not found"
            body={`There is no user called ${userId} in SCEAI.`}
            actions={
              <Button variant="outline" asChild>
                <Link to={`${base}/users`}>Back to users</Link>
              </Button>
            }
          />
        ) : (
          <UserCard d={data} tab={tab} base={base} />
        )}
      </Page>
    </ProjectPage>
  );
}

function UserCard({ d, tab, base }: { d: UserDetail; tab: string; base: string }) {
  const u = d.user;
  const tabs = [
    { value: 'profile', label: 'Profile' },
    { value: 'groups', label: 'Groups', badge: d.memberships.length },
    { value: 'tokens', label: 'API tokens', badge: d.tokens.length || undefined },
    { value: 'signin', label: 'Sign-in activity' },
  ];
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3.5 px-4 pb-1.5 pt-4">
        <Avatar name={u.username} size={44} tone="brand" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[15px] font-semibold text-ink-strong">{u.username}</span>
            <StatusPill status="approved" label="Active" />
          </div>
          <div className="text-[12.5px] text-ink-muted">{[u.displayName, u.email, signsInWith(u.auth)].filter(Boolean).join(' · ')}</div>
        </div>
        <Button variant="outline" onClick={readOnly}>
          <Pencil size={15} />
          Edit user
        </Button>
      </div>
      <div className="px-4">
        <LinkTabs items={tabs} base={`${base}/users/${u.username}`} />
      </div>
      {tab === 'groups' && <GroupsTab d={d} base={base} />}
      {tab === 'tokens' && <TokensTab d={d} base={base} />}
      {tab === 'signin' && <SignInTab d={d} />}
      {!['groups', 'tokens', 'signin'].includes(tab) && <ProfileTab d={d} />}
    </div>
  );
}

function ProfileTab({ d }: { d: UserDetail }) {
  const rows: [string, ReactNode][] = [
    ['User ID', <span className="font-mono text-[12.5px]">{d.id}</span>],
    ['Display name', d.user.displayName],
    ['Email', d.user.email ?? <span className="text-ink-subtle">Not set</span>],
    ['Authentication', d.user.auth],
    ['Tenant', 'SCEAI'],
    ['Created', d.created],
  ];
  return (
    <div className="grid gap-x-3.5 gap-y-2 p-4 text-[13px]" style={{ gridTemplateColumns: '140px 1fr' }}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <span className="text-ink-muted">{k}</span>
          <span className="min-w-0 break-words">{v}</span>
        </div>
      ))}
    </div>
  );
}

function GroupsTab({ d, base }: { d: UserDetail; base: string }) {
  return (
    <div className="grid gap-4 p-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
      <div>
        <div className="mb-2 text-xs font-semibold text-ink-muted">Groups · replaces User Groups</div>
        <div className="flex flex-col gap-2">
          {d.memberships.map((m) => (
            <div key={m.group} className="flex flex-wrap items-center gap-3 rounded-sm border border-line-subtle p-3">
              <MonoLink to={`${base}/groups`} className="font-semibold text-ink-strong">
                {m.group}
              </MonoLink>
              <span className="text-[12.5px] text-ink-muted">{m.added}</span>
              <button type="button" onClick={readOnly} className="ml-auto text-[12.5px] text-danger-fg hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={readOnly} className="mt-2.5 flex items-center gap-1.5 text-[13px] text-brand hover:underline">
          <Plus size={15} />
          Add to group
        </button>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold text-ink-muted">Effective permissions</div>
        {d.perms.map((p, i) => (
          <div key={i} className="grid gap-2 border-b border-line-subtle py-[7px] text-[13px]" style={{ gridTemplateColumns: '130px 1fr' }}>
            <span className="font-mono text-[12.5px]">{p.perm}</span>
            <span>
              <Link to={resourceHref(base, p.resource)} className="text-ink-body hover:text-brand hover:underline">
                {p.resource}
              </Link>
              <span className="block text-xs text-ink-muted">
                via {p.group} → {p.role}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokensTab({ d, base }: { d: UserDetail; base: string }) {
  if (d.tokens.length === 0)
    return (
      <div className="px-4 py-7 text-center text-[13px] text-ink-muted">
        {d.user.username} has no API tokens.
        <div className="mt-2.5">
          <Button variant="outline" onClick={readOnly}>
            <Plus size={15} />
            Create token
          </Button>
        </div>
      </div>
    );
  return (
    <div className="py-2">
      <PlainTable head={['Name', 'Prefix', 'Expires', 'Last used', 'Status', '']} minWidth={640}>
        {d.tokens.map((t) => (
          <tr key={t.name} className="border-t border-line-subtle">
            <td className="px-3 py-[9px]">
              <MonoLink to={`${base}/tokens`} className="font-semibold">
                {t.name}
              </MonoLink>
            </td>
            <td className="px-3 py-[9px] font-mono text-[12.5px] text-ink-muted">{t.prefix}</td>
            <td className="px-3 py-[9px]">{t.expires}</td>
            <td className="px-3 py-[9px] text-ink-muted">{t.lastUsed}</td>
            <td className="px-3 py-[9px]">
              <StatusPill status={t.status} label={t.statusLabel} />
            </td>
            <td className="px-3 py-[9px] text-right">
              <button type="button" onClick={readOnly} className="font-medium text-danger-fg hover:underline">
                Revoke
              </button>
            </td>
          </tr>
        ))}
      </PlainTable>
    </div>
  );
}

function SignInTab({ d }: { d: UserDetail }) {
  if (d.signins.length === 0) return <div className="px-4 py-7 text-center text-[13px] text-ink-muted">No sign-ins recorded in the last 30 days.</div>;
  return (
    <div className="py-2">
      {d.signins.map((x, i) => (
        <div key={i} className="grid items-center gap-3 border-t border-line-subtle px-4 py-2 text-[13px]" style={{ gridTemplateColumns: '170px 70px minmax(0,1fr) auto' }}>
          <span>{x.when}</span>
          <span>{x.method}</span>
          <span className="truncate font-mono text-[12.5px] text-ink-muted">{x.ip}</span>
          <StatusPill status={x.status} label={x.label} />
        </div>
      ))}
    </div>
  );
}

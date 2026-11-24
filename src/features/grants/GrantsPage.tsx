import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Shield, ShieldX } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useGrants } from '@/api/identity';
import { useUsers } from '@/api/core';
import { ROLES, permsFor, roleTone, type EffectivePerm, type Permission } from '@/mocks/identity';
import type { ConsoleUser } from '@/types';
import { Chip, ListSkeleton, MonoLink, SelectField, readOnly, resourceHref } from '@/features/users/identity-ui';

export default function GrantsPage() {
  const base = useBase();
  const { data } = useGrants();

  return (
    <ProjectPage resource="access grants">
      <Page className="gap-4">
        <PageHeader
          title="Access grants"
          description="Which groups hold which role on which resource. Users inherit access through their groups."
          actions={
            <Button onClick={readOnly}>
              <Plus size={16} />
              Create grant
            </Button>
          }
        />
        {data ? (
          <div className="card overflow-auto">
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 860 }}>
              <thead>
                <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
                  <th className="whitespace-nowrap px-3 py-[9px] font-semibold">Group</th>
                  {data.resources.map((c) => (
                    <th key={c.name} className="whitespace-nowrap px-3 py-[9px] font-semibold">
                      <div className="text-[11px] font-normal">{c.kindLabel}</div>
                      <MonoLink to={resourceHref(base, c.name)} className="text-ink-strong">
                        {c.name}
                      </MonoLink>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row) => (
                  <tr key={row.group} className="border-t border-line-subtle">
                    <td className="px-3 py-[9px]">
                      <MonoLink to={`${base}/groups`} className="font-semibold text-ink-strong">
                        {row.group}
                      </MonoLink>
                      <div className="text-xs text-ink-muted">{groupLabel(row.group)}</div>
                    </td>
                    {row.cells.map((r, i) => (
                      <td key={i} className="px-3 py-[9px]">
                        {r ? <Badge tone={roleTone(r)}>{r}</Badge> : <span className="text-ink-subtle">No access</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ListSkeleton rows={4} />
        )}
        <AccessChecker />
      </Page>
    </ProjectPage>
  );
}

const GROUP_LABEL: Record<string, string> = { tenant_admins: '1 member', catalog_readers: '2 members', ai_team: '3 members · platform' };
const groupLabel = (g: string) => GROUP_LABEL[g] ?? '';

type ResKind = 'agent' | 'collection';
const RESOURCES: { name: string; kind: ResKind }[] = [
  { name: 'sceai_indicators_oxford', kind: 'agent' },
  { name: 'sceai_indicators_agent', kind: 'agent' },
  { name: 'sceai_indicators', kind: 'collection' },
];
const ACTIONS: Record<ResKind, Permission[]> = {
  agent: ['agents.run', 'agents.write', 'agents.read'],
  collection: ['collections.read', 'collections.write'],
};
const VERB: Record<string, string> = { 'agents.run': 'run', 'agents.write': 'change', 'agents.read': 'read', 'collections.read': 'read', 'collections.write': 'change' };

const covers = (p: EffectivePerm, res: string) => p.covers === 'all' || p.covers.includes(res);
const grantChip = (p: EffectivePerm) => (p.grant.startsWith('G-') ? `grant ${p.grant} · ${p.role}` : `${p.grant} · ${p.role}`);

function AccessChecker() {
  const base = useBase();
  const { data: users } = useUsers();
  const [userName, setUserName] = React.useState('sceai_analyst');
  const [res, setRes] = React.useState('sceai_indicators_oxford');
  const kind = RESOURCES.find((r) => r.name === res)!.kind;
  const [action, setAction] = React.useState<Permission>('agents.run');
  const act = ACTIONS[kind].includes(action) ? action : ACTIONS[kind][0];

  const user: ConsoleUser | undefined = users?.find((u) => u.username === userName);
  const perms = user ? permsFor(user) : [];
  // A grant allows the action when it covers the resource and its role includes the permission.
  const hit = perms.find((p) => covers(p, res) && (p.perm === act || ROLES.find((r) => r.name === p.role)!.perms.includes(act)));
  const partial = !hit ? perms.find((p) => covers(p, res)) : undefined;
  const selW = 'min-w-[200px] flex-[1_1_200px] max-w-[280px]';

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="font-semibold text-ink-strong">Effective access checker</div>
      </div>
      <div className="flex flex-col gap-3.5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField label="User" value={userName} onChange={setUserName} className={selW} mono options={(users ?? []).map((u) => ({ value: u.username, label: u.username }))} />
          <SelectField label="Resource" value={res} onChange={setRes} className={selW} mono options={RESOURCES.map((r) => ({ value: r.name, label: r.name }))} />
          <SelectField label="Action" value={act} onChange={(v) => setAction(v)} className={selW} mono options={ACTIONS[kind].map((a) => ({ value: a, label: a }))} />
        </div>
        {user &&
          (hit ? (
            <div className="flex items-start gap-3 rounded-card border border-success-border bg-success-bg p-3.5">
              <span className="flex pt-0.5 text-success">
                <Shield size={16} />
              </span>
              <div className="text-[13.5px]">
                <div className="font-semibold text-success-fg">
                  Allowed · {user.username} can {VERB[act]} {res}
                </div>
                <PathChips user={user.username} p={hit} last={act} base={base} />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-card border border-danger-border bg-danger-bg p-3.5">
              <span className="flex pt-0.5 text-danger">
                <ShieldX size={16} />
              </span>
              <div className="text-[13.5px]">
                <div className="font-semibold text-danger-fg">
                  Denied · {user.username} cannot {VERB[act]} {res}
                </div>
                {partial ? (
                  <>
                    <PathChips user={user.username} p={partial} last={`no ${act}`} base={base} strike />
                    <div className="mt-1.5 text-[13px] text-ink-muted">
                      The {partial.role} role does not include <span className="font-mono text-[12.5px]">{act}</span>. Grant a role that does, or ask an administrator.
                    </div>
                  </>
                ) : (
                  <div className="mt-1.5 text-[13px] text-ink-muted">
                    None of {user.username}'s groups ({user.groups.join(', ')}) holds a grant on <span className="font-mono text-[12.5px]">{res}</span>.
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function PathChips({ user, p, last, base, strike }: { user: string; p: EffectivePerm; last: string; base: string; strike?: boolean }) {
  const arrow = <ArrowRight size={14} className="text-ink-muted" />;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
      <Link to={`${base}/users/${user}`} className="hover:no-underline">
        <Chip className="hover:border-brand">{user}</Chip>
      </Link>
      {arrow}
      <Link to={`${base}/groups`} className="hover:no-underline">
        <Chip className="hover:border-brand">member of {p.group}</Chip>
      </Link>
      {arrow}
      <Link to={`${base}/roles`} className="hover:no-underline">
        <Chip className="hover:border-brand">{grantChip(p)}</Chip>
      </Link>
      {arrow}
      <Chip className={strike ? 'border-danger-border text-danger-fg' : undefined}>{last}</Chip>
    </div>
  );
}

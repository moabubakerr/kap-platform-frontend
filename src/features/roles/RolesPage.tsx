import { Link } from 'react-router-dom';
import { Check, Minus, Plus, Shield } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { IconTile } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useRoles } from '@/api/identity';
import { PERMISSIONS } from '@/mocks/identity';
import { ListSkeleton, readOnly } from '@/features/users/identity-ui';

export default function RolesPage() {
  const base = useBase();
  const { data } = useRoles();
  return (
    <ProjectPage resource="roles">
      <Page className="gap-4">
        <PageHeader
          title="Roles"
          description="Permission bundles. Roles are assigned to groups through access grants."
          actions={
            <Button onClick={readOnly}>
              <Plus size={16} />
              Create role
            </Button>
          }
        />
        {data ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
            {data.map((r) => (
              <div key={r.name} className="card flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2.5">
                  <IconTile size={32}>
                    <Shield size={16} strokeWidth={1.75} />
                  </IconTile>
                  <div>
                    <div className="font-mono text-sm font-semibold text-ink-strong">{r.name}</div>
                    <Link to={`${base}/grants`} className="text-xs text-ink-muted hover:text-brand">
                      {r.grantsLabel}
                    </Link>
                  </div>
                </div>
                <div className="text-[13px] text-ink-muted">{r.description}</div>
                <div className="flex flex-col border-t border-line-subtle">
                  {PERMISSIONS.map((p) => {
                    const on = r.perms.includes(p);
                    return (
                      <div key={p} className="flex items-center justify-between border-b border-line-subtle py-1.5 text-[12.5px]">
                        <span className="font-mono" style={{ color: on ? 'var(--text-strong)' : 'var(--text-subtle)' }}>
                          {p}
                        </span>
                        <span className="flex" style={{ color: on ? 'var(--success)' : 'var(--border-strong)' }} aria-label={on ? 'Included' : 'Not included'}>
                          {on ? <Check size={14} /> : <Minus size={14} />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ListSkeleton rows={4} />
        )}
      </Page>
    </ProjectPage>
  );
}

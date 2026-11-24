import * as React from 'react';
import { Link } from 'react-router-dom';
import { Download, History } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { EmptyState } from '@/components/common/primitives';
import { Tooltip } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useAudit } from '@/api/governance';
import { userByName } from '@/mocks/core';
import { AUDIT_TARGET_LABEL, type AuditTarget } from '@/mocks/governance';
import { ListSkeleton, PillSelect, readOnly } from '@/features/users/identity-ui';

type Period = '30' | '7' | '90';
const daysAgo = (when: string) => Number(when.match(/(\d+)\s*d/)?.[1] ?? 0);

export default function AuditPage() {
  const base = useBase();
  const { data } = useAudit();
  const [who, setWho] = React.useState('any');
  const [type, setType] = React.useState<'any' | AuditTarget>('any');
  const [period, setPeriod] = React.useState<Period>('30');

  const whoOpts = React.useMemo(() => [{ value: 'any', label: 'anyone' }, ...[...new Set((data ?? []).map((a) => a.who))].map((w) => ({ value: w, label: w }))], [data]);
  const typeOpts = [{ value: 'any' as const, label: 'any' }, ...(Object.keys(AUDIT_TARGET_LABEL) as AuditTarget[]).map((t) => ({ value: t, label: AUDIT_TARGET_LABEL[t] }))];
  const rows = (data ?? []).filter((a) => (who === 'any' || a.who === who) && (type === 'any' || a.target === type) && daysAgo(a.when) <= Number(period));

  return (
    <ProjectPage resource="audit events">
      <Page className="gap-4">
        <PageHeader
          title="Audit log"
          description="Who changed what, and when, across SCEAI resources."
          actions={
            <Button variant="outline" onClick={readOnly}>
              <Download size={15} />
              Export
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2">
          <PillSelect prefix="Who: " value={who} options={whoOpts} onChange={setWho} active={who !== 'any'} />
          <PillSelect prefix="Resource type: " value={type} options={typeOpts} onChange={setType} active={type !== 'any'} />
          <PillSelect
            value={period}
            onChange={setPeriod}
            active
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
        </div>
        {!data ? (
          <ListSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<History size={22} />} title="No audit events match these filters" body="Widen the period or clear the Who and Resource type filters." />
        ) : (
          <div className="card py-2">
            {rows.map((a, i) => (
              <div key={i} className="grid gap-3 px-4 py-3" style={{ gridTemplateColumns: '120px 20px minmax(0,1fr)' }}>
                <div className="text-right text-[12.5px] text-ink-muted">
                  <Tooltip content={a.abs}>
                    <span>{a.when}</span>
                  </Tooltip>
                </div>
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                  <span className="mt-1 w-px flex-1 bg-line-subtle" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px]">
                    {userByName(a.who) ? (
                      <Link to={`${base}/users/${a.who}`} className="font-mono text-[12.5px] font-semibold text-ink-strong hover:text-brand">
                        {a.who}
                      </Link>
                    ) : (
                      <span className="font-mono text-[12.5px] font-semibold">{a.who}</span>
                    )}{' '}
                    {a.action}{' '}
                    <Link to={a.href ? `${base}/${a.href}` : base} className="font-mono text-[12.5px]">
                      {a.res}
                    </Link>
                  </div>
                  <div className="text-xs text-ink-muted">{a.meta}</div>
                  {a.before != null && (
                    <div className="mt-2.5 grid gap-2 font-mono text-xs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                      <div className="rounded-sm bg-danger-bg px-2.5 py-2">
                        <div className="mb-1 font-sans text-[11.5px] font-semibold text-danger-fg">Before</div>
                        {a.before}
                      </div>
                      <div className="rounded-sm bg-success-bg px-2.5 py-2">
                        <div className="mb-1 font-sans text-[11.5px] font-semibold text-success-fg">After</div>
                        {a.after}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Page>
    </ProjectPage>
  );
}

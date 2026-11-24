import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { useDefaultOverview } from '@/api/overview';
import { cn } from '@/lib/utils';

export default function DefaultOverviewPage() {
  const nav = useNavigate();
  const { data } = useDefaultOverview();
  return (
    <Page className="gap-4 pt-3">
      <PageHeader
        title="Default"
        badge={<Badge tone="neutral">System project</Badge>}
        description="Holds platform-wide defaults and service identities. It does not run agents or store tenant data."
        actions={
          <Button variant="outline" onClick={() => nav('/p/sceai')}>
            Switch to SCEAI
          </Button>
        }
      />
      <div className="flex items-start gap-2.5 rounded-card bg-info-bg px-3.5 py-3 text-[13px] text-info">
        <Info size={15} className="mt-px flex-none" />
        <div>New tenants copy these defaults when they are created. Changes here apply to future tenants only, not to SCEAI, Economic Affairs or sandbox.</div>
      </div>

      {!data ? (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[100px]" />
            ))}
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            {data.kpis.map((k) => (
              <div key={k.label} className="card px-4 py-3.5">
                <div className="text-[12.5px] text-ink-muted">{k.label}</div>
                <div className="mt-1 text-[28px] font-semibold leading-tight text-ink-strong">{k.value}</div>
                <div className="mt-0.5 text-xs text-ink-muted">{k.desc}</div>
              </div>
            ))}
          </div>

          <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
            <Panel title={`System identities · ${data.identities.length}`}>
              {data.identities.map((u) => (
                <Row key={u.name} right={<span className="whitespace-nowrap text-xs text-ink-muted">{u.last}</span>}>
                  <div className="font-mono text-[12.5px] font-semibold text-ink-strong">{u.name}</div>
                  <div className="text-xs text-ink-muted">{u.desc}</div>
                </Row>
              ))}
            </Panel>

            <Panel title="Default model providers">
              {data.models.map((m) => (
                <Row key={m.name} right={<StatusPill status="healthy" />}>
                  <div className="font-mono text-[12.5px] font-semibold text-ink-strong">{m.name}</div>
                  <div className="text-xs text-ink-muted">{m.desc}</div>
                </Row>
              ))}
            </Panel>

            <Panel title="Default queue policies">
              <div className="grid gap-x-4 gap-y-2.5 px-4 py-3.5 text-[13px]" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                {data.queues.map((q) => (
                  <React.Fragment key={q.key}>
                    <span className="text-ink-muted">{q.key}</span>
                    <span className="text-right font-mono text-[12.5px]">{q.value}</span>
                  </React.Fragment>
                ))}
              </div>
            </Panel>

            <Panel title="Tenants created from these defaults">
              {data.tenants.map((t) => (
                <Row
                  key={t.name}
                  onClick={t.projectKey ? () => nav(`/p/${t.projectKey}`) : undefined}
                  right={<span className="whitespace-nowrap text-xs text-ink-muted">{t.when}</span>}
                >
                  <div className="font-semibold text-ink-strong">{t.name}</div>
                  <div className="text-xs text-ink-muted">{t.desc}</div>
                </Row>
              ))}
            </Panel>
          </div>
        </>
      )}
    </Page>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card min-w-0">
      <div className="border-b border-line-subtle px-4 py-3.5 font-semibold text-ink-strong">{title}</div>
      {children}
    </div>
  );
}

function Row({ children, right, onClick }: { children: React.ReactNode; right: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'grid items-center gap-3 border-t border-line-subtle px-4 py-2.5',
        onClick && 'cursor-pointer hover:bg-surface-hover',
      )}
      style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}
    >
      <div className="min-w-0">{children}</div>
      {right}
    </div>
  );
}

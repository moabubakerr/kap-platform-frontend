import { useNavigate } from 'react-router-dom';
import { Building2, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { usePlatformProjects } from '@/api/platform';
import { cn } from '@/lib/utils';

export default function ProjectsPage() {
  const nav = useNavigate();
  const { data } = usePlatformProjects();

  return (
    <Page className="gap-4 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <h1 className="h1">
            Projects <span className="text-[15px] font-medium text-ink-muted">{data?.projects.length ?? 4}</span>
          </h1>
          <p className="mt-1 text-ink-muted">
            Projects running on the KAP platform. Each project has its own agents, data, users and queue limits. Visible to the AI team only.
          </p>
        </div>
        <Button onClick={() => toast('Read-only in this version')}>
          <Plus size={15} />
          Create project
        </Button>
      </div>

      {!data ? (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[136px]" />
            ))}
          </div>
          <Skeleton className="h-36" />
        </>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
            {data.projects.map((t) => (
              <div
                key={t.name}
                role="link"
                tabIndex={0}
                onClick={() => (t.projectKey ? nav(`/p/${t.projectKey}`) : toast('Not in this prototype'))}
                onKeyDown={(e) => e.key === 'Enter' && (t.projectKey ? nav(`/p/${t.projectKey}`) : toast('Not in this prototype'))}
                className={cn(
                  'flex cursor-pointer flex-col gap-3 rounded-card border bg-surface p-4 hover:border-brand',
                  t.current ? 'border-brand' : 'border-line-subtle',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-card bg-surface-sunken text-ink-muted">
                    <Building2 size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-ink-strong">{t.name}</div>
                    <div className="text-[12.5px] text-ink-muted">{t.desc}</div>
                  </div>
                  <StatusPill status={t.status} label={t.statusLabel} />
                </div>
                <div className="grid grid-cols-4 gap-2 border-t border-line-subtle pt-3">
                  {(
                    [
                      ['Users', t.users],
                      ['Agents', t.agents],
                      ['Collections', t.collections],
                      ['Jobs today', t.jobsToday],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <div className="truncate text-[11.5px] text-ink-muted">{k}</div>
                      <div className="text-[17px] font-semibold text-ink-strong">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
              <div className="font-semibold text-ink-strong">Last provisioned · {data.lastProvisioned.project}</div>
              <span className="text-[12.5px] text-ink-muted">{data.lastProvisioned.note}</span>
            </div>
            <div className="grid gap-x-6 gap-y-1 px-4 py-3 text-[13px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {data.lastProvisioned.steps.map((p) => (
                <div key={p} className="flex items-center gap-2 py-[5px]">
                  <span className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-success text-white">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

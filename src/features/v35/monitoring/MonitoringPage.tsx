import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { useJobs } from '@/api/core';
import { ScreenView } from '@/engine/ScreenView';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/common/layout';
import type { ScreenModel } from '@/engine/types';
import { JOB_FILTERS_DEFAULT, jobsScreen, MONITOR_TABS, tracesScreen, type JobFilters } from './build';

/** Monitoring & Insights: Jobs · Traces · Sessions · Knowledge Gaps (route /monitoring/:tab?). */
export default function MonitoringPage() {
  const { tab = 'jobs' } = useParams();
  const base = useBase();
  const scope = useScope();
  const nav = useNavigate();
  const live = scope.kind === 'project' && !!scope.project.live;
  const { data: jobs, isLoading, isError, refetch } = useJobs();
  const [f, setF] = React.useState<JobFilters>(JOB_FILTERS_DEFAULT);
  const current = MONITOR_TABS.find((t) => t.value === tab)?.value ?? 'jobs';
  useCrumbs([MONITOR_TABS.find((t) => t.value === current)?.label]);

  const head = {
    title: 'Monitoring & Insights',
    tabs: MONITOR_TABS,
    tab: current,
    setTab: (v: string) => nav(v === 'jobs' ? `${base}/monitoring` : `${base}/monitoring/${v}`),
  };
  const ctx = {
    head,
    live,
    openRun: (id: string, t?: string) => nav(`${base}/monitoring/runs/${id}${t ? `/${t}` : ''}`),
    openAgent: (a: string) => nav(`${base}/agents/${a}`),
  };

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-20" />
        <Skeleton className="h-[420px]" />
      </Page>
    );
  }
  if (isError) {
    return (
      <Page>
        <EmptyState
          icon={<Activity size={22} />}
          title="Cannot reach the platform API"
          body="Live executions come from the platform API on the test stand. Check that it is running and that the console's server has PLATFORM_API_KEY."
          actions={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      </Page>
    );
  }

  let model: ScreenModel;
  if (current === 'traces') model = tracesScreen(jobs ?? [], f, setF, ctx);
  else if (current === 'jobs') model = jobsScreen(jobs ?? [], f, setF, ctx);
  else
    model = {
      head,
      sections: [
        current === 'sessions'
          ? { callout: 'Ask AI sessions are being ported to this view. The current conversation list is available meanwhile.', sacts: [{ l: 'Open conversations', f: () => nav(`${base}/conversations`), v: 'outline' }], title: 'Sessions' }
          : { callout: 'Knowledge gaps — questions the agents could not answer from the available data — are being ported to this view.', title: 'Knowledge gaps' },
      ],
    };
  if (live) model.head = { ...model.head, sub: undefined };

  return (
    <>
      {live && (
        <div className="px-8 pt-3">
          <Badge tone="success">Live · test stand · refreshes every 10 s</Badge>
        </div>
      )}
      <ScreenView model={model} />
    </>
  );
}

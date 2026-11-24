import * as React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Bot, CopyPlus, Download, Ellipsis, FlaskConical, Pencil, Trash2 } from 'lucide-react';
import { Page } from '@/components/common/layout';
import { CopyId, EmptyState, Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { LinkTabs, type TabItem } from '@/components/ui/tabs';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { useAgentDetail } from '@/api/agents';
import { readOnly } from './shared';
import { OverviewTab } from './OverviewTab';
import { AccessTab, ConfigTab, JobsTab, MetricsTab, ToolsTab, VersionsTab } from './DetailTabs';

const TAB_LABEL: Record<string, string> = {
  overview: 'Overview',
  config: 'Configuration',
  tools: 'Tools & collections',
  access: 'Access',
  jobs: 'Jobs',
  metrics: 'Metrics',
  versions: 'Versions',
};

export default function AgentDetailPage() {
  return (
    <ProjectPage resource="agents">
      <AgentDetail />
    </ProjectPage>
  );
}

function AgentDetail() {
  const { agentId, tab = 'overview' } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const { data: d, isLoading } = useAgentDetail(agentId);
  const [runSignal, setRunSignal] = React.useState(0);

  const isPipe = d?.agent.kind === 'pipeline';
  const tabLabel = tab === 'jobs' && isPipe ? 'Calls' : TAB_LABEL[tab];
  useCrumbs([d?.agent.name ?? agentId, tabLabel]);

  if (isLoading) {
    return (
      <Page className="gap-4 pt-3">
        <Skeleton className="h-14 w-[480px]" />
        <Skeleton className="h-10" />
        <Skeleton className="h-[420px]" />
      </Page>
    );
  }
  const agentBase = `${base}/agents/${agentId}`;
  if (!d) {
    return (
      <Page>
        <EmptyState
          title="Agent not found"
          body={`No agent named ${agentId} in this project.`}
          actions={<Button onClick={() => nav(`${base}/agents`)}>Back to agents</Button>}
        />
      </Page>
    );
  }
  if (!TAB_LABEL[tab]) return <Navigate to={agentBase} replace />;

  const a = d.agent;
  const tabs: TabItem[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'config', label: 'Configuration' },
    { value: 'tools', label: 'Tools & collections', badge: a.toolsCount ?? undefined },
    { value: 'access', label: 'Access' },
    { value: 'jobs', label: isPipe ? 'Calls' : 'Jobs', badge: d.jobs7d },
    { value: 'metrics', label: 'Metrics' },
    { value: 'versions', label: 'Versions', badge: d.versions.length },
  ];

  const startTest = () => {
    if (tab !== 'overview') nav(agentBase, { replace: true });
    setRunSignal((n) => n + 1);
  };

  return (
    <Page className="gap-4 pt-3">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3.5">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-card bg-[#F6E8EC] text-[#8A1538]">
          <Bot size={24} strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 break-all font-mono text-[22px] font-semibold text-ink-strong">{a.name}</h1>
            <StatusPill status="active" />
          </div>
          <div className="text-ink-muted">{d.headline}</div>
          <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 whitespace-nowrap text-[12.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              ID <CopyId id={d.displayId} />
            </span>
            <span>Project SCEAI</span>
            <span>
              Type <span className="font-mono">{a.type}</span>
            </span>
            <span>Created {d.created}</span>
            <span>Modified {d.modified}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={readOnly}>
            <Pencil size={15} />
            Edit
          </Button>
          <Button onClick={startTest}>
            <FlaskConical size={15} />
            Test agent
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="quiet" size="icon" aria-label="More actions">
                <Ellipsis size={16} />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={readOnly}>
                <CopyPlus size={15} />
                Duplicate
              </MenuItem>
              <MenuItem onSelect={() => nav(`${agentBase}/config`)}>
                <Download size={15} />
                View JSON
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={readOnly} className="text-danger-fg">
                <Trash2 size={15} />
                Delete agent
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      <LinkTabs items={tabs} base={agentBase} />

      {tab === 'overview' && <OverviewTab d={d} runSignal={runSignal} onTab={(t) => nav(`${agentBase}/${t}`, { replace: true })} />}
      {tab === 'config' && <ConfigTab d={d} />}
      {tab === 'tools' && <ToolsTab d={d} />}
      {tab === 'access' && <AccessTab d={d} />}
      {tab === 'jobs' && <JobsTab d={d} />}
      {tab === 'metrics' && <MetricsTab d={d} />}
      {tab === 'versions' && <VersionsTab d={d} />}
    </Page>
  );
}

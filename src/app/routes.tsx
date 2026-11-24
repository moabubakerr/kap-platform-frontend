import * as React from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { PlatformLayout, ProjectLayout, useScope } from './shell/AppShell';
import { Page } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';

const L = (f: () => Promise<{ default: React.ComponentType }>) => {
  const C = React.lazy(f);
  return (
    <React.Suspense fallback={<PageSkeleton />}>
      <C />
    </React.Suspense>
  );
};

function PageSkeleton() {
  return (
    <Page>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </Page>
  );
}

/** Project overview: SCEAI dashboard, or the Default system-project overview. */
function ProjectHome() {
  const s = useScope();
  if (s.kind === 'project' && s.project.live) return <Navigate to={`/p/${s.project.key}/jobs`} replace />;
  return s.kind === 'project' && s.project.key === 'default'
    ? L(() => import('@/features/overview/DefaultOverviewPage'))
    : L(() => import('@/features/overview/OverviewPage'));
}

function TracesIndex() {
  const { projectId } = useParams();
  const s = useScope();
  // live tenants have no designed sample trace: pick a job from the list instead
  if (s.kind === 'project' && s.project.live) return <Navigate to={`/p/${projectId}/jobs`} replace />;
  return <Navigate to={`/p/${projectId}/traces/93c7a1f2`} replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/p/sceai" replace /> },
  {
    path: '/platform',
    element: <PlatformLayout />,
    children: [
      { index: true, element: L(() => import('@/features/platform/PlatformOverviewPage')) },
      { path: 'projects', element: L(() => import('@/features/platform/ProjectsPage')) },
      { path: 'models', element: L(() => import('@/features/platform/ModelServingPage')) },
      { path: 'mcp', element: L(() => import('@/features/platform/McpRegistryPage')) },
      { path: 'queues', element: L(() => import('@/features/platform/QueuesPage')) },
      { path: 'users', element: L(() => import('@/features/platform/PlatformUsersPage')) },
      { path: 'audit', element: L(() => import('@/features/platform/PlatformAuditPage')) },
      { path: '*', element: <Navigate to="/platform" replace /> },
    ],
  },
  {
    path: '/p/:projectId',
    element: <ProjectLayout />,
    children: [
      { index: true, element: <ProjectHome /> },
      { path: 'map', element: L(() => import('@/features/agents-map/AgentsMapPage')) },
      { path: 'traces', element: <TracesIndex /> },
      { path: 'traces/:jobId/:tab?', element: L(() => import('@/features/traces/TracePage')) },
      { path: 'conversations', element: L(() => import('@/features/conversations/ConversationsPage')) },
      { path: 'conversations/:msgId', element: L(() => import('@/features/conversations/MessagePage')) },
      { path: 'feedback', element: L(() => import('@/features/feedback/FeedbackPage')) },
      { path: 'catalogue', element: L(() => import('@/features/catalogue/CataloguePage')) },
      { path: 'catalogue/publish', element: L(() => import('@/features/catalogue/PublishPage')) },
      { path: 'catalogue/:code', element: L(() => import('@/features/catalogue/CatalogueEntryPage')) },
      { path: 'agents', element: L(() => import('@/features/agents/AgentsPage')) },
      { path: 'agents/new', element: L(() => import('@/features/agents/CreateAgentPage')) },
      { path: 'agents/:agentId/:tab?', element: L(() => import('@/features/agents/AgentDetailPage')) },
      { path: 'providers', element: L(() => import('@/features/providers/ProvidersPage')) },
      { path: 'mcp', element: L(() => import('@/features/mcp/McpPage')) },
      { path: 'collections', element: L(() => import('@/features/collections/CollectionsPage')) },
      { path: 'collections/:collectionId/:tab?', element: L(() => import('@/features/collections/CollectionDetailPage')) },
      { path: 'connectors', element: L(() => import('@/features/connectors/ConnectorsPage')) },
      { path: 'pipelines', element: L(() => import('@/features/pipelines/PipelinesPage')) },
      { path: 'indicators', element: L(() => import('@/features/indicators/IndicatorsPage')) },
      { path: 'indicators/:indicatorId', element: L(() => import('@/features/indicators/IndicatorDetailPage')) },
      { path: 'packages', element: L(() => import('@/features/packages/PackagesPage')) },
      { path: 'jobs', element: L(() => import('@/features/jobs/JobsPage')) },
      { path: 'ingestion', element: L(() => import('@/features/ingestion/IngestionJobsPage')) },
      { path: 'users', element: L(() => import('@/features/users/UsersPage')) },
      { path: 'users/:userId/:tab?', element: L(() => import('@/features/users/UserDetailPage')) },
      { path: 'groups', element: L(() => import('@/features/groups/GroupsPage')) },
      { path: 'roles', element: L(() => import('@/features/roles/RolesPage')) },
      { path: 'grants', element: L(() => import('@/features/grants/GrantsPage')) },
      { path: 'tokens', element: L(() => import('@/features/tokens/TokensPage')) },
      { path: 'audit', element: L(() => import('@/features/audit/AuditPage')) },
      { path: 'configs', element: L(() => import('@/features/configs/ConfigsPage')) },
      { path: 'reports', element: L(() => import('@/features/reports/ReportsPage')) },
      { path: 'settings', element: L(() => import('@/features/settings/SettingsPage')) },
      { path: '*', element: <Navigate to="." replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/p/sceai" replace /> },
]);

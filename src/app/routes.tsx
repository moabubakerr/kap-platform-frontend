import * as React from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { PlatformLayout, ProjectLayout, ProjectPage, useScope } from './shell/AppShell';
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

const porting = () => L(() => import('@/features/v35/Porting'));

/** Tenant dashboard: SCEAI dashboard (v1), Default system overview, or a sample-tenant notice. */
function TenantHome() {
  const s = useScope();
  if (s.kind === 'project' && s.project.live) return <Navigate to={`/p/${s.project.key}/monitoring`} replace />;
  if (s.kind === 'project' && s.project.key === 'default') return L(() => import('@/features/overview/DefaultOverviewPage'));
  if (s.kind === 'project' && s.project.sample) return <ProjectPage resource="dashboards">{null}</ProjectPage>;
  return L(() => import('@/features/overview/OverviewPage'));
}

/** Old v1 paths → v35 paths (keeps links and bookmarks working). */
function Moved({ to }: { to: string }) {
  const { projectId, jobId, tab } = useParams();
  const target = to.replace(':projectId', projectId ?? 'sceai').replace(':jobId', jobId ?? '').replace('/:tab', tab ? `/${tab}` : '');
  return <Navigate to={target} replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/platform" replace /> },
  {
    path: '/platform',
    element: <PlatformLayout />,
    children: [
      { index: true, element: L(() => import('@/features/platform/PlatformOverviewPage')) },
      { path: 'tenants', element: L(() => import('@/features/platform/ProjectsPage')) },
      { path: 'models', element: L(() => import('@/features/platform/ModelServingPage')) },
      { path: 'mcp', element: L(() => import('@/features/platform/McpRegistryPage')) },
      { path: 'admins', element: L(() => import('@/features/platform/PlatformUsersPage')) },
      { path: 'identity', element: porting() },
      { path: 'configuration', element: porting() },
      { path: 'monitoring', element: L(() => import('@/features/platform/QueuesPage')) },
      { path: 'audit', element: L(() => import('@/features/platform/PlatformAuditPage')) },
      { path: 'secrets', element: porting() },
      { path: 'licenses', element: porting() },
      // v1 paths
      { path: 'projects', element: <Navigate to="/platform/tenants" replace /> },
      { path: 'users', element: <Navigate to="/platform/admins" replace /> },
      { path: 'queues', element: <Navigate to="/platform/monitoring" replace /> },
      { path: '*', element: <Navigate to="/platform" replace /> },
    ],
  },
  {
    path: '/p/:projectId',
    element: <ProjectLayout />,
    children: [
      { index: true, element: <TenantHome /> },
      // Data Ingestion Hub
      { path: 'sources', element: L(() => import('@/features/connectors/ConnectorsPage')) },
      { path: 'pipelines', element: L(() => import('@/features/pipelines/PipelinesPage')) },
      { path: 'runs', element: L(() => import('@/features/ingestion/IngestionJobsPage')) },
      // Business Data Hub
      { path: 'collections', element: L(() => import('@/features/collections/CollectionsPage')) },
      { path: 'collections/:collectionId/:tab?', element: L(() => import('@/features/collections/CollectionDetailPage')) },
      { path: 'structured', element: L(() => import('@/features/indicators/IndicatorsPage')) },
      { path: 'structured/:indicatorId', element: L(() => import('@/features/indicators/IndicatorDetailPage')) },
      { path: 'unstructured', element: porting() },
      { path: 'entities', element: porting() },
      { path: 'catalogue', element: L(() => import('@/features/catalogue/CataloguePage')) },
      { path: 'catalogue/publish', element: L(() => import('@/features/catalogue/PublishPage')) },
      { path: 'catalogue/:code', element: L(() => import('@/features/catalogue/CatalogueEntryPage')) },
      // AI Agent Factory
      { path: 'agents', element: L(() => import('@/features/agents/AgentsPage')) },
      { path: 'agents/new', element: L(() => import('@/features/agents/CreateAgentPage')) },
      { path: 'agents/:agentId/:tab?', element: L(() => import('@/features/agents/AgentDetailPage')) },
      { path: 'workflows', element: L(() => import('@/features/agents-map/AgentsMapPage')) },
      { path: 'tools', element: L(() => import('@/features/mcp/McpPage')) },
      { path: 'schedules', element: L(() => import('@/features/reports/ReportsPage')) },
      { path: 'monitoring', element: L(() => import('@/features/v35/monitoring/MonitoringPage')) },
      { path: 'monitoring/runs/:jobId/:tab?', element: L(() => import('@/features/v35/monitoring/RunPage')) },
      { path: 'monitoring/:tab', element: L(() => import('@/features/v35/monitoring/MonitoringPage')) },
      { path: 'conversations', element: L(() => import('@/features/conversations/ConversationsPage')) },
      { path: 'conversations/:msgId', element: L(() => import('@/features/conversations/MessagePage')) },
      // AI Governance, AI Confidence Hub
      { path: 'policies', element: porting() },
      { path: 'confidence', element: porting() },
      { path: 'evidence', element: porting() },
      { path: 'feedback', element: L(() => import('@/features/feedback/FeedbackPage')) },
      // User & Permission Management
      { path: 'users', element: L(() => import('@/features/users/UsersPage')) },
      { path: 'users/:userId/:tab?', element: L(() => import('@/features/users/UserDetailPage')) },
      { path: 'groups', element: L(() => import('@/features/groups/GroupsPage')) },
      { path: 'roles', element: L(() => import('@/features/roles/RolesPage')) },
      { path: 'service-accounts', element: L(() => import('@/features/tokens/TokensPage')) },
      // Tenant Administration
      { path: 'configuration', element: L(() => import('@/features/settings/SettingsPage')) },
      { path: 'audit', element: L(() => import('@/features/audit/AuditPage')) },
      { path: 'security', element: porting() },
      // v1 paths → v35
      { path: 'jobs', element: <Moved to="/p/:projectId/monitoring" /> },
      { path: 'traces', element: <Moved to="/p/:projectId/monitoring/traces" /> },
      { path: 'traces/:jobId/:tab?', element: <Moved to="/p/:projectId/monitoring/runs/:jobId/trace" /> },
      { path: 'map', element: <Moved to="/p/:projectId/workflows" /> },
      { path: 'connectors', element: <Moved to="/p/:projectId/sources" /> },
      { path: 'ingestion', element: <Moved to="/p/:projectId/runs" /> },
      { path: 'packages', element: <Moved to="/p/:projectId/pipelines" /> },
      { path: 'indicators', element: <Moved to="/p/:projectId/structured" /> },
      { path: 'indicators/:jobId', element: <Moved to="/p/:projectId/structured/:jobId" /> },
      { path: 'mcp', element: <Moved to="/p/:projectId/tools" /> },
      { path: 'providers', element: <Navigate to="/platform/models" replace /> },
      { path: 'reports', element: <Moved to="/p/:projectId/schedules" /> },
      { path: 'tokens', element: <Moved to="/p/:projectId/service-accounts" /> },
      { path: 'grants', element: <Moved to="/p/:projectId/groups" /> },
      { path: 'configs', element: <Moved to="/p/:projectId/configuration" /> },
      { path: 'settings', element: <Moved to="/p/:projectId/configuration" /> },
      { path: '*', element: <Navigate to="." replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/platform" replace /> },
]);

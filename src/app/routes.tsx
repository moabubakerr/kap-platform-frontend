import * as React from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { PlatformLayout, ProjectLayout, useScope } from './shell/AppShell';
import { Page } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';

type PageModule = { default: React.ComponentType };

const L = (f: () => Promise<PageModule>) => {
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

// Every v35 page, each loaded on first use.
const V35_PAGES = import.meta.glob<PageModule>('../features/v35/**/*Page.tsx');
/** v35 screen at src/features/v35/<path>.tsx */
const V = (path: string) => {
  const load = V35_PAGES[`../features/v35/${path}.tsx`];
  if (!load) throw new Error(`No v35 page ${path}`);
  return L(load);
};

/** Tenant landing: the Default system tenant has its own overview; others the v35 dashboard. */
function TenantHome() {
  const s = useScope();
  if (s.kind === 'project' && s.project.key === 'default') return V('platform/DefaultTenantPage');
  return V('platform/TenantDashboardPage');
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
      { index: true, element: V('platform/PlatformHomePage') },
      { path: 'tenants', element: V('platform/TenantsPage') },
      { path: 'models/:tab?', element: V('platform/ModelsRegistryPage') },
      { path: 'mcp/:tab?', element: V('platform/McpRegistryPage') },
      { path: 'admins', element: V('iam/PlatformAdminsPage') },
      { path: 'identity', element: V('iam/IdentityProvidersPage') },
      { path: 'configuration/:tab?', element: V('admin/PlatformConfigPage') },
      { path: 'monitoring/:tab?', element: V('admin/PlatformMonitoringPage') },
      { path: 'audit', element: V('admin/PlatformAuditPage') },
      { path: 'secrets/:tab?', element: V('admin/PlatformSecretsPage') },
      { path: 'licenses', element: V('admin/LicensesPage') },
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
      { path: 'sources', element: V('ingest/SourcesPage') },
      { path: 'sources/:sourceId/:tab?', element: V('ingest/SourcePage') },
      { path: 'pipelines', element: V('ingest/PipelinesPage') },
      { path: 'pipelines/:pipelineId/:tab?', element: V('ingest/PipelinePage') },
      { path: 'runs', element: V('ingest/RunsPage') },
      { path: 'runs/:runId/:tab?', element: V('ingest/IngestRunPage') },
      // Business Data Hub
      { path: 'collections', element: V('data/CollectionsPage') },
      { path: 'collections/:collectionId/:tab?', element: V('data/CollectionPage') },
      { path: 'structured', element: V('data/DatasetsPage') },
      { path: 'structured/:datasetId/:tab?', element: V('data/DatasetPage') },
      { path: 'unstructured', element: V('data/DocumentsPage') },
      { path: 'unstructured/:documentId/:tab?', element: V('data/DocumentPage') },
      { path: 'entities', element: V('data/EntitiesPage') },
      { path: 'catalogue', element: L(() => import('@/features/catalogue/CataloguePage')) },
      { path: 'catalogue/publish', element: L(() => import('@/features/catalogue/PublishPage')) },
      { path: 'catalogue/:code', element: L(() => import('@/features/catalogue/CatalogueEntryPage')) },
      // AI Agent Factory
      { path: 'agents', element: V('agents/AgentsPage') },
      { path: 'agents/evaluation', element: V('agents/EvalSetsPage') },
      { path: 'agents/evaluation/runs/:runId', element: V('agents/EvalRunPage') },
      { path: 'agents/evaluation/:setId', element: V('agents/EvalSetPage') },
      { path: 'agents/:agentId/:tab?', element: V('agents/AgentPage') },
      { path: 'playground', element: V('playground/PlaygroundPage') },
      { path: 'workflows', element: V('workflows/WorkflowsPage') },
      { path: 'workflows/map', element: V('workflows/AgentsMapPage') },
      { path: 'workflows/ask-ai-pipeline', element: L(() => import('@/features/agents-map/AgentsMapPage')) },
      { path: 'workflows/:workflowId/runs/:runId', element: V('workflows/WorkflowRunPage') },
      { path: 'workflows/:workflowId/:tab?', element: V('workflows/WorkflowPage') },
      { path: 'tools', element: V('tools/ToolsPage') },
      { path: 'tools/mcp/:serverId?', element: V('tools/McpConnectionsPage') },
      { path: 'schedules', element: V('tools/SchedulesPage') },
      { path: 'schedules/reports', element: V('tools/ScheduledReportsPage') },
      { path: 'monitoring', element: V('monitoring/MonitoringPage') },
      { path: 'monitoring/runs/:jobId/:tab?', element: V('monitoring/RunPage') },
      { path: 'monitoring/:tab', element: V('monitoring/MonitoringPage') },
      { path: 'conversations', element: L(() => import('@/features/conversations/ConversationsPage')) },
      { path: 'conversations/:msgId', element: L(() => import('@/features/conversations/MessagePage')) },
      // AI Governance, AI Confidence Hub
      { path: 'policies', element: V('confidence/PoliciesPage') },
      { path: 'confidence', element: V('confidence/ConfidencePage') },
      { path: 'evidence', element: V('confidence/EvidencePage') },
      { path: 'feedback', element: V('confidence/FeedbackPage') },
      // User & Permission Management
      { path: 'users', element: V('iam/UsersPage') },
      { path: 'users/:userId/:tab?', element: V('iam/UserPage') },
      { path: 'groups', element: V('iam/GroupsPage') },
      { path: 'groups/:groupId/:tab?', element: V('iam/GroupPage') },
      { path: 'roles', element: V('iam/RolesPage') },
      { path: 'service-accounts', element: V('iam/ServiceAccountsPage') },
      { path: 'service-accounts/:saId/:tab?', element: V('iam/ServiceAccountPage') },
      // Tenant Administration
      { path: 'configuration/:tab?', element: V('admin/TenantConfigPage') },
      { path: 'audit', element: V('admin/TenantAuditPage') },
      { path: 'security/:tab?', element: V('admin/TenantSecurityPage') },
      // v1 paths → v35
      { path: 'agents/new', element: <Moved to="/p/:projectId/agents" /> },
      { path: 'jobs', element: <Moved to="/p/:projectId/monitoring" /> },
      { path: 'traces', element: <Moved to="/p/:projectId/monitoring/traces" /> },
      { path: 'traces/:jobId/:tab?', element: <Moved to="/p/:projectId/monitoring/runs/:jobId/trace" /> },
      { path: 'map', element: <Moved to="/p/:projectId/workflows/map" /> },
      { path: 'connectors', element: <Moved to="/p/:projectId/sources" /> },
      { path: 'ingestion', element: <Moved to="/p/:projectId/runs" /> },
      { path: 'packages', element: <Moved to="/p/:projectId/pipelines" /> },
      { path: 'indicators', element: <Moved to="/p/:projectId/structured" /> },
      { path: 'indicators/:jobId', element: <Moved to="/p/:projectId/structured" /> },
      { path: 'mcp', element: <Moved to="/p/:projectId/tools/mcp" /> },
      { path: 'providers', element: <Navigate to="/platform/models" replace /> },
      { path: 'reports', element: <Moved to="/p/:projectId/schedules/reports" /> },
      { path: 'tokens', element: <Moved to="/p/:projectId/service-accounts" /> },
      { path: 'grants', element: <Moved to="/p/:projectId/groups" /> },
      { path: 'configs', element: <Moved to="/p/:projectId/configuration/history" /> },
      { path: 'settings', element: <Moved to="/p/:projectId/configuration" /> },
      { path: '*', element: <Navigate to="." replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/platform" replace /> },
]);

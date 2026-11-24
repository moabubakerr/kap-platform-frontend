import * as React from 'react';
import { Outlet, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { CrumbProvider, useCrumbExtra } from './crumbs';
import { PLATFORM_NAV, PROJECT_NAV, crumbsFor } from '../nav';
import { projectByKey, type Project } from '@/mocks/projects';
import { EmptyState } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/common/layout';

type Scope = { kind: 'platform' } | { kind: 'project'; project: Project };

const ScopeCtx = React.createContext<Scope>({ kind: 'platform' });
const PaletteCtx = React.createContext<() => void>(() => {});
/** Opens the Ctrl+K command palette from anywhere inside the shell. */
export const useOpenPalette = () => React.useContext(PaletteCtx);
/** Current scope; inside project routes `project` is always set. */
export const useScope = () => React.useContext(ScopeCtx);
export const useProject = () => {
  const s = useScope();
  if (s.kind !== 'project') throw new Error('useProject outside a project route');
  return s.project;
};
/** Base path of the current project, e.g. /p/sceai */
export const useBase = () => {
  const s = useScope();
  return s.kind === 'project' ? `/p/${s.project.key}` : '/platform';
};

function Shell({ scope }: { scope: Scope }) {
  const [palette, setPalette] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const { pathname } = useLocation();
  const mainRef = React.useRef<HTMLElement>(null);
  const openPalette = React.useCallback(() => setPalette(true), []);

  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Scroll to top on navigation between pages (not tab changes within a page).
  const pageKey = pathname.split('/').slice(0, 5).join('/');
  React.useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pageKey]);

  const isPlatform = scope.kind === 'platform';
  const project = scope.kind === 'project' ? scope.project : undefined;
  const base = isPlatform ? '/platform' : `/p/${project!.key}`;
  const identity = isPlatform
    ? { kind: 'Platform', name: 'KAP platform', desc: 'Shared runtime · 4 projects', ini: 'KAP', bg: '#1F1A1C', fg: '#fff' }
    : project!.key === 'default'
      ? { kind: 'Project on KAP', name: 'Default', desc: 'System project', ini: 'DF', bg: 'var(--surface-sunken)', fg: 'var(--text-body)' }
      : { kind: 'Project on KAP', name: project!.name, desc: 'Economic Affairs and Investment', ini: project!.initials, bg: '#F6E8EC', fg: '#8A1538' };

  return (
    <ScopeCtx.Provider value={scope}>
      <PaletteCtx.Provider value={openPalette}>
      <CrumbProvider>
        <div className="flex h-screen flex-col">
          <TopBar scope={scope.kind} project={project} onToggleSidebar={() => setCollapsed((c) => !c)} onOpenPalette={() => setPalette(true)} />
          <div className="flex min-h-0 flex-1">
            <Sidebar groups={isPlatform ? PLATFORM_NAV : PROJECT_NAV} base={base} identity={identity} collapsed={collapsed} />
            <main ref={mainRef} className="min-w-0 flex-1 overflow-auto">
              <Breadcrumbs scope={scope} base={base} />
              <Outlet />
            </main>
          </div>
        </div>
        <CommandPalette open={palette} onOpenChange={setPalette} base={project ? base : '/p/sceai'} />
      </CrumbProvider>
      </PaletteCtx.Provider>
    </ScopeCtx.Provider>
  );
}

function Breadcrumbs({ scope, base }: { scope: Scope; base: string }) {
  const { pathname } = useLocation();
  const extra = useCrumbExtra();
  const seg = pathname.slice(base.length).replace(/^\//, '').split('/')[0];
  const nav = scope.kind === 'platform' ? PLATFORM_NAV : PROJECT_NAV;
  const sec = crumbsFor(nav, seg);
  const list = ['KAP', ...(scope.kind === 'project' ? [scope.project.name] : []), ...(sec ? (scope.kind === 'platform' && sec[0] === 'KAP platform' ? [sec[1]] : sec) : []), ...extra];
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-8 pt-3.5 text-[12.5px] text-ink-muted">
      {list.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={14} className="opacity-60" />}
          <span className={i === list.length - 1 ? 'whitespace-nowrap font-semibold text-ink-strong' : 'whitespace-nowrap'}>{c}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function PlatformLayout() {
  return <Shell scope={{ kind: 'platform' }} />;
}

export function ProjectLayout() {
  const { projectId } = useParams();
  const p = projectByKey(projectId);
  if (!p || !p.enabled) return <Navigate to="/p/sceai" replace />;
  return <Shell scope={{ kind: 'project', project: p }} />;
}

/** Resources backed by the platform API for live tenants (resource names as passed to ProjectPage). */
const LIVE_RESOURCES = new Set(['agent jobs', 'traces']);

/**
 * Wrap a project page: in the Default (system) project every page except the
 * overview is an empty state (README §5). In a live tenant, pages not yet
 * connected to real data say so instead of showing another tenant's mocks.
 */
export function ProjectPage({ resource, children }: { resource: string; children: React.ReactNode }) {
  const scope = useScope();
  const nav = useNavigate();
  if (scope.kind === 'project' && scope.project.live && !LIVE_RESOURCES.has(resource)) {
    const p = scope.project;
    return (
      <Page>
        <EmptyState
          title={`${resource[0].toUpperCase()}${resource.slice(1)} are not connected for ${p.name} yet`}
          body={`${p.name} shows real data from the test stand. Live so far: agent jobs and their traces. Other pages use mock data and are shown on the SCEAI tenant.`}
          actions={
            <>
              <Button onClick={() => nav(`/p/${p.key}/jobs`)}>Open agent jobs</Button>
              <Button variant="outline" onClick={() => nav('/p/sceai')}>
                Switch to SCEAI
              </Button>
            </>
          }
        />
      </Page>
    );
  }
  if (scope.kind === 'project' && scope.project.key === 'default') {
    return (
      <Page>
        <EmptyState
          title={`No ${resource} in the Default project`}
          body="Default is the system project. It holds service identities, default model providers and default queue policies used when new projects are created."
          actions={
            <>
              <Button onClick={() => nav('/p/sceai')}>Switch to SCEAI</Button>
              <Button variant="outline" onClick={() => nav('/p/default')}>
                Default overview
              </Button>
            </>
          }
        />
      </Page>
    );
  }
  return <>{children}</>;
}

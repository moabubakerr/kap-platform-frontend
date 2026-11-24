import * as React from 'react';
import { Outlet, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { ChevronRight, Lock } from 'lucide-react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { CrumbProvider, useCrumbExtra } from './crumbs';
import { projectByKey, type Project } from '@/mocks/projects';
import { EmptyState } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/common/layout';
import { useViewAs } from '@/v35/access';
import { iamStore, platformAdmin } from '@/v35/iam';
import { allowedPlatform, allowedTenant, groupOf, landingFor, platformScreenByPath, PLATFORM_NAV, TENANT_NAV, tenantScreenByPath, type NavGroup } from '@/v35/screens';

type Scope = { kind: 'platform' } | { kind: 'project'; project: Project };

const ScopeCtx = React.createContext<Scope>({ kind: 'platform' });
const PaletteCtx = React.createContext<() => void>(() => {});
/** Opens the Ctrl+K command palette from anywhere inside the shell. */
export const useOpenPalette = () => React.useContext(PaletteCtx);
/** Current scope; inside tenant routes `project` is always set. */
export const useScope = () => React.useContext(ScopeCtx);
export const useProject = () => {
  const s = useScope();
  if (s.kind !== 'project') throw new Error('useProject outside a tenant route');
  return s.project;
};
/** Base path of the current tenant, e.g. /p/sceai */
export const useBase = () => {
  const s = useScope();
  return s.kind === 'project' ? `/p/${s.project.key}` : '/platform';
};

const COLLAPSE_KEY = 'kap.navCollapsed';

function Shell({ scope }: { scope: Scope }) {
  const [palette, setPalette] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  const { pathname } = useLocation();
  const { uid } = useViewAs();
  iamStore.use(); // navigation follows IAM edits
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
    ? { kind: 'Platform', name: 'KAP platform', desc: 'Shared runtime · 3 tenants', ini: 'KAP', bg: '#1F1A1C', fg: '#fff' }
    : project!.key === 'default'
      ? { kind: 'System · internal', name: 'Default', desc: 'Platform service identities', ini: 'DF', bg: 'var(--surface-sunken)', fg: 'var(--text-body)' }
      : { kind: 'Tenant on KAP', name: project!.name, desc: project!.description, ini: project!.initials, bg: project!.key === 'sceai' ? '#F6E8EC' : 'var(--surface-sunken)', fg: project!.key === 'sceai' ? '#8A1538' : 'var(--text-body)' };

  // only screens this account may open
  const groups: NavGroup[] = (isPlatform ? PLATFORM_NAV : TENANT_NAV).map((g) => ({
    ...g,
    items: g.items.filter((s) => (isPlatform ? allowedPlatform(uid, s) : allowedTenant(uid, project!.key, s))),
  }));

  return (
    <ScopeCtx.Provider value={scope}>
      <PaletteCtx.Provider value={openPalette}>
        <CrumbProvider>
          <div className="flex h-screen flex-col">
            <TopBar scope={scope.kind} project={project} collapsed={collapsed} onToggleSidebar={toggle} onOpenPalette={() => setPalette(true)} />
            <div className="flex min-h-0 flex-1">
              <Sidebar groups={groups} base={base} identity={identity} collapsed={collapsed} />
              <main ref={mainRef} className="min-w-0 flex-1 overflow-auto">
                <Breadcrumbs scope={scope} base={base} />
                <Guard scope={scope} base={base}>
                  <Outlet />
                </Guard>
              </main>
            </div>
          </div>
          <CommandPalette open={palette} onOpenChange={setPalette} base={project ? base : '/p/sceai'} />
        </CrumbProvider>
      </PaletteCtx.Provider>
    </ScopeCtx.Provider>
  );
}

/** Blocks screens the current account may not open; sends the tenant root to the account's landing screen. */
function Guard({ scope, base, children }: { scope: Scope; base: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { uid } = useViewAs();
  iamStore.use();
  const nav = useNavigate();
  const seg = pathname.slice(base.length).replace(/^\//, '').split('/')[0] ?? '';
  if (scope.kind === 'platform') {
    if (!platformAdmin(uid)) return <NoAccess title="This account has no platform access" body="Platform screens are for KAP platform administrators. Switch account or open one of your tenants." onBack={() => nav('/p/sceai')} backL="Open SCEAI" />;
    const s = platformScreenByPath(seg);
    if (s && !allowedPlatform(uid, s)) return <NoAccess title={`You don't have access to ${s.label}`} body="Your platform role does not include this area." onBack={() => nav('/platform')} backL="Platform overview" />;
    return <>{children}</>;
  }
  const t = scope.project.key;
  const s = tenantScreenByPath(seg);
  if (s && !allowedTenant(uid, t, s)) {
    const land = landingFor(uid, t);
    if (seg === '' && land && land.path !== '') return <Navigate to={`${base}/${land.path}`} replace />;
    return (
      <NoAccess
        title={land ? `You don't have access to ${s.label}` : `This account has no access in ${scope.project.name}`}
        body={land ? 'No grant of your groups covers this screen. Ask a tenant administrator for access.' : 'Switch account from the menu at the top right, or choose another tenant.'}
        onBack={land ? () => nav(land.path ? `${base}/${land.path}` : base) : undefined}
        backL={land ? `Open ${land.label}` : ''}
      />
    );
  }
  return <>{children}</>;
}

function NoAccess({ title, body, onBack, backL }: { title: string; body: string; onBack?: () => void; backL: string }) {
  return (
    <Page>
      <EmptyState icon={<Lock size={22} />} title={title} body={body} actions={onBack ? <Button onClick={onBack}>{backL}</Button> : undefined} />
    </Page>
  );
}

function Breadcrumbs({ scope, base }: { scope: Scope; base: string }) {
  const { pathname } = useLocation();
  const extra = useCrumbExtra();
  const seg = pathname.slice(base.length).replace(/^\//, '').split('/')[0] ?? '';
  const nav = scope.kind === 'platform' ? PLATFORM_NAV : TENANT_NAV;
  const s = scope.kind === 'platform' ? platformScreenByPath(seg) : tenantScreenByPath(seg);
  const group = s ? groupOf(nav, s.key) : undefined;
  const list = ['KAP', ...(scope.kind === 'project' ? [scope.project.name] : []), ...(group ? [group] : []), ...(s ? [s.label] : []), ...extra];
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 px-8 pt-3.5 text-[12.5px] text-ink-muted">
      {list.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={14} className="opacity-60" />}
          <span aria-current={i === list.length - 1 ? 'page' : undefined} className={i === list.length - 1 ? 'whitespace-nowrap font-semibold text-ink-strong' : 'whitespace-nowrap'}>
            {c}
          </span>
        </React.Fragment>
      ))}
    </nav>
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

/**
 * Wrap a v1 screen (still on SCEAI mock data). In the Default system tenant it
 * is an empty state; in other tenants the SCEAI sample data is not shown as if
 * it were theirs.
 */
export function ProjectPage({ resource, children }: { resource: string; children: React.ReactNode }) {
  const scope = useScope();
  const nav = useNavigate();
  if (scope.kind === 'project' && scope.project.sample) {
    const p = scope.project;
    return (
      <Page>
        <EmptyState
          title={`${resource[0].toUpperCase()}${resource.slice(1)} are not connected for ${p.name} yet`}
          body={p.live ? `${p.name} shows real data from the test stand. Live so far: Monitoring & Insights (jobs, traces and run details). This screen has sample data on SCEAI only.` : `${p.name} is a sample tenant. This screen has sample data on SCEAI only.`}
          actions={
            <>
              {p.live && <Button onClick={() => nav(`/p/${p.key}/monitoring`)}>Open Monitoring & Insights</Button>}
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
          title={`No ${resource} in the Default tenant`}
          body="Default is the internal system tenant. It holds platform service identities, default model providers and default queue policies used when new tenants are created."
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

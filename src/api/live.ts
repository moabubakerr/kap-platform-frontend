import { useScope } from '@/app/shell/AppShell';
import type { Project } from '@/mocks/projects';

/** The current tenant when its jobs and traces come from the platform API. */
export function useLiveTenant(): Project | null {
  const s = useScope();
  return s.kind === 'project' && s.project.live ? s.project : null;
}

/** How often live lists refresh. */
export const LIVE_REFRESH_MS = 10_000;

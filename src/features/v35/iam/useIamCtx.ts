import { useNavigate } from 'react-router-dom';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs } from '@/engine/dialogs';
import { useAccess } from '@/v35/access';
import { iamStore, type TenantKey } from '@/v35/iam';
import { identityStore } from '@/v35/data/identity';
import type { IamCtx } from './build';

/** Builder context for a User & Permission Management page: data, permissions of the "view as" account, dialogs, navigation. */
export function useIamCtx(): IamCtx {
  const scope = useScope();
  const base = useBase();
  const nav = useNavigate();
  const T = (scope.kind === 'project' ? scope.project.key : 'sceai') as TenantKey;
  const acc = useAccess(scope.kind === 'project' ? T : null);
  const iam = iamStore.use();
  const idn = identityStore.use();
  const d = useDialogs();
  return {
    T,
    actor: acc.uid,
    iam,
    idn,
    canUser: acc.can('user:manage', 'tenant'),
    canGrantM: acc.can('grant:manage', 'tenant'),
    canCfg: acc.can('tenant:configure', 'tenant'),
    pEdit: acc.canP('platform:manage'),
    ui: d,
    go: (p) => nav(p.startsWith('/') ? p : `${base}/${p}`),
    setIam: iamStore.update,
    setIdn: identityStore.update,
  };
}

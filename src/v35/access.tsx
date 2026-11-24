/**
 * "View as": the signed-in account for the prototype's access simulation.
 * Every screen and action checks permissions for this account in the current
 * tenant. Persisted per browser. When the platform layer has its own IAM this
 * becomes the real signed-in user.
 */
import * as React from 'react';
import { ACCOUNTS, can as canFor, canPlatform, platformAdmin, roleNamesIn, type ResType, type TenantKey } from './iam';

const STORAGE_KEY = 'kap.viewAs';
const DEFAULT_ACCOUNT = 'kap.ops';

type Ctx = { uid: string; setUid: (u: string) => void };
const AccessCtx = React.createContext<Ctx>({ uid: DEFAULT_ACCOUNT, setUid: () => {} });

function initial(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && ACCOUNTS.some((a) => a.id === v)) return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_ACCOUNT;
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUidState] = React.useState(initial);
  const setUid = React.useCallback((u: string) => {
    setUidState(u);
    try {
      localStorage.setItem(STORAGE_KEY, u);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const value = React.useMemo(() => ({ uid, setUid }), [uid, setUid]);
  return <AccessCtx.Provider value={value}>{children}</AccessCtx.Provider>;
}

export function useViewAs() {
  return React.useContext(AccessCtx);
}

/** Permission helpers for the current account in tenant `t`. */
export function useAccess(t: TenantKey | null) {
  const { uid } = useViewAs();
  return React.useMemo(() => {
    const pa = platformAdmin(uid);
    const account = ACCOUNTS.find((a) => a.id === uid) ?? ACCOUNTS[0];
    return {
      uid,
      name: account.name,
      initials: account.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      platformRole: pa?.role ?? null,
      isPlatformAdmin: pa?.role === 'Platform Administrator',
      can: (perm: string, type: ResType, id?: string) => (t ? canFor(uid, t, perm, type, id) : false),
      canP: (perm: string) => canPlatform(uid, perm),
      rolesIn: (tt: TenantKey) => roleNamesIn(uid, tt),
    };
  }, [uid, t]);
}

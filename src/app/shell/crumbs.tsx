import * as React from 'react';

/**
 * Breadcrumbs = KAP / <scope> / <nav group> / <nav item> / ...extra.
 * The first four come from the route; pages append detail crumbs with
 * `useCrumbs(['sceai_indicators_oxford', 'Versions'])`.
 */
type Ctx = { extra: string[]; setExtra: (c: string[]) => void };
const CrumbCtx = React.createContext<Ctx>({ extra: [], setExtra: () => {} });

export function CrumbProvider({ children }: { children: React.ReactNode }) {
  const [extra, setExtra] = React.useState<string[]>([]);
  const value = React.useMemo(() => ({ extra, setExtra }), [extra]);
  return <CrumbCtx.Provider value={value}>{children}</CrumbCtx.Provider>;
}

export const useCrumbExtra = () => React.useContext(CrumbCtx).extra;

export function useCrumbs(extra: (string | undefined | false)[]) {
  const { setExtra } = React.useContext(CrumbCtx);
  const key = extra.filter(Boolean).join('\u0000');
  React.useEffect(() => {
    setExtra(key ? key.split('\u0000') : []);
    return () => setExtra([]);
  }, [key, setExtra]);
}

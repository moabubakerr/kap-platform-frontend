import { useLocation } from 'react-router-dom';
import { useBase, useScope } from '@/app/shell/AppShell';
import { ScreenView } from '@/engine/ScreenView';
import { platformScreenByPath, tenantScreenByPath } from '@/v35/screens';

/** A v35 screen that is not ported yet: its title and an honest note, nothing invented. */
export default function Porting() {
  const { pathname } = useLocation();
  const base = useBase();
  const scope = useScope();
  const seg = pathname.slice(base.length).replace(/^\//, '').split('/')[0] ?? '';
  const s = scope.kind === 'platform' ? platformScreenByPath(seg) : tenantScreenByPath(seg);
  return (
    <ScreenView
      model={{
        head: { title: s?.label ?? 'Screen' },
        sections: [{ callout: `${s?.label ?? 'This screen'} is part of the v35 design and is being ported to the console. It will appear here in a later update.` }],
      }}
    />
  );
}

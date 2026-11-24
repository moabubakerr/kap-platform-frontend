import * as React from 'react';
import { toast } from 'sonner';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { recordAudit } from '@/v35/data/audit';
import { reportsStore, type Report } from '@/v35/data/toolsConfidence';
import { delL, destL, emptyTenant, freqL, modHead, reportsScreen, SCHEDULE_TABS, validateReport, type ListFilters } from './build';
import { ReportEditor, type ReportDraft } from './ReportEditor';
import { useAfBase } from './useTools';

const draftOf = (r: Report): ReportDraft => ({ id: r.id, n: r.n, owner: r.owner, sec: r.sec.slice(), freq: r.freq, day: r.day, time: r.time, range: r.range, fmt: r.fmt, del: r.del, rcp: r.rcp.slice() });

/**
 * Schedules & Events · Scheduled Reports (route /schedules/reports): report
 * list, editor with live PDF preview and delivery history (prototype `reports()`).
 * Editing needs tenant:configure.
 */
export default function ScheduledReportsPage() {
  const b = useAfBase();
  const data = reportsStore.use();
  const [f, setF] = React.useState<ListFilters>({});
  const [selId, setSelId] = React.useState<string>('');
  const [ed, setEd] = React.useState<ReportDraft | null>(null);
  useCrumbs(['Scheduled Reports']);
  const setTab = (v: string) => b.nav(v === 'reports' ? `${b.base}/schedules/reports` : `${b.base}/schedules`);
  const t = b.t;
  if (!t) return <ScreenView model={emptyTenant(modHead('Schedules & Events', SCHEDULE_TABS, 'reports', setTab), 'scheduled reports', b.tn, b.key === 'default')} />;

  const canEdit = b.access.can('tenant:configure', 'tenant', '*');
  const RD = data.reports[t];
  const audit = (action: string, res: string) => recordAudit({ who: b.access.uid, action, res, tenants: [t], lvl: 'tenant', area: 'Schedules & Events' });
  const isNew = !!ed && ed.id === selId && !RD.some((r) => r.id === selId);
  const cur0 = RD.find((r) => r.id === selId) || RD[0];
  const E: ReportDraft | null = ed && (isNew || (cur0 && ed.id === cur0.id)) ? ed : cur0 ? draftOf(cur0) : null;
  const dirty = !!E && (isNew || (!!cur0 && JSON.stringify(E) !== JSON.stringify(draftOf(cur0))));

  const select = (id: string) => {
    setSelId(id);
    setEd(null);
  };
  const create = () => {
    const id = `r${Date.now()}`;
    setSelId(id);
    setEd({ id, n: '', owner: b.access.uid, sec: ['overview'], freq: 'weekly', day: 'Sunday', time: '07:00', range: 'last', fmt: 'pdf', del: 'email', rcp: [b.access.uid] });
  };
  const runNow = (r: Report) => {
    reportsStore.update((x) => {
      x.history[t].unshift(['Just now', r.n, 'Previous period', String(r.rcp.length), delL(r), 'approved', 'Delivered', '', 'View PDF']);
    });
    audit('Ran report now', r.n);
    b.d.toast(`${r.n} generated and delivered to ${destL(r).toLowerCase()}.`);
  };
  const save = () => {
    if (!E) return;
    const err = validateReport(E);
    if (err) {
      toast.error(err);
      return;
    }
    const exists = RD.some((r) => r.id === E.id);
    reportsStore.update((x) => {
      const L = x.reports[t];
      if (exists) Object.assign(L.find((r) => r.id === E.id)!, E);
      else L.push({ ...E, next: E.freq === 'daily' ? `Tomorrow, ${E.time}` : `Next ${E.day || ''}, ${E.time}`, p: 'draft', pl: 'Not run yet', on: true });
    });
    setSelId(E.id);
    setEd(null);
    audit(exists ? 'Changed scheduled report' : 'Created scheduled report', `${E.n} · ${freqL(E)} · ${destL(E)}`);
    b.d.toast(`${E.n}${exists ? ' saved.' : ' created.'}`);
  };
  const remove = () => {
    if (!cur0) return;
    b.d.confirm(`Delete ${cur0.n}?`, 'Future deliveries stop. Past deliveries stay in the history.', [], 'Delete', () => {
      reportsStore.update((x) => { x.reports[t] = x.reports[t].filter((r) => r.id !== cur0.id); });
      setSelId('');
      setEd(null);
      audit('Deleted scheduled report', cur0.n);
      b.d.toast(`${cur0.n} deleted.`);
    });
  };
  const pause = () => {
    if (!cur0) return;
    reportsStore.update((x) => { const r = x.reports[t].find((y) => y.id === cur0.id); if (r) r.on = !r.on; });
    audit(cur0.on ? 'Paused scheduled report' : 'Resumed scheduled report', cur0.n);
    b.d.toast(`${cur0.n}${cur0.on ? ' paused.' : ' resumed.'}`);
  };

  const editor = E
    ? {
        custom: (
          <ReportEditor
            E={E}
            setE={(p) => setEd({ ...E, ...p })}
            isNew={isNew}
            dirty={dirty}
            canEdit={canEdit}
            on={isNew ? true : !!cur0?.on}
            tn={b.tn}
            onSave={save}
            onDelete={remove}
            onPause={pause}
            onTest={() => b.d.toast(`Test of ${E.n || 'the report'} sent to ${b.access.uid}.`)}
          />
        ),
      }
    : undefined;

  return (
    <ScreenView
      model={reportsScreen(
        { tn: b.tn, reports: RD, history: data.history[t], canEdit, selId: E?.id ?? '', go: { tab: setTab }, a: { create, select, runNow } },
        f,
        setF,
        editor,
      )}
    />
  );
}

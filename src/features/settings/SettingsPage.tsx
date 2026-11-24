import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { Card, CopyId } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useSettings } from '@/api/governance';
import { ListSkeleton, PlainTable, readOnly } from '@/features/users/identity-ui';

export default function SettingsPage() {
  const base = useBase();
  const { data } = useSettings();

  return (
    <ProjectPage resource="settings">
      <Page className="gap-4">
        <PageHeader
          title="Project settings"
          description="Configuration that applies to every agent, pipeline and user in SCEAI."
          actions={
            <Button variant="outline" onClick={readOnly}>
              <Pencil size={15} />
              Edit settings
            </Button>
          }
        />
        {!data ? (
          <ListSkeleton rows={10} />
        ) : (
          <>
            {data.sections.map((s) => (
              <Card key={s.title} title={s.title} sub={s.sub} bodyClassName="p-0">
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={r.key} className={i > 0 ? 'border-t border-line-subtle' : undefined}>
                        <td className={`w-[240px] px-4 py-[9px] align-top text-ink-muted ${r.mono && !r.key.includes(' ') ? 'font-mono text-[12.5px]' : ''}`}>{r.key}</td>
                        <td className="px-4 py-[9px]">
                          {r.key === 'Tenant ID' ? (
                            <CopyId id={r.value} short={false} />
                          ) : r.href ? (
                            <Link to={`${base}/${r.href}`} className={r.mono ? 'font-mono text-[12.5px]' : undefined}>
                              {r.value}
                            </Link>
                          ) : (
                            <span className={r.mono ? 'font-mono text-[12.5px]' : undefined}>{r.value}</span>
                          )}
                          {r.note && <div className="text-xs text-ink-muted">{r.note}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
            <Card title="Queue policies" sub="Per-project limits on the shared KAP queues" bodyClassName="p-0">
              <PlainTable head={['Queue', 'Used for', 'task_priority', 'max_in_flight', 'Timeout', 'Retries']} minWidth={640} align={['left', 'left', 'right', 'right', 'right', 'right']}>
                {data.queues.map((q) => (
                  <tr key={q.queue} className="border-t border-line-subtle">
                    <td className="px-3 py-[9px]">
                      <Link to={q.queue === 'kap.agent' ? `${base}/jobs` : `${base}/pipelines`} className="font-mono text-[12.5px] font-semibold">
                        {q.queue}
                      </Link>
                    </td>
                    <td className="px-3 py-[9px] text-ink-muted">{q.purpose}</td>
                    <td className="px-3 py-[9px] text-right font-mono text-[12.5px]">{q.taskPriority}</td>
                    <td className="px-3 py-[9px] text-right font-mono text-[12.5px]">{q.maxInFlight}</td>
                    <td className="px-3 py-[9px] text-right">{q.timeout}</td>
                    <td className="px-3 py-[9px] text-right font-mono text-[12.5px]">{q.retries}</td>
                  </tr>
                ))}
              </PlainTable>
            </Card>
          </>
        )}
      </Page>
    </ProjectPage>
  );
}

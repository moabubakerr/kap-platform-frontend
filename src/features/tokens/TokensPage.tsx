import { useNavigate } from 'react-router-dom';
import { CircleCheck, Copy, Plus, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Page, PageHeader } from '@/components/common/layout';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useTokens } from '@/api/identity';
import { ListSkeleton, MonoLink, PlainTable, readOnly } from '@/features/users/identity-ui';

export default function TokensPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data } = useTokens();

  return (
    <ProjectPage resource="API tokens">
      <Page className="gap-4">
        <PageHeader
          title="API tokens"
          description="Tokens for service-to-service calls. A token is shown only once, when it is created."
          actions={
            <Button onClick={readOnly}>
              <Plus size={16} />
              Create token
            </Button>
          }
        />
        {!data ? (
          <ListSkeleton rows={5} />
        ) : (
          <>
            <div className="card border-warning-border">
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex text-success">
                    <CircleCheck size={16} />
                  </span>
                  <b className="text-ink-strong">Token {data.created.name} created</b>
                  <span className="text-[12.5px] text-ink-muted">
                    Owner{' '}
                    <MonoLink to={`${base}/users/${data.created.owner}`} className="text-ink-muted">
                      {data.created.owner}
                    </MonoLink>{' '}
                    · expires {data.created.expires}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[260px] flex-1 rounded-sm border border-line bg-surface-sunken px-3 py-2.5 font-mono text-[12.5px] [overflow-wrap:anywhere]">{data.created.value}</div>
                  <Button
                    onClick={() => {
                      void navigator.clipboard?.writeText(data.created.value);
                      toast.success('Token copied');
                    }}
                  >
                    <Copy size={15} />
                    Copy token
                  </Button>
                </div>
                <div className="flex items-center gap-2 rounded-sm bg-warning-bg px-3 py-2.5 text-[13px] text-warning-fg">
                  <TriangleAlert size={16} className="flex-none" />
                  Copy this token now. It will not be shown again. Store it in your secrets manager.
                </div>
              </div>
            </div>

            <div className="card overflow-hidden">
              <PlainTable head={['Name', 'Owner', 'Prefix', 'Expires', 'Last used', 'Status', '']}>
                {data.tokens.map((t) => (
                  <tr key={t.name} onClick={() => nav(`${base}/users/${t.owner}/tokens`)} className="cursor-pointer border-t border-line-subtle hover:bg-surface-hover">
                    <td className="px-3 py-[9px] font-mono text-[12.5px] font-semibold">{t.name}</td>
                    <td className="px-3 py-[9px]">
                      <MonoLink to={`${base}/users/${t.owner}`} className="text-ink-body">
                        {t.owner}
                      </MonoLink>
                    </td>
                    <td className="px-3 py-[9px] font-mono text-[12.5px] text-ink-muted">{t.prefix}</td>
                    <td className="px-3 py-[9px]">{t.expires}</td>
                    <td className="px-3 py-[9px] text-ink-muted">{t.lastUsed}</td>
                    <td className="px-3 py-[9px]">
                      <StatusPill status={t.status} label={t.statusLabel} />
                    </td>
                    <td className="px-3 py-[9px] text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          readOnly();
                        }}
                        className="font-medium text-danger-fg hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </PlainTable>
            </div>
          </>
        )}
      </Page>
    </ProjectPage>
  );
}

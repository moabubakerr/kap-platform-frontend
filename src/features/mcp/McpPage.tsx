import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Ellipsis, Pencil, Plus, Power, Server, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Page, PageHeader } from '@/components/common/layout';
import { Skeleton } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useBuiltinTools, useMcpServers, useMcpTools } from '@/api/mcp';
import { TOOL_SOURCE, type McpServer } from '@/mocks/mcp';
import { CardHead, SimpleTable, Spinner, ToolName, readOnly, tdc } from '@/features/agents/shared';

const mono = 'font-mono text-[12.5px]';

export default function McpPage() {
  return (
    <ProjectPage resource="MCP servers">
      <McpContent />
    </ProjectPage>
  );
}

function McpContent() {
  const base = useBase();
  const nav = useNavigate();
  const servers = useMcpServers();
  const tools = useMcpTools();
  const builtin = useBuiltinTools();

  return (
    <Page className="gap-4 pt-3">
      <PageHeader
        title="Tools & MCP servers"
        description="External MCP servers registered for SCEAI, and the built-in tools agents can call. MCP calls leave the tenant boundary."
        actions={
          <Button onClick={readOnly}>
            <Plus size={16} />
            Register MCP server
          </Button>
        }
      />

      {servers.isLoading || !servers.data ? (
        <Skeleton className="h-[260px]" />
      ) : (
        servers.data.map((srv) => (
          <div key={srv.name} className="card">
            <ServerHead srv={srv} />
            <div className="border-t border-line-subtle">
              <SimpleTable
                minWidth={760}
                head={[{ label: 'Tool exposed' }, { label: 'Description' }, { label: 'Used by' }, { label: 'Calls · 7 d', right: true }, { label: 'Error rate', right: true }, { label: 'p95', right: true }]}
              >
                {(tools.data ?? []).map((t) => (
                  <tr key={t.name} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/agents/${t.usedBy}/tools`)}>
                    <td className={tdc}>
                      <ToolName name={t.name} color={TOOL_SOURCE.oxford.color} />
                    </td>
                    <td className={cn(tdc, 'text-ink-muted')}>{t.description}</td>
                    <td className={cn(tdc, mono)}>
                      <Link to={`${base}/agents/${t.usedBy}`} onClick={(e) => e.stopPropagation()}>
                        {t.usedBy}
                      </Link>
                    </td>
                    <td className={cn(tdc, mono, 'text-right')}>{t.calls7d}</td>
                    <td className={cn(tdc, mono, 'text-right')} style={{ color: t.errorRate === '0%' ? 'var(--text-body)' : 'var(--danger-fg)' }}>
                      {t.errorRate}
                    </td>
                    <td className={cn(tdc, mono, 'text-right')}>{t.p95}</td>
                  </tr>
                ))}
              </SimpleTable>
            </div>
          </div>
        ))
      )}

      <div className="card">
        <CardHead title={`Built-in tools · ${builtin.data?.length ?? 12}`}>
          <span className="text-[12.5px] text-ink-muted">Run inside the tenant boundary</span>
        </CardHead>
        {builtin.isLoading ? (
          <Skeleton className="m-4 h-[300px]" />
        ) : (
          <SimpleTable
            minWidth={760}
            head={[{ label: 'Tool' }, { label: 'Source' }, { label: 'Description' }, { label: 'Used by' }, { label: 'Calls · 7 d', right: true }, { label: 'Errors', right: true }]}
          >
            {(builtin.data ?? []).map((t) => (
              <tr key={t.name} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/agents`)}>
                <td className={tdc}>
                  <ToolName name={t.name} color={TOOL_SOURCE[t.source].color} />
                </td>
                <td className={cn(tdc, 'text-ink-muted')}>{TOOL_SOURCE[t.source].label}</td>
                <td className={cn(tdc, 'text-ink-muted')}>{t.description}</td>
                <td className={tdc} title={t.usedBy.join(', ')}>
                  {t.usedBy.length} agents
                </td>
                <td className={cn(tdc, mono, 'text-right')}>{t.calls7d}</td>
                <td className={cn(tdc, mono, 'text-right')} style={{ color: t.errorRate === '0%' ? 'var(--text-muted)' : 'var(--warning-fg)' }}>
                  {t.errorRate}
                </td>
              </tr>
            ))}
          </SimpleTable>
        )}
      </div>
    </Page>
  );
}

/** Server card head with the "Check connection" local simulation (~1.2 s). */
function ServerHead({ srv }: { srv: McpServer }) {
  const base = useBase();
  const [check, setCheck] = React.useState<0 | 1 | 2>(0);
  const timer = React.useRef<number>();
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  const run = () => {
    setCheck(1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCheck(2), 1200);
  };

  return (
    <>
      <div className="flex flex-wrap items-start gap-3.5 p-4">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-card bg-teal-tint text-[#0F766E]">
          <Server size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-[260px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[15px] font-semibold text-ink-strong">{srv.name}</span>
            <StatusPill status={srv.status} />
            <Badge tone="info">External</Badge>
          </div>
          <div className="mt-1 font-mono text-[12.5px] text-ink-muted">{srv.url}</div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 whitespace-nowrap text-[13px]">
            <span>
              <span className="text-ink-muted">Last check</span> {check === 2 ? 'just now' : srv.lastCheck}
            </span>
            <span>
              <span className="text-ink-muted">Latency p95</span> {srv.p95}
            </span>
            <span>
              <span className="text-ink-muted">Registered tools</span> {srv.toolsCount}
            </span>
            <span>
              <span className="text-ink-muted">Used by</span>{' '}
              {srv.usedBy.map((a) => (
                <Link key={a} to={`${base}/agents/${a}`} className={mono}>
                  {a}
                </Link>
              ))}
            </span>
            <span>
              <span className="text-ink-muted">Errors · 24 h</span> <b className="text-danger-fg">{srv.errors24h}</b>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={run} disabled={check === 1}>
            <Zap size={15} />
            Check connection
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="quiet" size="icon" aria-label="More actions">
                <Ellipsis size={16} />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={readOnly}>
                <Pencil size={15} />
                Edit server
              </MenuItem>
              <MenuItem onSelect={readOnly}>
                <Power size={15} />
                Disable for SCEAI
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={readOnly} className="text-danger-fg">
                <Trash2 size={15} />
                Remove server
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
      {check === 1 && (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-sm bg-info-bg px-3.5 py-2.5 text-[13px] text-info">
          <Spinner />
          Checking connection to {srv.host}…
        </div>
      )}
      {check === 2 && (
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-4 rounded-sm bg-success-bg px-3.5 py-2.5 text-[13px] text-success-fg">
          <span className="flex items-center gap-1.5 font-semibold">
            <Check size={15} />
            Connection OK
          </span>
          <span>Handshake {srv.check.handshake}</span>
          <span>TLS certificate valid until {srv.check.tlsUntil}</span>
          <span>
            {srv.check.tools.length} tools listed · {srv.check.tools.join(', ')}
          </span>
        </div>
      )}
    </>
  );
}

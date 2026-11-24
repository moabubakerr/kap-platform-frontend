import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Page, PageHeader } from '@/components/common/layout';
import { Button } from '@/components/ui/button';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useConfigVersions } from '@/api/governance';
import { ListSkeleton, readOnly } from '@/features/users/identity-ui';

const pill = 'flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 text-[13px]';

export default function ConfigsPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data } = useConfigVersions();
  const versionsHref = `${base}/agents/${data?.agent ?? 'sceai_indicators_oxford'}/versions`;

  return (
    <ProjectPage resource="configuration versions">
      <Page className="gap-4">
        <PageHeader title="Configuration versions" description="Every saved configuration is kept. Compare any two versions and restore one if needed." />
        {!data ? (
          <ListSkeleton rows={8} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Link to={`${base}/agents/${data.agent}`} className={`${pill} border-brand bg-brand-tint font-mono font-medium text-brand-strong hover:no-underline`}>
                {data.agent}
                <ChevronDown size={14} />
              </Link>
              <Link to={versionsHref} className={`${pill} border-line bg-surface text-ink-body hover:border-brand hover:no-underline`}>
                Compare v5 with v6
                <ChevronDown size={14} />
              </Link>
            </div>
            <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)' }}>
              <div className="card">
                <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
                  <div className="font-semibold text-ink-strong">Versions · {data.versions.length}</div>
                </div>
                {data.versions.map((v, i) => (
                  <div
                    key={v.v}
                    role="link"
                    tabIndex={0}
                    onClick={() => nav(versionsHref)}
                    onKeyDown={(e) => e.key === 'Enter' && nav(versionsHref)}
                    className="cursor-pointer border-t border-line-subtle px-4 py-2.5 first:border-t-0 hover:bg-surface-hover"
                    style={i < 2 ? { background: 'var(--brand-tint)' } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12.5px] font-semibold text-ink-strong">{v.v}</span>
                      <span className="text-xs text-ink-muted">{v.when}</span>
                    </div>
                    <div className="text-[12.5px]">{v.note}</div>
                    <div className="text-xs text-ink-muted">{v.by}</div>
                  </div>
                ))}
              </div>
              <div className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
                  <div className="font-semibold text-ink-strong">v5 → v6 · 2 lines changed</div>
                  <Button variant="outline" onClick={readOnly}>
                    <RotateCcw size={15} />
                    Restore v5
                  </Button>
                </div>
                <div className="overflow-auto">
                  <div className="grid min-w-[640px] font-mono text-xs leading-[1.7]" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="border-b border-line-subtle bg-surface-sunken px-3 py-1.5 font-sans text-xs font-semibold text-ink-muted">v5 · 9 d ago · r.haddad</div>
                    <div className="border-b border-l border-line-subtle bg-surface-sunken px-3 py-1.5 font-sans text-xs font-semibold text-ink-muted">v6 · current · r.haddad</div>
                    {data.diff.map((d, i) => (
                      <div key={i} className="contents">
                        <div className="flex gap-2.5 whitespace-pre px-3" style={{ background: d.lb }}>
                          <span className="w-[22px] flex-none text-right text-ink-subtle">{d.ln}</span>
                          <span>{d.l}</span>
                        </div>
                        <div className="flex gap-2.5 whitespace-pre border-l border-line-subtle px-3" style={{ background: d.rb }}>
                          <span className="w-[22px] flex-none text-right text-ink-subtle">{d.rn}</span>
                          <span>{d.r}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Page>
    </ProjectPage>
  );
}

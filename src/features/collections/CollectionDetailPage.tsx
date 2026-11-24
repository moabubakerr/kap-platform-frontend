import { Link, useNavigate, useParams } from 'react-router-dom';
import { Database, Pencil, Play } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { Page } from '@/components/common/layout';
import { CopyId, EmptyState, IconTile } from '@/components/common/primitives';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/status-pill';
import { LinkTabs, type TabItem } from '@/components/ui/tabs';
import { cn, fmtInt } from '@/lib/utils';
import { useCollection, useCollectionFiles } from '@/api/data';
import { useIndicators } from '@/api/catalogue';
import { COLLECTION_ACCESS, PIPELINES, type Collection, type SourceFile } from '@/mocks/data';
import { Kpi, PageLoading, Panel, SimpleTable, readOnly, tdc, tdm } from '@/features/catalogue/shared';

const TABS: TabItem[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'items', label: 'Items', badge: '8,104' },
  { value: 'files', label: 'Source files & versions', badge: 6 },
  { value: 'lineage', label: 'Lineage' },
  { value: 'access', label: 'Access' },
];

export default function CollectionDetailPage() {
  const { collectionId, tab = 'overview' } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const { data: c, isLoading } = useCollection(collectionId);
  const { data: files } = useCollectionFiles(collectionId);
  const cur = TABS.find((t) => t.value === tab) ?? TABS[0];
  useCrumbs([c?.name ?? collectionId, cur.label]);

  if (isLoading) return <PageLoading />;
  if (!c)
    return (
      <ProjectPage resource="collections">
        <Page>
          <EmptyState title={`No collection ${collectionId}`} actions={<Button onClick={() => nav(`${base}/collections`)}>All collections</Button>} />
        </Page>
      </ProjectPage>
    );

  const root = `${base}/collections/${c.id}`;

  return (
    <ProjectPage resource="collections">
      <Page className="gap-4">
        <div className="flex flex-wrap items-start gap-3.5">
          <IconTile size={48} bg="#F6E8EC" fg="#8A1538">
            <Database size={24} strokeWidth={1.75} />
          </IconTile>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-semibold text-ink-strong">{c.name}</h1>
              <StatusPill status="approved" label="Healthy" />
            </div>
            <div className="text-ink-muted">{c.description}</div>
            <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 whitespace-nowrap text-[12.5px] text-ink-muted">
              <span className="inline-flex items-center gap-1">
                ID <CopyId id={c.uuid} />
              </span>
              <span>Project {c.project}</span>
              <span>Created {c.created}</span>
              <span>Last ingestion {c.lastIngestion}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={readOnly}>
              <Play size={15} strokeWidth={1.75} />
              Run ingestion
            </Button>
            <Button variant="outline" onClick={readOnly}>
              <Pencil size={15} strokeWidth={1.75} />
              Edit
            </Button>
          </div>
        </div>

        <LinkTabs items={TABS} base={root} />

        {cur.value === 'overview' && (
          <>
            <Kpis c={c} />
            <Lineage c={c} base={base} />
            <FilesTable files={files ?? []} base={base} />
          </>
        )}
        {cur.value === 'items' && <Items c={c} base={base} files={files ?? []} />}
        {cur.value === 'files' && <FilesTable files={files ?? []} base={base} />}
        {cur.value === 'lineage' && <Lineage c={c} base={base} />}
        {cur.value === 'access' && <Access c={c} base={base} />}
      </Page>
    </ProjectPage>
  );
}

function Kpis({ c }: { c: Collection }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
      <Kpi k="Observations" v={fmtInt(c.observations)} d={`${c.indicators} indicators`} />
      <Kpi k="Document chunks" v={String(c.chunks)} d={`${c.docxFiles} DOCX files`} />
      <Kpi k="Last ingestion" v={c.lastIngestion} d={`run ${c.lastRun.id} · ${c.lastRun.duration}`} />
      <Kpi k="Embedding" v={c.embedding.provider} d={c.embedding.model} mono />
    </div>
  );
}

function Node({ label, name, to, strong }: { label: string; name: string; to: string; strong?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'block rounded-sm px-2.5 py-2 hover:no-underline',
        strong ? 'flex flex-col justify-center self-stretch border-[1.5px] border-[#8A1538] bg-[#F6E8EC] py-3' : 'border border-line-subtle hover:border-brand',
      )}
      style={strong ? { gridRow: 'span 2' } : undefined}
    >
      <div className={cn('text-[11.5px]', strong ? 'text-[#6B0F2B]' : 'text-ink-muted')}>{label}</div>
      <div className={cn('font-mono text-[12.5px] text-ink-strong', strong && 'font-semibold')}>{name}</div>
    </Link>
  );
}

const Edge = ({ color, span }: { color: string; span?: boolean }) => <span className="h-0.5" style={{ background: color, gridRow: span ? 'span 2' : undefined }} />;

function Lineage({ c, base }: { c: Collection; base: string }) {
  const [csv, docx] = PIPELINES;
  return (
    <Panel title="Lineage">
      <div className="overflow-auto px-4 py-[18px]">
        <div className="grid min-w-[820px] items-center gap-y-2.5 text-[12.5px]" style={{ gridTemplateColumns: '1fr 28px 1fr 28px 1fr 28px 1fr' }}>
          <Node label="Connector · bucket CSV" name={csv.connector} to={`${base}/connectors`} />
          <Edge color="#8A1538" />
          <Node label="Pipeline · daily" name={csv.name} to={`${base}/pipelines`} />
          <Edge color="#8A1538" />
          <Node label="Collection" name={c.name} to={`${base}/collections/${c.id}`} strong />
          <Edge color="#8A1538" span />
          <div className="flex flex-col gap-2" style={{ gridRow: 'span 2' }}>
            {c.agents.map((a) => (
              <Link key={a} to={`${base}/agents/${a}`} className="rounded-sm border border-line-subtle px-2.5 py-2 font-mono text-[12.5px] text-brand hover:border-brand hover:no-underline">
                {a}
              </Link>
            ))}
          </div>
          <Node label="Connector · bucket DOCX" name={docx.connector} to={`${base}/connectors`} />
          <Edge color="#C8B49A" />
          <Node label="Pipeline · on upload" name={docx.name} to={`${base}/pipelines`} />
          <Edge color="#C8B49A" />
        </div>
      </div>
    </Panel>
  );
}

function FilesTable({ files, base }: { files: SourceFile[]; base: string }) {
  const nav = useNavigate();
  return (
    <Panel title={`Source files and versions · ${files.length}`} meta="Replaces Source Objects and File Versions">
      <SimpleTable head={['File', 'Type', 'Current', 'Versions', 'Content', 'Updated', 'Status']} right={[3, 4]} minWidth={860}>
        {files.map((f) => (
          <tr key={f.name} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/ingestion?run=${f.run}`)} title={`Open run ${f.run}`}>
            <td className={tdc}>
              <span className="flex items-center gap-2 font-mono text-[12.5px]">
                <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: f.type === 'CSV' ? '#8A1538' : '#C8B49A' }} />
                {f.name}
              </span>
            </td>
            <td className={tdc}>{f.type}</td>
            <td className={tdm}>{f.current}</td>
            <td className={`${tdm} text-right`}>{f.versions}</td>
            <td className={`${tdm} text-right`}>{f.content}</td>
            <td className={`${tdc} text-ink-muted`}>{f.updated}</td>
            <td className={tdc}>
              <StatusPill status={f.status} label={f.statusLabel} />
            </td>
          </tr>
        ))}
      </SimpleTable>
    </Panel>
  );
}

/** Items: indicators with observations held in the collection, plus document chunks per file. */
function Items({ c, base, files }: { c: Collection; base: string; files: SourceFile[] }) {
  const nav = useNavigate();
  const { data: inds } = useIndicators();
  // Observations per indicator in the full history (illustrative; design only gives the 8,104 total).
  const counts: Record<string, number> = { 'IND-TOU-014': 40, 'IND-PRC-002': 180, 'IND-TRD-031': 14, 'IND-FDS-007': 8, 'IND-LAB-022': 40, 'IND-TRD-019': 24 };
  const docs = files.filter((f) => f.type === 'DOCX');
  return (
    <>
      <Panel title={`Indicator observations · ${fmtInt(c.observations)}`} meta={`${c.indicators} indicators · showing ${inds?.length ?? 0}`}>
        <SimpleTable head={['Indicator', 'Code', 'Frequency', 'Periods', 'Observations', 'Source file']} right={[4]} minWidth={760}>
          {(inds ?? []).map((i) => (
            <tr key={i.code} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/indicators/${i.code}`)}>
              <td className={tdc}>
                <div className="font-medium text-brand">{i.nameEn}</div>
                <div dir="auto" className="text-left text-xs text-ink-muted">
                  {i.nameAr}
                </div>
              </td>
              <td className={tdm}>{i.code}</td>
              <td className={tdc}>{i.frequency}</td>
              <td className={`${tdm} whitespace-nowrap text-xs`}>{i.periods}</td>
              <td className={`${tdm} text-right`}>{counts[i.code] ?? '—'}</td>
              <td className={`${tdm} text-ink-muted`}>sceai_indicators_{i.series.file}</td>
            </tr>
          ))}
        </SimpleTable>
      </Panel>
      <Panel title={`Document chunks · ${c.chunks}`} meta={`Embedded with ${c.embedding.provider}`}>
        <SimpleTable head={['Document', 'Version', 'Chunks', 'Status']} right={[2]}>
          {docs.map((f) => (
            <tr key={f.name} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/ingestion?run=${f.run}`)}>
              <td className={tdm}>{f.name}</td>
              <td className={tdm}>{f.current}</td>
              <td className={`${tdm} text-right`}>{f.content.replace(' chunks', '')}</td>
              <td className={tdc}>
                <StatusPill status={f.status} label={f.statusLabel} />
              </td>
            </tr>
          ))}
        </SimpleTable>
      </Panel>
    </>
  );
}

function Access({ c, base }: { c: Collection; base: string }) {
  const nav = useNavigate();
  const tone = { administrator: 'brand', analyst: 'info', viewer: 'neutral' } as const;
  return (
    <>
      <Panel title="Groups with access" meta={<Link to={`${base}/grants`}>Manage in Access grants</Link>}>
        <SimpleTable head={['Group', 'Members', 'Role', 'Granted on']}>
          {COLLECTION_ACCESS.map((g) => (
            <tr key={g.group} className="cursor-pointer hover:bg-surface-hover" onClick={() => nav(`${base}/groups`)}>
              <td className={tdm}>{g.group}</td>
              <td className={`${tdc} text-ink-muted`}>{g.members}</td>
              <td className={tdc}>
                <Badge tone={tone[g.role]}>{g.role}</Badge>
              </td>
              <td className={`${tdc} text-ink-muted`}>{g.via}</td>
            </tr>
          ))}
        </SimpleTable>
      </Panel>
      <Panel title={`Agents using this collection · ${c.agents.length}`}>
        {c.agents.map((a, i) => (
          <Link
            key={a}
            to={`${base}/agents/${a}`}
            className={cn('flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] hover:bg-surface-hover hover:no-underline', i > 0 && 'border-t border-line-subtle')}
          >
            <span className="font-mono text-[12.5px] text-brand">{a}</span>
            <span className="text-ink-muted">collections.read</span>
          </Link>
        ))}
      </Panel>
    </>
  );
}

/**
 * PostgreSQL data source page (live tenant, platform API): connection settings
 * and last test, the tables from the last test, the datasets exported to KAP,
 * and one dataset opened (route tab `dataset-<id>`) with its preview and runs.
 */
import { AlertTriangle, Loader2 } from 'lucide-react';
import { act, cell, fr } from '@/engine/build';
import { ScreenView } from '@/engine/ScreenView';
import type { Row, ScreenModel, Section } from '@/engine/types';
import { Button } from '@/components/ui/button';
import { PG_FEATURE_MISSING, type PgDataset, type PgMapping, type PgQueries, type PgSource } from '@/api/platformPg';
import { exampleId, mappingRows, mappingSummary } from './pgMapping';
import type { Source } from '@/v35/data/ingest';
import { rel } from './fromKap';
import { srcP } from './logic';
import { datasetOfTab } from './pgActions';
import { pgPreviewStore, pgTestStore, type PreviewState } from './pgLive';
import {
  cellText, countsText, EXPORT_STATUS_LABEL, exportStatus, fmtCount, fmtRowsEstimate, lastRunText, nextRunText, pgOfSource, pgRunId, presetName, previewFiles, scheduleLabel, SSL_HINT, testSummary, triggerLabel,
} from './pgView';
import type { PgCtx, useIngest } from './useIngest';

type Ctx = ReturnType<typeof useIngest>;

/** Strip above PostgreSQL screens: where the data comes from, a platform without the feature, load errors. `quiet`: problems only. */
export function PgBanner({ pg, quiet }: { pg: PgCtx; quiet?: boolean }) {
  if (!pg.on) return null;
  const missing = !!pg.state?.missing;
  const err = pg.live.error;
  if (quiet && !missing && !err) return null;
  const tone = missing ? 'bg-warning-bg text-warning-fg' : err ? 'bg-danger-bg text-danger-fg' : 'bg-info-bg text-info';
  const text = missing
    ? PG_FEATURE_MISSING
    : err
      ? `Could not load the PostgreSQL sources from the platform API: ${err}`
      : pg.live.loading && !pg.state
        ? 'Loading PostgreSQL sources from the platform API…'
        : 'Live: PostgreSQL sources come from the platform API on the test stand. The platform reads the database (read-only) and exports indicator files to KAP.';
  return (
    <div className={`mb-3 flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] ${tone}`}>
      <span className="flex-1">{text}</span>
      <button type="button" className="font-medium underline" onClick={() => void pg.live.reload()}>
        Refresh
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ preview panel
function PreviewPanel({ ds, st, canRun, onPreview, onRun }: { ds: PgDataset; st: PreviewState | undefined; canRun: boolean; onPreview: () => void; onRun: () => void }) {
  if (!st)
    return (
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3.5 text-[13px] text-ink-muted">
        <span className="flex-1">Preview runs the dataset’s queries on the database and shows the three files before they are exported.</span>
        <Button size="sm" variant="outline" onClick={onPreview}>
          Preview
        </Button>
      </div>
    );
  if (st.loading)
    return (
      <div className="card flex items-center gap-2 px-4 py-5 text-[13px] text-ink-muted">
        <Loader2 size={16} className="animate-spin" /> Reading {ds.name} from the database…
      </div>
    );
  if (st.error)
    return (
      <div className="card flex flex-col gap-3 px-4 py-3.5">
        <div className="rounded-sm bg-danger-bg px-3 py-2.5 text-[13px] text-danger-fg">The preview failed: {st.error}</div>
        <div>
          <Button size="sm" variant="outline" onClick={onPreview}>
            Preview again
          </Button>
        </div>
      </div>
    );
  const files = st.data ? previewFiles(st.data) : [];
  const problems = st.data?.problems ?? [];
  return (
    <div className="flex flex-col gap-3">
      {problems.length > 0 && (
        <div className="flex items-start gap-3 rounded-card border border-line-subtle bg-warning-bg px-4 py-3 text-warning-fg">
          <AlertTriangle size={18} className="mt-0.5 flex-none" />
          <div className="flex flex-col gap-1 text-[13px]">
            <div className="font-semibold">
              {problems.length} {problems.length === 1 ? 'problem' : 'problems'} found
            </div>
            <ul className="list-disc pl-4">
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {files.map((f) => (
        <div key={f.file} className="card overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-subtle px-4 py-2.5">
            <span className="font-mono text-[13.5px] font-semibold text-ink-strong">{f.name}</span>
            <span className="text-[13px] text-ink-muted">
              {fmtCount(f.count)} {f.count === 1 ? 'row' : 'rows'} · {f.columns.length} columns
            </span>
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
                  {f.columns.map((col) => (
                    <th key={col} className="whitespace-nowrap px-3 py-[7px] font-mono font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {f.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line-subtle">
                    {f.columns.map((_, j) => (
                      <td key={j} className="max-w-[240px] truncate whitespace-nowrap px-3 py-1.5 text-ink-body" title={cellText(r[j])}>
                        {cellText(r[j]) || <span className="text-ink-subtle">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!f.rows.length && <div className="p-4 text-center text-[13px] text-ink-muted">No rows.</div>}
          </div>
          {f.more > 0 && <div className="border-t border-line-subtle px-4 py-2 text-[12px] text-ink-muted">First {f.rows.length} rows shown; {fmtCount(f.more)} more are exported.</div>}
        </div>
      ))}
      {!files.length && <div className="card p-4 text-[13px] text-ink-muted">The preview returned no files.</div>}
      <div className="flex flex-wrap items-center gap-2">
        {canRun && (
          <Button size="sm" onClick={onRun}>
            Run now
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onPreview}>
          Preview again
        </Button>
        <span className="text-[12px] text-ink-muted">
          Previewed {rel(new Date(st.at).toISOString(), Date.now())}.{problems.length ? ' KAP may reject rows with these problems; fix the queries or the data first.' : ' No problems found.'}
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ column mapping
function SqlBlock({ label, sql }: { label: string; sql: string }) {
  return (
    <details className="group rounded-sm border border-line-subtle">
      <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium text-ink-strong">{label}</summary>
      <pre className="max-h-[360px] overflow-auto whitespace-pre border-t border-line-subtle bg-surface-sunken px-3 py-2.5 font-mono text-[12px] leading-[1.5] text-ink-body">{sql}</pre>
    </details>
  );
}

/** A mapped dataset: the mapping in words and as rows, and the SQL the platform generated (from the dataset or its last preview). */
function MappingPanel({ m, queries }: { m: PgMapping; queries: PgQueries | null | undefined }) {
  return (
    <div className="card flex flex-col gap-3 px-4 py-3.5">
      <p className="text-[13.5px] leading-[1.5] text-ink-body">{mappingSummary(m)}</p>
      <div className="rounded-sm border border-line-subtle">
        {mappingRows(m).map(([k, v]) => (
          <div key={k} className="grid gap-3 border-t border-line-subtle px-3 py-1.5 text-[13px] first:border-t-0" style={{ gridTemplateColumns: '170px minmax(0,1fr)' }}>
            <span className="text-ink-muted">{k}</span>
            <span className={k === 'KAP ids' || k === 'Table' ? 'font-mono text-[12.5px] [overflow-wrap:anywhere]' : '[overflow-wrap:anywhere]'}>{v}</span>
          </div>
        ))}
      </div>
      {queries ? (
        <div className="flex flex-col gap-2">
          <div className="text-[12px] text-ink-muted">The SQL the platform runs for this mapping (read-only; change the mapping with Edit).</div>
          <SqlBlock label="Generated SQL · registry.csv" sql={queries.registry} />
          <SqlBlock label="Generated SQL · observations.csv" sql={queries.observations} />
          {queries.narratives ? <SqlBlock label="Generated SQL · narratives.csv" sql={queries.narratives} /> : null}
        </div>
      ) : (
        <div className="text-[12px] text-ink-muted">Preview the dataset to see the SQL the platform generates from this mapping.</div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ page
function connectionSection(c: Ctx, s: PgSource, st: Source['st']): Section {
  const A = c.pg.a;
  const t = s.last_test;
  return {
    form: true,
    title: 'Connection settings',
    sacts: c.canData ? [act('Test connection', () => A.testSource(s.id)), act('Edit', () => A.editSource(s.id)), act('Delete', () => A.deleteSource(s.id))] : [],
    rows: [
      fr('Name', s.name),
      fr('Type', 'PostgreSQL', 'Read by the platform with a read-only user; exported to KAP as indicator files'),
      fr('Host', s.host),
      fr('Port', s.port),
      fr('Database', s.database),
      fr('User name', s.username),
      fr('Password', s.password_set ? 'Stored by the platform' : 'Not set', '', [], { lock: 'Never displayed' }),
      fr('SSL mode', s.sslmode, SSL_HINT[s.sslmode] ?? ''),
      {
        ...fr('Last test', ''),
        cells: [
          cell('Last test'),
          t ? cell(t.ok ? 'OK' : 'Failed', { sub: `${t.message}${t.at ? ` · ${rel(t.at, Date.now())}` : ''}`, p: t.ok ? ['approved', 'OK'] : ['rejected', 'Failed'] }) : cell('Not tested', { sub: 'Run Test connection', p: srcP(st) }),
        ],
      },
      fr('Created', rel(s.created_at, Date.now()), s.updated_at !== s.created_at ? `Changed ${rel(s.updated_at, Date.now())}` : ''),
    ],
  };
}

function tablesSection(srcId: string, tests: ReturnType<typeof pgTestStore.get>): Section {
  const r = tests[srcId];
  return {
    title: 'Tables',
    badge: r?.ok ? String(r.tables.length) : undefined,
    note: r ? (r.ok ? `From the connection test ${rel(new Date(r.at).toISOString(), Date.now())} · ${testSummary(r)}. Row counts are the database’s estimates.` : `The last test failed: ${r.message}`) : '',
    cols: ['Schema', 'Table', 'Rows (estimate)'],
    empty: r ? 'The user cannot read any table.' : 'Run Test connection to list the tables this user can read.',
    rows: (r?.ok ? r.tables : []).map((x): Row => ({ key: `t:${x.schema}.${x.name}`, cells: [cell(x.schema, { m: true }), cell(x.name, { m: true }), cell(fmtRowsEstimate(x.rows_estimate))] })),
  };
}

function datasetsSection(c: Ctx, s: PgSource, datasets: PgDataset[], selId: string | null): Section {
  const A = c.pg.a;
  const now = Date.now();
  return {
    title: 'Datasets',
    badge: String(datasets.length),
    note: 'Each dataset exports three indicator files (registry, observations, narratives) into its own KAP collection.',
    sacts: c.canData ? [act('New dataset', () => A.addDataset(s.id), 'primary')] : [],
    cols: ['Dataset', 'Mapping', 'Target collection', 'Schedule', 'Last run'],
    mode: 'inline',
    empty: 'No datasets yet. Create one to export indicators from this database to KAP.',
    rows: datasets.map(
      (x): Row => ({
        key: `ds:${x.id}`,
        cells: [
          cell(x.name, { m: true, sub: x.id === selId ? 'Open below' : undefined }),
          cell(presetName(x.preset), { sub: x.preset === 'scai_indicators' ? (x.published_only ? 'Published indicators only' : 'All indicators') : x.preset === 'mapped' ? (x.mapping ? `Table ${x.mapping.table}` : 'One table') : 'Three SQL queries' }),
          cell(x.collection_name, { sub: x.kap?.provisioned_at ? 'Created in KAP' : 'Created at the first run' }),
          cell(scheduleLabel(x.schedule_minutes), { sub: x.schedule_minutes ? nextRunText(x.next_run_at, now) : undefined }),
          x.last_run ? cell('', { p: [exportStatus(x.last_run.status) === 'Succeeded' ? 'approved' : exportStatus(x.last_run.status) === 'Failed' ? 'rejected' : 'submitted', lastRunText(x, now)] }) : cell('Never run'),
        ],
        acts: [
          act('Open', () => A.openDataset(x.id)),
          ...(c.canRun ? [act('Run now', () => A.runDataset(x.id))] : []),
          ...(c.canData ? [act('Edit', () => A.editDataset(x.id)), act('Delete', () => A.deleteDataset(x.id))] : []),
        ],
        onClick: () => A.openDataset(x.id),
      }),
    ),
  };
}

function datasetSections(c: Ctx, s: PgSource, x: PgDataset, preview: PreviewState | undefined): Section[] {
  const A = c.pg.a;
  const now = Date.now();
  const runs = (c.pg.state?.exports ?? []).filter((r) => r.dataset_id === x.id);
  const k = x.kap;
  return [
    {
      group: `Dataset · ${x.name}`,
      form: true,
      sacts: [
        ...(c.canRun ? [act('Run now', () => A.runDataset(x.id), 'primary')] : []),
        ...(c.canData ? [act('Edit', () => A.editDataset(x.id)), act('Delete', () => A.deleteDataset(x.id))] : []),
        act('Close', () => c.go.source(s.name)),
      ],
      rows: [
        fr(
          'Mapping',
          presetName(x.preset),
          x.preset === 'scai_indicators' ? 'Built-in mapping for the Ask AI database' : x.preset === 'mapped' ? 'Columns of one table; the platform writes the SQL (see Column mapping below)' : 'Custom SQL: registry, observations and narratives queries',
        ),
        ...(x.preset === 'scai_indicators'
          ? [fr('Only published indicators', x.published_only ? 'Yes' : 'No')]
          : x.preset === 'mapped'
            ? [fr('Table', x.mapping?.table ?? '—', x.mapping ? `KAP ids look like ${exampleId(x.mapping)}` : 'The platform did not return the mapping')]
            : [fr('Queries', ['registry', 'observations', ...(x.queries?.narratives ? ['narratives'] : [])].join(', '), 'Shown in Edit')]),
        fr('Target collection', x.collection_name, k?.provisioned_at ? 'KAP indicator collection; agents read it with indicator tools such as find_indicator' : 'Created in KAP at the first run', k?.collection_id ? [act('Open', () => c.go.collection(x.collection_name))] : []),
        fr('KAP connector and pipeline', `${k?.connector ?? `${x.collection_name}_pg`} · ${k?.pipeline ?? `${x.collection_name}_pipeline`}`, k?.provisioned_at ? `Created ${rel(k.provisioned_at, now)}` : 'Not created yet', [
          ...(k?.connector && k.provisioned_at ? [act('Open connector', () => c.go.source(k.connector))] : []),
          ...(k?.pipeline && k.provisioned_at ? [act('Open pipeline', () => c.go.pipe(k.pipeline))] : []),
        ]),
        fr('Schedule', scheduleLabel(x.schedule_minutes), x.schedule_minutes ? nextRunText(x.next_run_at, now) : 'Runs only when started by hand'),
        fr('Last run', lastRunText(x, now), '', x.last_run ? [act('Open run', () => c.go.run(pgRunId(x.last_run!.id)))] : []),
      ],
    },
    ...(x.preset === 'mapped' && x.mapping ? [{ title: 'Column mapping', custom: <MappingPanel m={x.mapping} queries={preview?.data?.queries ?? x.queries} /> } as Section] : []),
    {
      title: 'Preview',
      custom: <PreviewPanel ds={x} st={preview} canRun={c.canRun} onPreview={() => A.previewDataset(x.id)} onRun={() => A.runDataset(x.id)} />,
    },
    {
      title: 'Export runs',
      badge: String(runs.length),
      cols: ['Run', 'Status', 'Trigger', 'Started', 'Rows exported'],
      mode: 'inline',
      empty: 'No export runs yet.',
      rows: runs.map(
        (r): Row => ({
          key: `x:${r.id}`,
          cells: [
            cell(pgRunId(r.id), { m: true }),
            cell('', { p: [r.status === 'succeeded' ? 'approved' : r.status === 'failed' ? 'rejected' : 'submitted', EXPORT_STATUS_LABEL[r.status] ?? r.status] }),
            cell(triggerLabel(r.trigger)),
            cell(rel(r.created_at, now)),
            cell(countsText(r.counts), { sub: r.error ?? undefined }),
          ],
          acts: [act('Open', () => c.go.run(pgRunId(r.id)))],
          onClick: () => c.go.run(pgRunId(r.id)),
        }),
      ),
    },
  ];
}

export function pgSourceModel(c: Ctx, s: Source, src: PgSource, tab: string | undefined, tests: ReturnType<typeof pgTestStore.get>, previews: ReturnType<typeof pgPreviewStore.get>): ScreenModel {
  const datasets = (c.pg.state?.datasets ?? []).filter((d) => d.source_id === src.id);
  const dsId = datasetOfTab(tab);
  const sel = dsId ? datasets.find((d) => d.id === dsId) ?? null : null;
  const sections: Section[] = [connectionSection(c, src, s.st), tablesSection(src.id, tests), datasetsSection(c, src, datasets, sel?.id ?? null)];
  if (dsId && !sel) sections.push({ callout: 'This dataset no longer exists. It may have been deleted.' });
  if (sel) sections.push(...datasetSections(c, src, sel, previews[sel.id]));
  return {
    head: { title: s.id, status: srcP(s.st), sub: `PostgreSQL · ${src.host}:${src.port} / ${src.database}`, acts: [act('Back to data sources', c.go.sources)] },
    sections,
  };
}

/** The data source page for a PostgreSQL source (`SourcePage` routes here). */
export function PgSourceView({ c, s, tab }: { c: Ctx; s: Source; tab: string | undefined }) {
  const tests = pgTestStore.use();
  const previews = pgPreviewStore.use();
  const ref = pgOfSource(s);
  const src = ref ? c.pg.state?.sources.find((x) => x.id === ref.id) : undefined;
  return (
    <>
      <PgBanner pg={c.pg} />
      {src ? <ScreenView model={pgSourceModel(c, s, src, tab, tests, previews)} /> : null}
    </>
  );
}

/** Dataset name for the breadcrumb of a PostgreSQL source page. */
export function pgCrumb(c: Ctx, tab: string | undefined): string | undefined {
  const id = datasetOfTab(tab);
  return id ? c.pg.state?.datasets.find((d) => d.id === id)?.name : undefined;
}

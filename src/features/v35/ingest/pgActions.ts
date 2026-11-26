/**
 * Actions on the live tenant's PostgreSQL sources, datasets and export runs
 * (platform API). Built by `useIngest` with its dialogs, navigation and audit.
 */
import { toast } from 'sonner';
import type { useDialogs } from '@/engine/dialogs';
import { liveSave, type Live } from '@/v35/live';
import type { IngestTenantKey } from '@/v35/data/ingest';
import {
  createPgDataset, createPgSource, deletePgDataset, deletePgSource, getPgColumns, patchPgDataset, patchPgSource, previewPgDataset, previewPgMapping, previewPgRecords, runPgDataset, testPgSource, type PgDataset, type PgSource,
} from '@/api/platformPg';
import type { IngestNav } from './build';
import { pgPreviewStore, pgTestStore, putExport } from './pgLive';
import { CONNECTION_KEYS, pgDatasetWizard, pgSourceWizard, type PgMappingDeps } from './pgWizards';
import { COST_NOTE } from './pgRecords';
import { pgRunId, presetName, testSummary, toPgDatasetCreate, toPgDatasetPatch, toPgSourceCreate, toPgSourcePatch, type PgState } from './pgView';

/** Rows the wizard's mapping preview asks for per file. */
const MAPPING_PREVIEW_ROWS = 5;

type Dialogs = ReturnType<typeof useDialogs>;

/** Route tab of a dataset on its source page: `/sources/<source>/dataset-<id>`. */
export const DATASET_TAB = 'dataset-';
export const datasetTab = (id: string) => `${DATASET_TAB}${id}`;
export const datasetOfTab = (tab: string | undefined) => (tab && tab.startsWith(DATASET_TAB) ? tab.slice(DATASET_TAB.length) : null);

export interface PgActs {
  addSource: () => void;
  editSource: (id: string) => void;
  testSource: (id: string) => void;
  deleteSource: (id: string) => void;
  addDataset: (sourceId: string) => void;
  editDataset: (id: string) => void;
  deleteDataset: (id: string) => void;
  runDataset: (id: string, confirm?: boolean) => void;
  previewDataset: (id: string) => void;
  openDataset: (id: string) => void;
}

export interface PgDeps {
  d: Dialogs;
  /** the platform load (`useLiveLoad('ingest-pg', …)`) */
  live: Live;
  tid: string;
  t: IngestTenantKey | null;
  P: () => PgState | undefined;
  /** names of every data source in the hub (KAP, PostgreSQL, session) */
  sourceNames: () => string[];
  /** KAP collection names (a new dataset needs a new collection) */
  kapCollections: () => string[];
  audit: (action: string, res: string) => void;
  go: IngestNav;
}

export function makePgActs({ d, live, tid, t, P, sourceNames, kapCollections, audit, go }: PgDeps): PgActs {
  const src = (id: string) => P()?.sources.find((s) => s.id === id) ?? null;
  const dset = (id: string) => P()?.datasets.find((x) => x.id === id) ?? null;
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  /** Runs a connection test and keeps its tables; resolves to '' or the problem. */
  const runTest = (id: string): Promise<string> => {
    const s = src(id);
    if (!s) return Promise.resolve('The data source no longer exists.');
    return testPgSource(tid, id).then(
      (r) => {
        pgTestStore.update((all) => {
          all[id] = { ...r, at: Date.now() };
        });
        audit('Tested PostgreSQL connection', `${s.name} · ${r.ok ? 'ok' : 'failed'}`);
        if (r.ok) d.toast(`${s.name}: connection test succeeded · ${testSummary(r)}.`);
        else toast.error(`${s.name}: connection test failed. ${r.message}`);
        void live.reload();
        return r.ok ? '' : r.message || 'The connection test failed.';
      },
      (e) => {
        toast.error(`${s.name}: the connection test could not run. ${msg(e)}`);
        return msg(e);
      },
    );
  };
  const testSource = (id: string) => void runTest(id);

  /** The column-mapping steps of the dataset wizard, bound to this source. */
  const mappingDeps = (sourceId: string): PgMappingDeps => ({
    tables: () => {
      const r = pgTestStore.get()[sourceId];
      return r?.ok ? r.tables : null;
    },
    test: () => runTest(sourceId),
    columns: (table) => getPgColumns(tid, sourceId, table),
    preview: (m) => previewPgMapping(tid, sourceId, m, MAPPING_PREVIEW_ROWS),
    recordsPreview: (r, name) => previewPgRecords(tid, sourceId, r, { name, limit: MAPPING_PREVIEW_ROWS }),
  });

  const previewDataset = (id: string) => {
    pgPreviewStore.update((all) => {
      all[id] = { ...(all[id] ?? {}), loading: true, error: undefined, at: Date.now() };
    });
    previewPgDataset(tid, id).then(
      (data) =>
        pgPreviewStore.update((all) => {
          all[id] = { loading: false, data, at: Date.now() };
        }),
      (e) =>
        pgPreviewStore.update((all) => {
          all[id] = { loading: false, error: msg(e), at: Date.now() };
        }),
    );
  };

  const openDataset = (id: string) => {
    const x = dset(id);
    const s = x ? src(x.source_id) : null;
    if (x && s) go.source(s.name, datasetTab(id));
  };

  const run = (x: PgDataset) => {
    const box: { id?: string } = {};
    return liveSave(live, async () => {
      const r = await runPgDataset(tid, x.id);
      box.id = r?.id;
      if (t && r?.id) putExport(t, r);
    }).then((e) => {
      if (e) return e;
      audit('Ran PostgreSQL export', `${x.name} → collection ${x.collection_name}${box.id ? ` · run ${box.id}` : ''}`);
      d.toast(`Export of ${x.name} started${box.id ? ` (${pgRunId(box.id)})` : ''}. Its steps are shown live.`);
      if (box.id) window.setTimeout(() => go.run(pgRunId(box.id!)), 0);
      return '';
    });
  };

  return {
    addSource: () =>
      d.wizard(
        pgSourceWizard({
          src: null,
          existing: sourceNames(),
          finish: async (v) => {
            const body = toPgSourceCreate(v);
            const box: { s?: PgSource } = {};
            const e = await liveSave(live, async () => {
              box.s = await createPgSource(tid, body);
            });
            if (e) return e;
            audit('Created data source', `${body.name} · PostgreSQL · ${body.host}:${body.port}/${body.database}`);
            d.toast(`Created ${body.name}. Testing the connection…`);
            window.setTimeout(() => go.source(body.name), 0);
            if (box.s?.id) testSource(box.s.id);
            return '';
          },
        }),
      ),

    editSource: (id) => {
      const s = src(id);
      if (!s) return;
      d.wizard(
        pgSourceWizard({
          src: s,
          existing: sourceNames(),
          finish: async (v) => {
            const patch = toPgSourcePatch(s, v);
            if (!patch) return '';
            const e = await liveSave(live, () => patchPgSource(tid, s.id, patch));
            if (e) return e;
            audit('Edited data source', `${s.name} · PostgreSQL · ${Object.keys(patch).map((k) => (k === 'password' ? 'password (new)' : k)).join(', ')}`);
            d.toast(`Saved ${s.name}.`);
            if (Object.keys(patch).some((k) => CONNECTION_KEYS.includes(k))) testSource(s.id);
            return '';
          },
        }),
      );
    },

    testSource,

    deleteSource: (id) => {
      const s = src(id);
      if (!s) return;
      const used = (P()?.datasets ?? []).filter((x) => x.source_id === id);
      if (used.length)
        return d.info(
          `Delete ${s.name}?`,
          'Datasets export from this source. Delete them first (Datasets section of this page):',
          used.map((x) => ({ a: x.name, b: presetName(x.preset), c: `→ ${x.collection_name}` })),
        );
      d.confirm(`Delete ${s.name}?`, 'The platform removes the connection settings and the stored password. Nothing changes in the database itself.', [], 'Delete', () =>
        liveSave(live, () => deletePgSource(tid, s.id)).then((e) => {
          if (e) return e;
          audit('Deleted data source', `${s.name} · PostgreSQL`);
          d.toast(`${s.name} deleted.`);
          window.setTimeout(() => go.sources(), 0);
          return '';
        }),
      );
    },

    addDataset: (sourceId) => {
      const s = src(sourceId);
      if (!s) return;
      const others = P()?.datasets ?? [];
      d.wizard(
        pgDatasetWizard({
          ds: null,
          source: s,
          check: { names: others.map((x) => x.name), collections: [...kapCollections(), ...others.map((x) => x.collection_name)], edit: false },
          mapping: mappingDeps(s.id),
          finish: async (v) => {
            const body = toPgDatasetCreate(v, s.id);
            const box: { ds?: PgDataset } = {};
            const e = await liveSave(live, async () => {
              box.ds = await createPgDataset(tid, body);
            });
            if (e) return e;
            audit('Created dataset', `${body.name} · ${s.name} → collection ${body.collection_name} · ${presetName(body.preset)}${body.mapping ? ` · table ${body.mapping.table}` : ''}${body.records ? ` · table ${body.records.table}` : ''}`);
            d.toast(`Created ${body.name}. ${body.records ? 'Previewing sample documents…' : 'Previewing the files…'}`);
            const id = box.ds?.id;
            if (id)
              window.setTimeout(() => {
                go.source(s.name, datasetTab(id));
                previewDataset(id);
              }, 0);
            return '';
          },
        }),
      );
    },

    editDataset: (id) => {
      const x = dset(id);
      const s = x ? src(x.source_id) : null;
      if (!x || !s) return;
      const others = (P()?.datasets ?? []).filter((y) => y.id !== id);
      d.wizard(
        pgDatasetWizard({
          ds: x,
          source: s,
          check: { names: others.map((y) => y.name), collections: [], edit: true },
          mapping: mappingDeps(s.id),
          finish: async (v) => {
            const patch = toPgDatasetPatch(x, v);
            if (!patch) return '';
            const e = await liveSave(live, () => patchPgDataset(tid, x.id, patch));
            if (e) return e;
            audit('Edited dataset', `${x.name} · ${Object.keys(patch).join(', ')}`);
            d.toast(`Saved ${String(v.name).trim()}.`);
            if ('queries' in patch || 'mapping' in patch || 'records' in patch || 'preset' in patch || 'published_only' in patch)
              window.setTimeout(() => {
                go.source(s.name, datasetTab(x.id));
                previewDataset(x.id);
              }, 0);
            return '';
          },
        }),
      );
    },

    deleteDataset: (id) => {
      const x = dset(id);
      if (!x) return;
      d.confirm(
        `Delete ${x.name}?`,
        `The platform stops exporting this dataset${x.schedule_minutes ? ' on its schedule' : ''}. Its export history may be removed with it. The KAP collection ${x.collection_name} and the indicators already loaded into it are not deleted here.`,
        [],
        'Delete',
        () =>
          liveSave(live, () => deletePgDataset(tid, x.id)).then((e) => {
            if (e) return e;
            audit('Deleted dataset', `${x.name} → collection ${x.collection_name}`);
            d.toast(`${x.name} deleted.`);
            const s = src(x.source_id);
            if (s) window.setTimeout(() => go.source(s.name), 0);
            return '';
          }),
      );
    },

    runDataset: (id, confirm = true) => {
      const x = dset(id);
      if (!x) return;
      const first = !x.kap?.provisioned_at;
      if (!confirm) {
        void run(x).then((e) => e && toast.error(`Export of ${x.name} could not start. ${e}`));
        return;
      }
      d.confirm(
        `Run ${x.name} now?`,
        x.preset === 'records'
          ? `The platform reads ${x.records?.table ?? x.source_name}, writes one document per record (only new and changed ones are uploaded) and has KAP load them into ${x.collection_name}. ${COST_NOTE}${first ? ` This first run also creates the KAP connector ${x.collection_name}_pg, the document pipeline ${x.collection_name}_pipeline and the document collection ${x.collection_name}.` : ''}`
          : `The platform reads ${x.source_name}, writes the three indicator files, uploads them and has KAP load them into ${x.collection_name}.${first ? ` This first run also creates the KAP connector ${x.collection_name}_pg, pipeline ${x.collection_name}_pipeline and collection ${x.collection_name}.` : ''}`,
        [],
        'Run now',
        () => run(x),
      );
    },

    previewDataset,
    openDataset,
  };
}

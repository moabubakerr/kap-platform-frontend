/**
 * Wires the Data Ingestion Hub builders to the session store, the dialogs, the
 * router and the "view as" permissions. Actions mutate `ingestStore` the way
 * the prototype's `setH` does; runs are simulated (queued → running → result).
 *
 * Live tenant (sandbox): the slice comes from KAP (`liveIngest.ts`), and the
 * actions on KAP records write to KAP: S3 connectors, pipelines, runs over a
 * collection, cancel. Source types KAP lacks stay session-only and say so.
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs, type FormField } from '@/engine/dialogs';
import { kap, kapGet, type KapPage } from '@/api/kap';
import { useAccess } from '@/v35/access';
import { recordAudit } from '@/v35/data/audit';
import { liveSave, liveTenantId, useLiveLoad, type Live } from '@/v35/live';
import { ingestStore, isIngestTenant, type IngestTenant, type IngestTenantKey, type Pipeline, type Run, type Source } from '@/v35/data/ingest';
import type { IngestCtx } from './build';
import {
  checkMessage, isActiveJob, isSess, kapOfPipe, kapOfRun, kapOfSource, runId, toKapConnectorCreate, toKapConnectorPatch, toKapPipelineCreate, toKapPipelinePatch, toKapPipelineRestore, toKapRun,
  type KapConnectorCheck, type KapIngest, type KapJob,
} from './fromKap';
import { markConsoleRun } from './consoleRuns';
import { ACTIVE_REFRESH_MS, ensureJobDetail, hasActiveRun, liveIngestStore, loadIngest, setCheck } from './liveIngest';
import { connectorWizard, kapPipeWizard, sourceTypeFields, typeOfChoice, type ConnMode } from './liveWizards';
import { finishRun, pipeOf, queueRun, srcOf, startRun, testConn, trigOf, type RunOpts } from './logic';
import { pipeWizard, SAMPLE_FILES, sourceWizard, type PipeSaved, type SourceSaved } from './wizards';

const EMPTY: IngestTenant = { sources: [], pipelines: [], runs: [], pub: { colls: [], datasets: [], documents: [] }, onto: [], creds: [] };
const AREA = 'Data Ingestion Hub';

export function useIngest(): IngestCtx & { tenant: IngestTenantKey | null; liveState: Live; fetchRun: (id: string) => void } {
  const scope = useScope();
  const base = useBase();
  const nav = useNavigate();
  const d = useDialogs();
  const key = scope.kind === 'project' ? scope.project.key : null;
  const access = useAccess(key);
  const data = ingestStore.use();
  const t = isIngestTenant(key) ? key : null;
  const raw = liveIngestStore.use();
  const K: KapIngest | undefined = t ? raw[t] : undefined;
  // live tenant: never show the design's sample records while KAP has not answered
  const H = t && !(liveTenantId(t) && !K) ? data[t] : EMPTY;
  const actor = access.uid;

  const live = useLiveLoad(
    'ingest',
    key,
    async (tenantId) => {
      if (t) await loadIngest(tenantId, t);
    },
    // fast while a run is active; otherwise the default live refresh picks up runs started by connector scans
    hasActiveRun(K) ? ACTIVE_REFRESH_MS : undefined,
  );

  const canData = access.can('data:manage', 'collection', '*');
  const canRun = access.can('pipeline:execute', 'tenant', '*') || canData;
  const canConfigure = access.can('tenant:configure', 'tenant', '*');

  return React.useMemo(() => {
    const fresh = () => (t ? ingestStore.get()[t] : EMPTY);
    const kapNow = () => (t ? liveIngestStore.get()[t] : undefined);
    const setH = (fn: (h: IngestTenant) => void) => {
      if (t) ingestStore.update((all) => fn(all[t]));
    };
    const audit = (action: string, res: string) => {
      if (t) recordAudit({ who: actor, action, res, tenants: [t], lvl: 'tenant', area: AREA });
    };
    const tid = live.tenantId ?? '';

    const go: IngestCtx['go'] = {
      sources: () => nav(`${base}/sources`),
      pipes: () => nav(`${base}/pipelines`),
      runs: () => nav(`${base}/runs`),
      source: (id, tab) => nav(`${base}/sources/${encodeURIComponent(id)}${tab && tab !== 'overview' ? `/${tab}` : ''}`),
      pipe: (id, tab) => nav(`${base}/pipelines/${encodeURIComponent(id)}${tab && tab !== 'overview' ? `/${tab}` : ''}`),
      run: (id, tab) => nav(`${base}/runs/${encodeURIComponent(id)}${tab && tab !== 'overview' ? `/${tab}` : ''}`),
      dataset: (id) => nav(`${base}/structured/${encodeURIComponent(id)}`),
      document: (id) => nav(`${base}/unstructured/${encodeURIComponent(id)}`),
      collection: (id) => nav(`${base}/collections/${encodeURIComponent(id)}`),
      security: () => nav(`${base}/security`),
    };

    /** Queue a run and let the simulated worker pick it up and finish it (prototype `simulate`). */
    const simulate = (pid: string, opts?: RunOpts): string => {
      const run = queueRun(fresh(), pid, actor, opts);
      const id = run.id;
      setH((h) => {
        h.runs.unshift(run);
      });
      d.toast(`${id} queued for ${pid}${live.on ? ' (simulated; session only)' : ''}.`);
      window.setTimeout(() => {
        setH((h) => {
          const r = h.runs.find((x) => x.id === id);
          if (r) startRun(r);
        });
      }, 1200);
      window.setTimeout(() => {
        let msg = '';
        setH((h) => {
          msg = finishRun(h, id);
        });
        if (msg) d.toast(msg);
      }, 3000);
      return id;
    };

    // ---------------------------------------------------------------- KAP (live tenant)
    const conn = (name: string) => kapNow()?.conns.find((c) => c.name === name) ?? null;
    const kpipe = (name: string) => kapNow()?.pipes.find((p) => p.name === name) ?? null;

    const runCheck = async (name: string, id: string): Promise<KapConnectorCheck> => {
      const r = await kap<KapConnectorCheck>(tid, 'POST', `connectors/${id}/check`);
      if (t) setCheck(t, name, r);
      audit('Checked data source connection', `${name} · ${r.status}${r.reason_code ? ` (${r.reason_code})` : ''}`);
      return r;
    };
    const checkToast = (name: string, r: KapConnectorCheck) => (r.status === 'ok' ? d.toast(`${name}: connection check succeeded.`) : toast.error(`${name}: connection check failed. ${checkMessage(r)}`));

    const kapSourceWizard = (mode: ConnMode, name?: string) => {
      const c = name ? conn(name) : null;
      d.wizard(
        connectorWizard({
          conn: c,
          mode,
          existing: (kapNow()?.conns ?? []).map((x) => x.name).concat(fresh().sources.filter(isSess).map((s) => s.id)),
          finish: async (v) => {
            const nm = String(v.name).trim();
            let id = c?.id ?? '';
            if (mode === 'edit' && c) {
              const patch = toKapConnectorPatch(c, v);
              if (patch) {
                const e = await liveSave(live, () => kap(tid, 'PATCH', `connectors/${c.id}`, patch));
                if (e) return e;
                audit('Edited data source', `${nm} · S3 · ${Object.keys(patch).join(', ')}`);
              }
            } else {
              const e = await liveSave(live, async () => {
                const r = await kap<{ id: string }>(tid, 'POST', 'connectors', toKapConnectorCreate(v));
                id = r?.id ?? id;
              });
              if (e) return e;
              audit(mode === 'restore' ? 'Reactivated data source' : 'Created data source', `${nm} · S3`);
            }
            d.toast(`${mode === 'create' ? 'Created' : mode === 'restore' ? 'Reactivated' : 'Saved'} ${nm} in KAP.`);
            window.setTimeout(() => go.source(nm), 0);
            if (v.check === 'Yes' && id)
              runCheck(nm, id).then(
                (r) => checkToast(nm, r),
                (e) => toast.error(`${nm}: the connection check could not run. ${e instanceof Error ? e.message : String(e)}`),
              );
            return '';
          },
        }),
      );
    };

    const kapPipeWizardOpen = (name?: string) => {
      const p = name ? kpipe(name) : null;
      const usedBy = (kapNow()?.colls ?? []).filter((c) => c.pipeline_ref === name).map((c) => c.name);
      d.wizard(
        kapPipeWizard({
          pipe: p,
          existing: (kapNow()?.pipes ?? []).map((x) => x.name).concat(fresh().pipelines.filter(isSess).map((x) => x.id)),
          models: kapNow()?.models ?? [],
          usedBy,
          finish: async (v) => {
            const nm = String(v.name).trim();
            if (p) {
              const patch = toKapPipelinePatch(p, v);
              if (!patch) return '';
              const e = await liveSave(live, () => kap(tid, 'PATCH', `pipelines/${p.id}`, patch));
              if (e) return e;
              audit('Edited pipeline', `${nm} · ${Object.keys(patch).join(', ')}${'stages' in patch && usedBy.length ? ` · reprocesses ${usedBy.join(', ')}` : ''}`);
              d.toast(`Saved ${nm} in KAP.${'stages' in patch && usedBy.length ? ` ${usedBy.join(', ')} ${usedBy.length === 1 ? 'is' : 'are'} reprocessed.` : ''}`);
            } else {
              const e = await liveSave(live, () => kap(tid, 'POST', 'pipelines', toKapPipelineCreate(v)));
              if (e) return e;
              audit('Created pipeline', `${nm} · ${v.kind}`);
              d.toast(`Created ${nm} in KAP. A collection that references it links it to its connectors.`);
            }
            window.setTimeout(() => go.pipe(nm), 0);
            return '';
          },
        }),
      );
    };

    /** Run a KAP pipeline over one of the collections that reference it. */
    const kapRun = (pid: string, collectionName?: string, connectorId?: string | null) => {
      const p = kpipe(pid);
      if (!p) return;
      const colls = (kapNow()?.colls ?? []).filter((c) => c.pipeline_ref === pid);
      if (!colls.length) {
        d.info(`Run ${pid}`, 'A KAP run processes one collection, and no active collection references this pipeline. Create or change a collection in Business Data Hub so that its pipeline is this one.');
        return;
      }
      const start = (collName: string, connName: string) => {
        const c = colls.find((x) => x.name === collName)!;
        const cid = connName && connName !== 'All connectors' ? kapNow()?.conns.find((x) => x.name === connName)?.id ?? null : connectorId ?? null;
        let job = '';
        let joined = '';
        return liveSave(live, async () => {
          // a data source scan already processing this collection does the work: show it instead of
          // starting a run that would find nothing (seen on the stand, 25 Nov 2026)
          const recent = await kapGet<KapPage<KapJob>>(tid, `pipelines/${p.id}/jobs`, { collection_id: c.id, sort: '-created_at', limit: 5 }).catch(() => null);
          const busy = recent?.items.find((x) => isActiveJob(x) && (!cid || x.connector_id === cid));
          if (busy) {
            joined = busy.id;
            return;
          }
          const r = await kap<{ id: string }>(tid, 'POST', `pipelines/${p.id}/run`, toKapRun(c.id, cid));
          job = r?.id ?? '';
          // KAP records no trigger: remember the runs this console started (before the reload maps them)
          markConsoleRun(job);
        }).then((e) => {
          if (e) return e;
          if (joined) {
            d.toast(`A run of ${collName} is already in progress (${runId(joined)}), so no new run was started. Showing it.`);
            window.setTimeout(() => go.run(runId(joined)), 0);
            return '';
          }
          audit('Ran pipeline', `${pid} · collection ${collName}${cid ? ` · connector ${connName}` : ''}${job ? ` · job ${job}` : ''}`);
          d.toast(`Run ${job ? runId(job) : ''} registered for ${collName}. KAP starts it when a worker is free; its steps are shown live.`);
          if (job) window.setTimeout(() => go.run(runId(job)), 0);
          return '';
        });
      };
      if (collectionName) {
        d.confirm(`Run ${pid} again?`, `KAP processes the collection ${collectionName} once more. Files that did not change are not processed again, and the run does not scan the bucket: a file uploaded just now is found by the data source's next scan, which starts its own run.`, [], 'Run', () => start(collectionName, ''));
        return;
      }
      const fields: FormField[] = [
        { k: 'coll', label: 'Collection', type: 'select', opts: colls.map((c) => c.name), hint: 'A run processes the files of one collection that references this pipeline.' },
        { k: 'conn', label: 'Connector', type: 'select', opts: ['All connectors', ...[...new Set(colls.flatMap((c) => c.connectors))]], hint: "Optional: only the files that connector brought in. It must be one of the collection's connectors." },
        { type: 'note', tone: 'info', text: "A run processes the files the collection's connectors have already found. Connectors scan their bucket on their sync interval (e.g. every 3 minutes): a file uploaded just now is picked up by the next scan, which processes it on its own. Unchanged files are not processed again." },
      ];
      d.form(`Run ${pid}`, fields, 'Run now', (v) => start(v.coll || colls[0].name, v.conn || 'All connectors'));
    };

    // ---------------------------------------------------------------- session (design) actions
    const runNow = (pid: string) => {
      const h = fresh();
      const p = pipeOf(h, pid);
      if (!p || !p.on) return;
      if (kapOfPipe(p)) return kapRun(pid);
      const s = p.v.src !== 'manual' ? srcOf(h, p.v.src) : null;
      if (s && (s.st === 'Failed' || s.st === 'Disabled')) {
        toast.error(`Cannot run ${pid}: data source ${s.id} is ${s.st.toLowerCase()}.`);
        return;
      }
      if (p.v.src === 'manual') {
        d.form(`Upload files · ${pid}`, [{ k: 'f', label: 'Files', type: 'chips', opts: SAMPLE_FILES }], 'Upload and run', (v) => {
          if (!(v.f || []).length) return 'Select at least one file.';
          window.setTimeout(() => go.run(simulate(pid, { files: v.f, trig: `Upload · ${actor}` })), 0);
          return '';
        });
        return;
      }
      go.run(simulate(pid));
    };

    const saveSource = ({ rec, edit, ok, newRef }: SourceSaved) => {
      const sess = live.on;
      setH((h) => {
        const r = sess ? { ...rec, sess: true, desc: rec.desc || 'Session only: not available in KAP.' } : rec;
        if (edit) h.sources[h.sources.findIndex((x) => x.id === rec.id)] = r;
        else h.sources.push(r);
        if (newRef && !h.creds.includes(newRef)) h.creds.push(newRef);
      });
      d.toast(`${edit ? 'Saved ' : 'Created '}${rec.id}${sess ? ' in this session only' : ''} · connection ${ok ? 'succeeded' : 'failed'}.`);
      audit(edit ? 'Edited data source' : 'Created data source', `${rec.id} · ${rec.type}${sess ? ' · session only' : ''}`);
      go.source(rec.id);
    };

    const savePipe = ({ rec, edit, runNow: andRun }: PipeSaved) => {
      const sess = live.on;
      setH((h) => {
        const r = sess ? { ...rec, sess: true } : rec;
        if (edit) h.pipelines[h.pipelines.findIndex((x) => x.id === rec.id)] = r;
        else h.pipelines.push(r);
      });
      d.toast(`${edit ? 'Saved ' : 'Created '}${rec.id}${sess ? ' in this session only' : ''}.`);
      audit(edit ? 'Edited pipeline' : 'Created pipeline', `${rec.id}${sess ? ' · session only' : ''}`);
      go.pipe(rec.id);
      if (andRun) window.setTimeout(() => runNow(rec.id), 50);
    };

    const sessTest = (s: Source) => {
      const r = testConn(s.type, s.cfg);
      setH((h) => {
        const x = h.sources.find((y) => y.id === s.id);
        if (!x) return;
        x.st = x.st === 'Disabled' ? 'Disabled' : r.ok ? 'Connected' : 'Failed';
        x.err = r.ok ? '' : r.msg;
        x.chk = 'just now';
        x.act.unshift(['just now', actor, `Connection test ${r.ok ? 'succeeded' : 'failed'}${r.ok ? '' : `: ${r.msg}`}`]);
      });
      d.toast(`${s.id}: connection test ${r.ok ? 'succeeded' : 'failed'}.`);
    };

    const sessToggleSource = (s: Source) => {
      const dis = s.st !== 'Disabled';
      const on = fresh().pipelines.filter((p) => p.v.src === s.id && p.on);
      const doIt = () => {
        setH((h) => {
          const x = h.sources.find((y) => y.id === s.id);
          if (!x) return;
          x.st = dis ? 'Disabled' : 'Not tested';
          x.act.unshift(['just now', actor, dis ? 'Disabled data source' : 'Enabled data source']);
        });
        d.toast(s.id + (dis ? ' disabled. Its pipelines cannot run until it is enabled.' : ' enabled. Test the connection before use.'));
      };
      if (dis && on.length) d.confirm(`Disable ${s.id}?`, 'Runs of these pipelines will not start while the source is disabled.', on.map((p) => ({ a: p.id, b: trigOf(p.v), c: '' })), 'Disable', doIt);
      else doIt();
    };

    const a: IngestCtx['a'] = {
      addSource: () => {
        if (!live.on) return d.wizard(sourceWizard(fresh(), null, actor, saveSource));
        d.form('Create data source', sourceTypeFields(), 'Next', (v) => {
          const ty = typeOfChoice(v.type);
          window.setTimeout(() => (ty ? d.wizard(sourceWizard(fresh(), null, actor, saveSource, { preType: ty, sessionOnly: true })) : kapSourceWizard('create')), 0);
          return '';
        });
      },
      editSource: (s: Source) => {
        const k = kapOfSource(s);
        if (!k) return d.wizard(sourceWizard(fresh(), s, actor, saveSource, { sessionOnly: live.on }));
        if (k.type !== 's3') return d.info(`Edit ${s.id}`, 'File-system connectors are configured by the platform. The KAP API manages S3 connectors only.');
        kapSourceWizard(k.active ? 'edit' : 'restore', s.id);
      },
      testSource: (s: Source) => {
        const k = kapOfSource(s);
        if (!k) return sessTest(s);
        if (k.type !== 's3') return d.info(`Check ${s.id}`, 'KAP checks S3 connectors only.');
        runCheck(s.id, k.id).then(
          (r) => checkToast(s.id, r),
          (e) => toast.error(`${s.id}: the connection check could not run. ${e instanceof Error ? e.message : String(e)}`),
        );
      },
      toggleSource: (s: Source) => {
        const k = kapOfSource(s);
        if (!k) return sessToggleSource(s);
        if (k.type !== 's3') return d.info(s.id, 'File-system connectors are configured by the platform. The KAP API manages S3 connectors only.');
        if (!k.active) return kapSourceWizard('restore', s.id);
        const colls = (kapNow()?.colls ?? []).filter((c) => c.connectors.includes(s.id));
        if (colls.length)
          return d.info(`Deactivate ${s.id}?`, 'KAP keeps a connector that a collection still references. Remove it from these collections first (Business Data Hub):', colls.map((c) => ({ a: c.name, b: `pipeline ${c.pipeline_ref}`, c: '' })));
        d.confirm(`Deactivate ${s.id}?`, 'KAP stops scanning the bucket. Its scanned objects and history are kept, and creating a connector with the same name brings it back.', [], 'Deactivate', () =>
          liveSave(live, () => kap(tid, 'DELETE', `connectors/${k.id}`)).then((e) => {
            if (!e) {
              audit('Deactivated data source', `${s.id} · S3`);
              d.toast(`${s.id} deactivated in KAP.`);
            }
            return e;
          }),
        );
      },
      addPipe: (fromSource?: Source) => {
        if (!live.on) return d.wizard(pipeWizard(fresh(), null, savePipe, fromSource));
        if (fromSource && isSess(fromSource)) return d.wizard(pipeWizard(fresh(), null, savePipe, fromSource, true));
        if (!fresh().sources.some(isSess)) return kapPipeWizardOpen();
        d.form('Create pipeline', [
          { k: 'where', label: 'Pipeline for', type: 'select', opts: ['KAP (S3 data through collections)', 'A session-only data source (not available in KAP)'] },
        ], 'Next', (v) => {
          window.setTimeout(() => ((v.where || '').startsWith('KAP') ? kapPipeWizardOpen() : d.wizard(pipeWizard(fresh(), null, savePipe, undefined, true))), 0);
          return '';
        });
      },
      editPipe: (p: Pipeline) => (kapOfPipe(p) ? kapPipeWizardOpen(p.id) : d.wizard(pipeWizard(fresh(), p, savePipe, undefined, live.on))),
      togglePipe: (p: Pipeline) => {
        const k = kapOfPipe(p);
        if (!k) {
          setH((h) => {
            const x = h.pipelines.find((y) => y.id === p.id);
            if (x) x.on = !x.on;
          });
          d.toast(p.id + (p.on ? ' disabled. Scheduled runs stop.' : ' enabled.'));
          audit(p.on ? 'Disabled pipeline' : 'Enabled pipeline', `${p.id}${live.on ? ' · session only' : ''}`);
          return;
        }
        const kp = kpipe(p.id);
        if (!kp) return;
        if (!p.on)
          return d.confirm(`Restore ${p.id}?`, 'KAP creates the pipeline again with its stored stages and the same identity. Access grants on it are not restored.', [], 'Restore', () =>
            liveSave(live, () => kap(tid, 'POST', 'pipelines', toKapPipelineRestore(kp))).then((e) => {
              if (!e) {
                audit('Restored pipeline', p.id);
                d.toast(`${p.id} restored in KAP.`);
              }
              return e;
            }),
          );
        if (p.v.colls.length)
          return d.info(`Delete ${p.id}?`, 'KAP keeps a pipeline that a collection still references. Change or remove these collections first (Business Data Hub):', p.v.colls.map((c) => ({ a: c, b: '', c: '' })));
        d.confirm(`Delete ${p.id}?`, 'KAP removes the pipeline from the tenant configuration (a new configuration version). Its runs stay readable; access grants on it are revoked. Creating a pipeline with the same name restores it.', [], 'Delete', () =>
          liveSave(live, () => kap(tid, 'DELETE', `pipelines/${k.id}`)).then((e) => {
            if (!e) {
              audit('Deleted pipeline', p.id);
              d.toast(`${p.id} deleted in KAP.`);
            }
            return e;
          }),
        );
      },
      runNow,
      retryFailed: (r: Run) => {
        const retryable = r.items.filter((x) => x.res === 'Failed' && x.retry);
        d.confirm(
          `Retry ${retryable.length} failed item(s) of ${r.id}?`,
          'A new run processes only these items. Items that already succeeded are not processed again, so no duplicates are created.',
          retryable.map((x) => ({ a: x.n, b: x.err, c: '' })),
          'Retry failed items',
          () => go.run(simulate(r.pipe, { retryOf: r.id, trig: `Retry of ${r.id} · ${actor}` })),
        );
      },
      retryRun: (r: Run) => {
        const k = kapOfRun(r);
        if (k) return kapRun(r.pipe, k.collection, null);
        const p = pipeOf(fresh(), r.pipe);
        d.confirm(
          `Retry the whole run ${r.id}?`,
          `All inputs are processed again. The write mode (${p?.v.mode || 'document versions'}) replaces or updates existing records, so no duplicates are created.`,
          [],
          'Retry run',
          () => go.run(simulate(r.pipe, { trig: `Full retry of ${r.id} · ${actor}` })),
        );
      },
      ...(live.on
        ? {
            cancelRun: (r: Run) => {
              const k = kapOfRun(r);
              if (!k) return;
              d.confirm(`Cancel ${r.id}?`, 'KAP stops the run at the next safe boundary; a stage already running finishes first. Files already written are kept, and the result counts how many files finished each way.', [], 'Cancel run', () =>
                liveSave(live, () => kap(tid, 'POST', `pipelines/${k.pipelineId}/jobs/${k.job}/cancel`)).then((e) => {
                  if (!e) {
                    audit('Cancelled pipeline run', `${r.pipe} · job ${k.job}`);
                    d.toast(`Cancellation of ${r.id} requested.`);
                  }
                  return e;
                }),
              );
            },
          }
        : {}),
    };

    const fetchRun = (id: string) => {
      if (!t || !live.on || !tid) return;
      const j = kapNow()?.jobs.find((x) => runId(x.id) === id);
      if (j && j.result === undefined && !['waiting', 'running'].includes(j.state)) ensureJobDetail(tid, t, j.id).catch(() => undefined);
    };

    return { tenant: t, H, canData, canRun, canConfigure, live: live.on, go, a, liveState: live, fetchRun };
  }, [t, H, canData, canRun, canConfigure, actor, base, nav, d, live]);
}

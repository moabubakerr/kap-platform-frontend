/**
 * Wires the Data Ingestion Hub builders to the session store, the dialogs, the
 * router and the "view as" permissions. Actions mutate `ingestStore` the way
 * the prototype's `setH` does; runs are simulated (queued → running → result).
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useDialogs } from '@/engine/dialogs';
import { useAccess } from '@/v35/access';
import { ingestStore, isIngestTenant, type IngestTenant, type IngestTenantKey, type Pipeline, type Run, type Source } from '@/v35/data/ingest';
import type { IngestCtx } from './build';
import { finishRun, pipeOf, queueRun, srcOf, startRun, testConn, trigOf, type RunOpts } from './logic';
import { pipeWizard, SAMPLE_FILES, sourceWizard, type PipeSaved, type SourceSaved } from './wizards';

const EMPTY: IngestTenant = { sources: [], pipelines: [], runs: [], pub: { colls: [], datasets: [], documents: [] }, onto: [], creds: [] };

export function useIngest(): IngestCtx & { tenant: IngestTenantKey | null } {
  const scope = useScope();
  const base = useBase();
  const nav = useNavigate();
  const d = useDialogs();
  const key = scope.kind === 'project' ? scope.project.key : null;
  const access = useAccess(key);
  const data = ingestStore.use();
  const t = isIngestTenant(key) ? key : null;
  const H = t ? data[t] : EMPTY;
  const actor = access.uid;

  const canData = access.can('data:manage', 'collection', '*');
  const canRun = access.can('pipeline:execute', 'tenant', '*') || canData;
  const canConfigure = access.can('tenant:configure', 'tenant', '*');

  return React.useMemo(() => {
    const fresh = () => (t ? ingestStore.get()[t] : EMPTY);
    const setH = (fn: (h: IngestTenant) => void) => {
      if (t) ingestStore.update((all) => fn(all[t]));
    };

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
      d.toast(`${id} queued for ${pid}.`);
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

    const runNow = (pid: string) => {
      const h = fresh();
      const p = pipeOf(h, pid);
      const s = p && p.v.src !== 'manual' ? srcOf(h, p.v.src) : null;
      if (!p || !p.on) return;
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
      setH((h) => {
        if (edit) h.sources[h.sources.findIndex((x) => x.id === rec.id)] = rec;
        else h.sources.push(rec);
        if (newRef && !h.creds.includes(newRef)) h.creds.push(newRef);
      });
      d.toast(`${edit ? 'Saved ' : 'Created '}${rec.id} · connection ${ok ? 'succeeded' : 'failed'}.`);
      go.source(rec.id);
    };

    const savePipe = ({ rec, edit, runNow: andRun }: PipeSaved) => {
      setH((h) => {
        if (edit) h.pipelines[h.pipelines.findIndex((x) => x.id === rec.id)] = rec;
        else h.pipelines.push(rec);
      });
      d.toast(`${edit ? 'Saved ' : 'Created '}${rec.id}.`);
      go.pipe(rec.id);
      if (andRun) window.setTimeout(() => runNow(rec.id), 50);
    };

    const a: IngestCtx['a'] = {
      addSource: () => d.wizard(sourceWizard(fresh(), null, actor, saveSource)),
      editSource: (s: Source) => d.wizard(sourceWizard(fresh(), s, actor, saveSource)),
      testSource: (s: Source) => {
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
      },
      toggleSource: (s: Source) => {
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
      },
      addPipe: (fromSource?: Source) => d.wizard(pipeWizard(fresh(), null, savePipe, fromSource)),
      editPipe: (p: Pipeline) => d.wizard(pipeWizard(fresh(), p, savePipe)),
      togglePipe: (p: Pipeline) => {
        setH((h) => {
          const x = h.pipelines.find((y) => y.id === p.id);
          if (x) x.on = !x.on;
        });
        d.toast(p.id + (p.on ? ' disabled. Scheduled runs stop.' : ' enabled.'));
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
        const p = pipeOf(fresh(), r.pipe);
        d.confirm(
          `Retry the whole run ${r.id}?`,
          `All inputs are processed again. The write mode (${p?.v.mode || 'document versions'}) replaces or updates existing records, so no duplicates are created.`,
          [],
          'Retry run',
          () => go.run(simulate(r.pipe, { trig: `Full retry of ${r.id} · ${actor}` })),
        );
      },
    };

    return { tenant: t, H, canData, canRun, canConfigure, go, a };
  }, [t, H, canData, canRun, canConfigure, actor, base, nav, d]);
}

import { describe, expect, it } from 'vitest';
import { toRun, type KapJob, type KapPipeline } from './fromKap';
import {
  failedStep, followUp, hhmm, intervalWords, isZeroRun, laterRuns, earlierWork, splitRelated, isEmptyScan, foldEmptyScans, emptyScansLabel, runNowDecision, progressOf, runFiles, runItems, runSteps, stageSteps, triggerOf, zeroExplanation,
  TRIGGER_CONSOLE, TRIGGER_OUTSIDE, type KapFileItem, type RunGroup,
} from './runView';

const NOW = Date.parse('2026-11-25T11:40:00Z');
const at = (hms: string) => `2026-11-25T${hms}Z`;

// fixtures shaped from PipelineOut, PipelineJobDetail / PipelineJobListItem and FileListItem
const docPipe: Pick<KapPipeline, 'kind' | 'stages'> = {
  kind: 'document',
  stages: [
    { name: 'parse', type: 'parser', routes: [{ match: { extensions: ['pdf'] }, parser: { provider: 'pdf', output: 'markdown' } }] },
    { name: 'transform', type: 'transformer', config: { model_ref: 'chat', tasks: [{ name: 'summary', enabled: true }] } },
    { name: 'embed', type: 'embedding', config: { model_ref: 'emb' } },
  ],
};
const indPipe: Pick<KapPipeline, 'kind' | 'stages'> = { kind: 'indicators', stages: [{ name: 'load_csv', type: 'csv_loader', config: { files: { 'registry*.csv': 'registry' } } }] };

const COLL = 'cccccccc-0000-0000-0000-000000000001';
const CONN = 'dddddddd-0000-0000-0000-000000000001';
const job = (o: Partial<KapJob>): KapJob => ({
  id: 'b2c87eba-0000-0000-0000-000000000001',
  pipeline_id: 'pppppppp-0000-0000-0000-000000000001',
  collection_id: COLL,
  connector_id: null,
  state: 'succeeded',
  progress: { total: 0, completed: 0, percent: null },
  created_at: at('11:33:00'),
  running_at: at('11:33:01'),
  finished_at: at('11:33:01'),
  result: { succeeded: 0, failed: 0, cancelled: 0 },
  error: null,
  ...o,
});
const file = (name: string, state: string, changed: string, o: Partial<KapFileItem> = {}): KapFileItem => ({
  id: `f-${name}`,
  collection_id: COLL,
  connector_id: CONN,
  name,
  source_path: `docs/${name}`,
  state,
  file_type: 'pdf',
  size_bytes: 2048,
  current_version_number: 1,
  version_count: 1,
  content_changed_at: changed,
  ...o,
});
const names = { pipes: {}, colls: { [COLL]: 'qa_docs' }, conns: { [CONN]: 'qa_s3' } };

describe('trigger labels', () => {
  it('labels console runs, scans and other manual runs', () => {
    expect(triggerOf({ connector_id: null }, '', true).label).toBe(TRIGGER_CONSOLE);
    expect(triggerOf({ connector_id: CONN }, 'qa_s3', true).label).toBe(TRIGGER_CONSOLE); // Run now narrowed to a connector
    expect(triggerOf({ connector_id: CONN }, 'qa_s3', false)).toEqual({ kind: 'scan', label: 'Data source scan · qa_s3' });
    expect(triggerOf({ connector_id: null }, '', false).label).toBe(TRIGGER_OUTSIDE);
  });

  it('uses the labels in the hub runs', () => {
    expect(toRun(job({}), NOW, { ...names, ours: (id) => id.startsWith('b2c87eba') }).trig).toBe(TRIGGER_CONSOLE);
    const scan = toRun(job({ id: '417afc22-0000-0000-0000-000000000001', connector_id: CONN }), NOW, { ...names, ours: () => false });
    expect(scan.trig).toBe('Data source scan · qa_s3');
    expect(scan.kap).toMatchObject({ trigger: 'scan', total: 0, completed: 0 });
    expect(toRun(job({}), NOW, names)).toMatchObject({ trig: TRIGGER_OUTSIDE, inN: 'No new or changed files', outN: 'Nothing to process', stages: [] });
  });
});

describe('intervals and progress', () => {
  it('words sync intervals', () => {
    expect(['PT3M', 'PT1M', 'PT1H', 'PT6H', 'P1D', 'PT1H30M', 'bogus'].map(intervalWords)).toEqual(['every 3 minutes', 'every minute', 'every hour', 'every 6 hours', 'every day', 'every 1 hour 30 minutes', 'every bogus']);
  });

  it('reports progress, indeterminate until discovery finished', () => {
    expect(progressOf(job({ state: 'running', finished_at: null, progress: { total: null, completed: 0, percent: null } }))).toMatchObject({ indeterminate: true, label: 'Counting new and changed files…' });
    expect(progressOf(job({ state: 'running', finished_at: null, progress: { total: 5, completed: 3, percent: 60 } }))).toMatchObject({ indeterminate: false, percent: 60, label: '3 of 5 files' });
    expect(progressOf(job({ state: 'running', progress: { total: 4, completed: 1, percent: null } })).percent).toBe(25);
    expect(progressOf(job({})).label).toBe('No files to process');
  });
});

describe('steps', () => {
  it('derives steps from the pipeline stages', () => {
    expect(stageSteps(docPipe).map((s) => s.title)).toEqual(['Parse', 'Transform', 'Embed']);
    expect(stageSteps(indPipe).map((s) => s.title)).toEqual(['Load CSV', 'Validate']);
    expect(stageSteps({ kind: 'document', stages: [docPipe.stages[0], docPipe.stages[2]] })[1].states).toContain('parsed');
    expect(failedStep('failed_parsing', stageSteps(docPipe))).toBe(0);
    expect(failedStep('failed_embedding', stageSteps(docPipe))).toBe(2);
    expect(failedStep('embedded', stageSteps(docPipe))).toBe(-1);
  });

  it('shows a queued run', () => {
    const s = runSteps(job({ state: 'waiting', running_at: null, finished_at: null, result: null, progress: { total: null, completed: 0, percent: null } }), docPipe, null, NOW);
    expect(s.map((x) => [x.key, x.state])).toEqual([
      ['queued', 'current'],
      ['discover', 'pending'],
      ['stage:parse', 'pending'],
      ['stage:transform', 'pending'],
      ['stage:embed', 'pending'],
      ['finished', 'pending'],
    ]);
  });

  it('shows discovery in progress, then files moving through the stages', () => {
    const disc = runSteps(job({ state: 'running', finished_at: null, result: null, progress: { total: null, completed: 0, percent: null } }), docPipe, [], NOW);
    expect(disc.slice(0, 2).map((x) => x.state)).toEqual(['done', 'current']);
    const files = [file('a.pdf', 'transforming', at('11:33:30')), file('b.pdf', 'parsing', at('11:33:30')), file('c.pdf', 'embedded', at('11:33:30'))];
    const s = runSteps(job({ state: 'running', finished_at: null, result: null, progress: { total: 3, completed: 1, percent: 33 } }), docPipe, files, NOW);
    expect(s.map((x) => x.state)).toEqual(['done', 'done', 'current', 'current', 'pending', 'pending']);
    expect(s[1].detail).toBe('3 new or changed files.');
    expect(s[2].detail).toBe('1 file in this step now.');
  });

  it('shows a finished run with a failed file and the error', () => {
    const files = [file('a.pdf', 'embedded', at('11:33:30')), file('b.pdf', 'failed_parsing', at('11:33:30'))];
    const s = runSteps(job({ progress: { total: 2, completed: 2, percent: 100 }, finished_at: at('11:34:01'), result: { succeeded: 1, failed: 1, cancelled: 0 } }), docPipe, files, NOW);
    expect(s.map((x) => x.state)).toEqual(['done', 'done', 'failed', 'done', 'done', 'done']);
    expect(s[2].detail).toBe('1 file done · 1 file failed.');
    expect(s[5].detail).toBe('Succeeded: 1 succeeded · 1 failed · 0 cancelled.');
    const f = runSteps(job({ state: 'failed', progress: { total: null, completed: 0, percent: null }, result: { succeeded: 0, failed: 0, cancelled: 0 }, error: { code: 'discovery_failed', message: 'The connector is unavailable.' } }), docPipe, [], NOW);
    expect(f.map((x) => x.state)).toEqual(['done', 'failed', 'skipped', 'skipped', 'skipped', 'failed']);
    expect(f[5].detail).toContain('discovery_failed: The connector is unavailable.');
  });
});

describe('a run that found nothing', () => {
  it('is recognised and explained with the scan interval', () => {
    const z = job({});
    expect(isZeroRun(z)).toBe(true);
    expect(isZeroRun(job({ progress: { total: null, completed: 0, percent: null } }))).toBe(true);
    expect(isZeroRun(job({ progress: { total: 1, completed: 1, percent: 100 }, result: { succeeded: 1, failed: 0, cancelled: 0 } }))).toBe(false);
    expect(isZeroRun(job({ state: 'running' }))).toBe(false);
    expect(runSteps(z, docPipe, [], NOW).map((x) => x.state)).toEqual(['done', 'done', 'skipped', 'skipped', 'skipped', 'done']);
    const e = zeroExplanation([{ name: 'qa_s3', interval: 'PT3M' }]);
    expect(e.title).toBe('Nothing new to process');
    expect(e.lines[2]).toContain('the next scan of qa_s3 (every 3 minutes)');
  });

  it('finds the later runs of the collection and describes them', () => {
    const z = job({});
    const scan = job({ id: '417afc22-0000-0000-0000-000000000001', connector_id: CONN, created_at: at('11:36:00'), progress: { total: 1, completed: 1, percent: 100 }, result: { succeeded: 1, failed: 0, cancelled: 0 } });
    const other = job({ id: 'eeeeeeee-0000-0000-0000-000000000001', collection_id: 'other', created_at: at('11:37:00') });
    const older = job({ id: 'ffffffff-0000-0000-0000-000000000001', created_at: at('11:00:00') });
    const later = laterRuns(z, [other, scan, older, z]);
    expect(later.map((x) => x.id.slice(0, 8))).toEqual(['417afc22']);
    const f = followUp(scan, 'qa_s3', false);
    expect(f.label).toBe(`Scan of qa_s3 at ${hhmm(scan.created_at)}`);
    expect(f.outcome).toBe('processed 1 file');
    expect(followUp(job({ connector_id: CONN, state: 'running', finished_at: null, result: null, progress: { total: 2, completed: 1, percent: 50 } }), 'qa_s3', false).outcome).toBe('is processing 2 files (1 done)');
    expect(followUp(job({}), '', true)).toMatchObject({ outcome: 'found nothing new', active: false });
  });

  it('explains a zero-file run with the scan that ran just before it (seen on the stand)', () => {
    // 25 Nov 2026: scan 4d37de26 at 12:09:02 processed 3 files; Run now 415ebba… at 12:09:17 found nothing
    const manual = job({ id: '415ebba0-0000-0000-0000-000000000001', created_at: at('12:09:17'), running_at: at('12:09:17'), finished_at: at('12:09:17') });
    const scan = job({ id: '4d37de26-0000-0000-0000-000000000001', connector_id: CONN, created_at: at('12:09:02'), progress: { total: 3, completed: 3, percent: 100 }, result: { succeeded: 3, failed: 0, cancelled: 0 } });
    const emptyScan = job({ id: '11111111-0000-0000-0000-000000000001', connector_id: CONN, created_at: at('12:06:02') });
    const tooOld = job({ id: '22222222-0000-0000-0000-000000000001', connector_id: CONN, created_at: at('11:30:00'), progress: { total: 1, completed: 1, percent: 100 }, result: { succeeded: 1, failed: 0, cancelled: 0 } });
    const rel = laterRuns(manual, [manual, scan, emptyScan, tooOld]);
    expect(rel.map((x) => x.id.slice(0, 8))).toEqual(['11111111', '4d37de26']);
    expect(splitRelated(manual, rel).before.map((x) => x.id.slice(0, 8))).toEqual(['4d37de26', '11111111']);
    const e = earlierWork(manual, rel)!;
    expect(e.id.slice(0, 8)).toBe('4d37de26');
    const z = zeroExplanation([{ name: 'qa_s3', interval: 'PT3M' }], followUp(e, 'qa_s3', false));
    expect(z.title).toBe('Already processed by an earlier run');
    expect(z.lines[0]).toContain('processed 3 files, just before this run started');
  });
});

describe('processed items', () => {
  it('keeps the files changed in the run window or still in progress', () => {
    const run = job({ state: 'running', finished_at: null, result: null, created_at: at('11:36:00'), connector_id: CONN, progress: { total: 2, completed: 0, percent: 0 } });
    const all = [
      file('new.pdf', 'parsing', at('11:35:40')),
      file('old.pdf', 'embedded', at('09:00:00')),
      file('stuck.pdf', 'transforming', at('10:00:00')),
      file('elsewhere.pdf', 'parsing', at('11:36:10'), { connector_id: 'other' }),
      file('new.pdf', 'parsing', at('11:35:40')),
    ];
    expect(runFiles(run, all, NOW, 'document').map((f) => f.name)).toEqual(['new.pdf', 'stuck.pdf']);
    const done = job({ created_at: at('11:36:00'), finished_at: at('11:37:00'), progress: { total: 1, completed: 1, percent: 100 } });
    expect(runFiles(done, [file('new.pdf', 'embedded', at('11:35:40')), file('stuck.pdf', 'transforming', at('10:00:00'))], NOW, 'document').map((f) => f.name)).toEqual(['new.pdf']);
  });

  it('labels each file and links documents', () => {
    const items = runItems([file('a.pdf', 'embedded', at('11:36:00')), file('b.pdf', 'failed_embedding', at('11:36:00')), file('c.pdf', 'transformed', at('11:36:00'))], docPipe, 'qa_docs');
    expect(items.map((i) => [i.result, i.tone, i.docId])).toEqual([
      ['Processed', 'ok', 'qa_docs:a.pdf'],
      ['Failed in embed (failed_embedding)', 'bad', 'qa_docs:b.pdf'],
      ['Embed · transformed', 'run', 'qa_docs:c.pdf'],
    ]);
    expect(runItems([file('r.csv', 'loaded', at('11:36:00'))], indPipe, 'ind')[0]).toMatchObject({ result: 'Processed', docId: null });
  });
});

describe('empty scans', () => {
  // 25 Nov 2026 on the stand: one upload, then a scan run every 3 minutes for qa_docs
  const S = (id: string, t: string, n = 0) =>
    job({ id: `${id}-0000-0000-0000-000000000001`, connector_id: CONN, created_at: at(t), progress: { total: n, completed: n, percent: n ? 100 : null }, result: { succeeded: n, failed: 0, cancelled: 0 } });
  const real = S('4d37de26', '12:09:02', 3);
  const manual = job({ id: '8415ebba-0000-0000-0000-000000000001', created_at: at('12:09:17') });
  const e1 = S('87bc5a04', '12:12:02'), e2 = S('471cf670', '12:15:02'), e3 = S('627cf39b', '12:18:02');
  const ours = (id: string) => id.startsWith('8415ebba');

  it('treats scans that found nothing as noise, but not console runs or scans that worked', () => {
    expect(isEmptyScan(e1, false)).toBe(true);
    expect(isEmptyScan(real, false)).toBe(false);
    expect(isEmptyScan(manual, true)).toBe(false);
  });

  it('folds consecutive empty scans into one entry', () => {
    const g = foldEmptyScans([real, manual, e1, e2, e3], ours);
    expect(g.map((x) => (x.kind === 'run' ? x.job.id.slice(0, 8) : `${x.jobs.length} empty`))).toEqual(['4d37de26', '8415ebba', '3 empty']);
    const folded = g[2] as Extract<RunGroup, { kind: 'empty' }>;
    expect(emptyScansLabel(folded.jobs, 'qa_s3')).toBe(`3 scans of qa_s3 found nothing new (${hhmm(e1.created_at)}–${hhmm(e3.created_at)})`);
  });
});

describe('Run now', () => {
  // 25 Nov 2026, 1-minute scans: scan 8ffe7095 processed the upload at 12:37; Run now at 12:37:58 made an empty run
  const NOW2 = Date.parse(at('12:37:58'));
  const scan = job({ id: '8ffe7095-0000-0000-0000-000000000001', connector_id: CONN, created_at: at('12:37:05'), finished_at: at('12:37:07'), progress: { total: 1, completed: 1, percent: 100 }, result: { succeeded: 1, failed: 0, cancelled: 0 } });
  const empty = job({ id: '33333333-0000-0000-0000-000000000001', connector_id: CONN, created_at: at('12:36:05'), finished_at: at('12:36:05') });

  it('shows the scan that already did the work instead of starting an empty run', () => {
    expect(runNowDecision([scan, empty], 0, null, NOW2)).toMatchObject({ kind: 'join', why: 'done', job: { id: scan.id } });
  });
  it('joins a run in progress', () => {
    const busy = job({ ...scan, state: 'running', finished_at: null, result: null, progress: { total: 1, completed: 0, percent: 0 } });
    expect(runNowDecision([busy], 1, null, NOW2)).toMatchObject({ kind: 'join', why: 'active' });
  });
  it('starts a run when files are waiting, or when nothing recent explains an empty run', () => {
    expect(runNowDecision([scan], 2, null, NOW2).kind).toBe('start');
    expect(runNowDecision([scan], 0, null, NOW2 + 30 * 60_000).kind).toBe('start');
    expect(runNowDecision([scan], null, null, NOW2).kind).toBe('start');
  });
});

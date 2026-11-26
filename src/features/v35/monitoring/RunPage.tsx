import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Waypoints } from 'lucide-react';
import { useBase, useScope } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { useTrace } from '@/api/traces';
import { ScreenView } from '@/engine/ScreenView';
import { act, statusPill } from '@/engine/build';
import type { Section } from '@/engine/types';
import { EmptyState, Skeleton } from '@/components/common/primitives';
import { JsonViewer } from '@/components/common/JsonViewer';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/common/layout';
import { RUN_TABS, runEvidence, runOverview, runRepro, runSpans } from './build';
import { useAddToTestSet } from '@/features/v35/evals/addToSet';

/** Run detail (route /monitoring/runs/:jobId/:tab?): Overview · Path and Trace · Evidence · Reproductions. */
export default function RunPage() {
  const { jobId = '', tab = 'overview' } = useParams();
  const base = useBase();
  const scope = useScope();
  const nav = useNavigate();
  const live = scope.kind === 'project' && !!scope.project.live;
  const addCase = useAddToTestSet(live && scope.kind === 'project' ? scope.project.tenantId : null);
  const { data: t, isLoading } = useTrace(jobId);
  const [sel, setSel] = React.useState<string | null>(null);
  const current = RUN_TABS.find((x) => x.value === tab)?.value ?? 'overview';
  const short = jobId.length > 12 ? jobId.slice(0, 8) : jobId;
  useCrumbs(['Jobs', short, RUN_TABS.find((x) => x.value === current)?.label]);

  React.useEffect(() => setSel(null), [jobId]);

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-[480px]" />
      </Page>
    );
  }
  if (!t) {
    return (
      <Page>
        <EmptyState
          icon={<Waypoints size={22} />}
          title={`No execution ${short}`}
          body={live ? 'The job may not have been synced from KAP yet (every 15 s), or the ID is wrong.' : 'The job may have been purged from history, or the ID is wrong.'}
          actions={<Button onClick={() => nav(`${base}/monitoring`)}>Open jobs</Button>}
        />
      </Page>
    );
  }

  const selected = t.spans.find((s) => s.id === (sel ?? t.defaultSpan)) ?? null;
  let sections: Section[];
  if (current === 'trace') {
    sections = [
      { title: `Trace · ${t.spans.length} spans · ${t.duration}`, tl: runSpans(t, selected?.id ?? null, setSel), note: 'Select a span to see what was sent and returned.' },
      ...(selected
        ? [
            {
              title: selected.kind === 'Tool' ? `${selected.rawName} · input and output` : `${selected.name} · details`,
              custom: (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="text-xs font-semibold text-ink-muted">Input</div>
                    <JsonViewer value={selected.input ?? null} maxHeight={360} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="text-xs font-semibold text-ink-muted">Output</div>
                    <JsonViewer value={selected.output ?? null} maxHeight={360} />
                  </div>
                </div>
              ),
            } as Section,
          ]
        : []),
      ...(t.spans.some((s) => s.state === 'error' || s.error)
        ? [{ title: 'Errors and failure details', cols: ['Span', 'Error', 'Detail'], rows: t.spans.filter((s) => s.state === 'error' || s.error).map((s) => ({ key: `er:${s.id}`, cells: [{ v: s.name }, { v: s.error ?? 'Failed' }, { v: s.kind }] })) } as Section]
        : []),
    ];
  } else if (current === 'evidence') sections = runEvidence(t);
  else if (current === 'repro') sections = runRepro(t);
  else sections = runOverview(t, { live, openAgent: (a) => nav(`${base}/agents/${a}`) });

  return (
    <ScreenView
      model={{
        head: {
          title: `Job ${short}`,
          status: statusPill(t.statusLabel),
          tabs: RUN_TABS,
          tab: current,
          setTab: (v) => nav(`${base}/monitoring/runs/${jobId}${v === 'overview' ? '' : `/${v}`}`),
          acts: [
            ...(live && t.prompt ? [act('Add to test set', () => void addCase({ question: t.prompt, answer: t.answer ? t.answer.map((p) => (typeof p === 'string' ? p : p.v)).join('') : null, source: 'monitoring' }))] : []),
            act('Back to jobs', () => nav(`${base}/monitoring`)),
          ],
        },
        sections,
      }}
    />
  );
}

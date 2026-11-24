import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThumbsDown } from 'lucide-react';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { Page, PageHeader } from '@/components/common/layout';
import { EmptyState, Skeleton } from '@/components/common/primitives';
import { Badge } from '@/components/ui/badge';
import { StatusPill, type Status } from '@/components/ui/status-pill';
import { useFeedbackQueue } from '@/api/conversations';
import { FEEDBACK_SUMMARY, type ChatMessage } from '@/mocks/conversations';
import { SelectChip, SummaryStrip } from '@/features/jobs/SelectChip';

type StatusF = 'open' | 'any' | 'New' | 'Triaged' | 'Resolved';
const STATUS_PILL: Record<string, Status> = { New: 'running', Triaged: 'hold', Resolved: 'approved' };

export default function FeedbackPage() {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = useFeedbackQueue();
  const [status, setStatus] = React.useState<StatusF>('open');
  const [reason, setReason] = React.useState('any');
  const [type, setType] = React.useState('any');
  const [lang, setLang] = React.useState('any');

  const rows = React.useMemo(
    () =>
      (data ?? []).filter((m) => {
        const f = m.feedback!;
        if (status === 'open' && f.status === 'Resolved') return false;
        if (status !== 'open' && status !== 'any' && f.status !== status) return false;
        if (reason !== 'any' && f.reason !== reason) return false;
        if (type !== 'any' && m.answerType !== type) return false;
        if (lang !== 'any' && m.lang !== lang) return false;
        return true;
      }),
    [data, status, reason, type, lang],
  );

  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter(Boolean) as string[])];
  const reasons = uniq((data ?? []).map((m) => m.feedback?.reason));
  const types = uniq((data ?? []).map((m) => m.answerType));

  return (
    <ProjectPage resource="feedback">
      <Page>
        <PageHeader title="Feedback" description="Negative feedback from Ask AI users, queued for review. Each item links to the message trace." />
        <SummaryStrip items={FEEDBACK_SUMMARY} min={150} />
        <div className="flex flex-wrap gap-2">
          <SelectChip
            label="Status"
            value={status}
            defaultValue="any"
            onChange={setStatus}
            options={[
              { value: 'open', label: 'open' },
              { value: 'any', label: 'any' },
              { value: 'New', label: 'New' },
              { value: 'Triaged', label: 'Triaged' },
              { value: 'Resolved', label: 'Resolved' },
            ]}
          />
          <SelectChip label="Reason" value={reason} defaultValue="any" onChange={setReason} options={[{ value: 'any', label: 'any' }, ...reasons.map((r) => ({ value: r, label: r }))]} />
          <SelectChip label="Answer type" value={type} defaultValue="any" onChange={setType} options={[{ value: 'any', label: 'any' }, ...types.map((t) => ({ value: t, label: t }))]} />
          <SelectChip
            label="Language"
            value={lang}
            defaultValue="any"
            onChange={setLang}
            options={[
              { value: 'any', label: 'any' },
              { value: 'EN', label: 'English' },
              { value: 'AR', label: 'Arabic' },
            ]}
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-72" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<ThumbsDown size={22} />} title="No feedback matches these filters" body="Change the status or reason filter to see more." />
        ) : (
          <div className="card overflow-auto">
            <table className="w-full min-w-[1100px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-sunken text-left text-xs text-ink-muted">
                  {['', 'Message', 'Question', 'Answer type', 'Reason', 'User comment', 'Status', 'When', ''].map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-3 py-[9px] font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <Row key={m.message_id} m={m} base={base} onOpen={() => nav(`${base}/conversations/${m.message_id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Page>
    </ProjectPage>
  );
}

function Row({ m, base, onOpen }: { m: ChatMessage; base: string; onOpen: () => void }) {
  const f = m.feedback!;
  return (
    <tr onClick={onOpen} className="cursor-pointer border-t border-line-subtle hover:bg-surface-hover">
      <td className="w-7 px-3 py-[9px] text-danger">
        <ThumbsDown size={15} />
      </td>
      <td className="px-3 py-[9px] font-mono text-[12.5px]">{m.message_id}</td>
      <td className="max-w-[280px] px-3 py-[9px]">
        <div dir="auto" className="ellipsis text-left text-ink-strong">
          {m.question}
        </div>
        <div className="text-[11.5px] text-ink-muted">{m.lang === 'AR' ? 'Arabic' : 'English'}</div>
      </td>
      <td className="px-3 py-[9px]">
        <Badge tone={m.tone}>{m.answerType}</Badge>
      </td>
      <td className="whitespace-nowrap px-3 py-[9px]">{f.reason ?? '—'}</td>
      <td className="max-w-[260px] px-3 py-[9px] text-ink-muted">
        <div dir="auto" className="ellipsis text-left">
          {f.comment ?? '—'}
        </div>
      </td>
      <td className="px-3 py-[9px]">{f.status && <StatusPill status={STATUS_PILL[f.status]} label={f.status} />}</td>
      <td className="whitespace-nowrap px-3 py-[9px] text-ink-muted">{f.rel}</td>
      <td className="px-3 py-[9px] text-right">
        <Link to={`${base}/conversations/${m.message_id}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">
          Open trace
        </Link>
      </td>
    </tr>
  );
}

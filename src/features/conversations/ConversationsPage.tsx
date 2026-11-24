import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/common/layout';
import { RelTime, Skeleton } from '@/components/common/primitives';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useMessages } from '@/api/conversations';
import { CONV_SUMMARY, type AnswerType, type ChatMessage } from '@/mocks/conversations';
import { SearchBox, SelectChip, SummaryStrip } from '@/features/jobs/SelectChip';
import { UserRef } from './shared';

const TYPES: AnswerType[] = ['Numeric', 'Article', 'Template fallback', 'Refusal', 'General chat', 'Explanation'];
const RANGE_H = { today: 14.4, '24h': 24, '7d': 168 } as const;

export default function ConversationsPage() {
  return (
    <ProjectPage resource="conversations">
      <ConversationsView />
    </ProjectPage>
  );
}

function ConversationsView() {
  const base = useBase();
  const nav = useNavigate();
  const { data, isLoading } = useMessages();
  const [q, setQ] = React.useState('');
  const [type, setType] = React.useState<'any' | AnswerType>('any');
  const [lang, setLang] = React.useState<'any' | 'EN' | 'AR'>('any');
  const [fb, setFb] = React.useState<'any' | 'up' | 'down' | 'none'>('any');
  const [range, setRange] = React.useState<keyof typeof RANGE_H>('7d');

  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const now = Math.max(0, ...(data ?? []).map((m) => Date.parse(m.asked_at)));
    return (data ?? []).filter(
      (m) =>
        (type === 'any' || m.answerType === type) &&
        (lang === 'any' || m.lang === lang) &&
        (fb === 'any' || (fb === 'none' ? !m.feedback : fb === 'up' ? m.feedback?.helpful === true : m.feedback?.helpful === false)) &&
        (now - Date.parse(m.asked_at)) / 3_600_000 <= RANGE_H[range] &&
        (!s || m.message_id.includes(s) || m.question.toLowerCase().includes(s)),
    );
  }, [data, q, type, lang, fb, range]);

  const columns = React.useMemo<ColumnDef<ChatMessage, any>[]>(
    () => [
      { id: 'id', header: 'Message', accessorKey: 'message_id', cell: ({ row }) => <span className="font-mono text-[12.5px]">{row.original.message_id}</span> },
      { id: 'user', header: 'User', accessorKey: 'user', cell: ({ row }) => <UserRef name={row.original.user} base={base} /> },
      {
        id: 'lang',
        header: 'Lang',
        accessorKey: 'lang',
        cell: ({ row }) => <span className="rounded-card bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] font-semibold">{row.original.lang}</span>,
      },
      {
        id: 'q',
        header: 'Question',
        accessorKey: 'question',
        enableSorting: false,
        cell: ({ row }) => (
          <div dir="auto" className="ellipsis max-w-[320px] text-left text-ink-strong" title={row.original.question}>
            {row.original.question}
          </div>
        ),
      },
      { id: 'type', header: 'Answer type', accessorKey: 'answerType', cell: ({ row }) => <Badge tone={row.original.tone}>{row.original.answerType}</Badge> },
      { id: 'path', header: 'Pipeline path', accessorKey: 'path', enableSorting: false, cell: ({ row }) => <span className="whitespace-nowrap text-xs text-ink-muted">{row.original.path}</span> },
      {
        id: 'lat',
        header: () => <span className="block w-full text-right">Latency</span>,
        accessorKey: 'latency_ms',
        cell: ({ row }) => <div className="text-right font-mono text-[12.5px]">{row.original.latency}</div>,
      },
      {
        id: 'fb',
        header: 'Feedback',
        accessorFn: (m) => (m.feedback ? (m.feedback.helpful ? 1 : -1) : 0),
        cell: ({ row }) => {
          const f = row.original.feedback;
          if (!f) return null;
          return f.helpful ? <ThumbsUp size={14} className="text-success" aria-label="Helpful" /> : <ThumbsDown size={14} className="text-danger" aria-label="Not helpful" />;
        },
      },
      { id: 'when', header: 'When', accessorFn: (m) => Date.parse(m.asked_at), cell: ({ row }) => <RelTime rel={row.original.rel} abs={row.original.abs} /> },
    ],
    [base],
  );

  return (
    <Page className="gap-4 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <h1 className="h1">
            Conversations <span className="text-[15px] font-medium text-ink-muted">{data?.length ?? 508} messages</span>
          </h1>
          <p className="mt-1 text-ink-muted">Ask AI sessions and messages in English and Arabic. Select a message to see how the pipeline answered it.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast('Read-only in this version')}>
          <Download size={14} />
          Export
        </Button>
      </div>

      <SummaryStrip items={CONV_SUMMARY} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search question or message ID" />
        <SelectChip label="Answer type" value={type} defaultValue="any" onChange={setType} options={[{ value: 'any', label: 'any' }, ...TYPES.map((t) => ({ value: t, label: t, count: data?.filter((m) => m.answerType === t).length }))]} />
        <SelectChip
          label="Language"
          value={lang}
          defaultValue="any"
          onChange={setLang}
          options={[
            { value: 'any', label: 'any' },
            { value: 'EN', label: 'English', count: data?.filter((m) => m.lang === 'EN').length },
            { value: 'AR', label: 'Arabic', count: data?.filter((m) => m.lang === 'AR').length },
          ]}
        />
        <SelectChip
          label="Feedback"
          value={fb}
          defaultValue="any"
          onChange={setFb}
          options={[
            { value: 'any', label: 'any' },
            { value: 'up', label: 'Helpful', count: data?.filter((m) => m.feedback?.helpful).length },
            { value: 'down', label: 'Not helpful', count: data?.filter((m) => m.feedback && !m.feedback.helpful).length },
            { value: 'none', label: 'No feedback' },
          ]}
        />
        <SelectChip
          bare
          active
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Today' },
            { value: '24h', label: '24 hours' },
            { value: '7d', label: '7 days' },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-[520px]" />
      ) : (
        <DataTable data={rows} columns={columns} pageSize={14} onRowClick={(m) => nav(`${base}/conversations/${m.message_id}`)} emptyTitle="No messages match these filters" />
      )}
    </Page>
  );
}

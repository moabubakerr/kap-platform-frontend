import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { Bot, Database, ListChecks, Network, Plus, Search, User, Waypoints, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { head?: string; name: string; desc: string; icon: LucideIcon; to: string; kind: string };

export function CommandPalette({ open, onOpenChange, base }: { open: boolean; onOpenChange: (o: boolean) => void; base: string }) {
  const nav = useNavigate();
  const [q, setQ] = React.useState('');
  const [idx, setIdx] = React.useState(0);

  const all: Item[] = React.useMemo(
    () => [
      { head: 'Actions', name: 'Create agent', desc: '', icon: Plus, to: `${base}/agents/new`, kind: 'Action' },
      { name: 'Go to Agent jobs', desc: '', icon: ListChecks, to: `${base}/jobs`, kind: 'Action' },
      { name: 'Open agents map', desc: '', icon: Network, to: `${base}/map`, kind: 'Action' },
      { head: 'Resources', name: 'sceai_indicators_oxford', desc: 'Agent · planner_and_executor', icon: Bot, to: `${base}/agents/sceai_indicators_oxford`, kind: 'Agent' },
      { name: 'sceai_indicators_agent', desc: 'Agent · planner_and_executor', icon: Bot, to: `${base}/agents/sceai_indicators_agent`, kind: 'Agent' },
      { name: 'sceai_indicators', desc: 'Collection · 8,104 observations', icon: Database, to: `${base}/collections/sceai_indicators`, kind: 'Collection' },
      { name: 'sceai_analyst', desc: 'User · analyst', icon: User, to: `${base}/users/sceai_analyst`, kind: 'User' },
      { name: 'sceai_admin', desc: 'User · administrator', icon: User, to: `${base}/users/sceai_admin`, kind: 'User' },
      { head: 'Recent jobs', name: '93c7a1f2…', desc: 'sceai_indicators_oxford · tourism contribution to GDP, Q4 2024', icon: Waypoints, to: `${base}/traces/93c7a1f2`, kind: 'Job' },
    ],
    [base],
  );

  const items = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    const hit = all.filter((i) => `${i.name} ${i.desc} ${i.kind}`.toLowerCase().includes(s));
    return hit.map((h, i) => ({ ...h, head: i === 0 ? 'Results' : undefined }));
  }, [q, all]);

  React.useEffect(() => setIdx(0), [q, open]);

  const go = (i: Item) => {
    onOpenChange(false);
    setQ('');
    nav(i.to);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[79] bg-[rgba(31,26,28,.28)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-20 z-[80] w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-[12px] border border-line-subtle bg-surface shadow-xl outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter' && items[idx]) {
              e.preventDefault();
              go(items[idx]);
            }
          }}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-line-subtle px-4 py-3.5 text-ink-muted">
            <Search size={15} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or ID"
              className="flex-1 bg-transparent text-[15px] text-ink-strong outline-none placeholder:text-ink-subtle"
            />
            <span className="rounded-card border border-line px-1.5 py-0.5 font-mono text-[11px]">Esc</span>
          </div>
          <div className="max-h-[420px] overflow-auto p-1.5">
            {items.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-ink-muted">No matches for “{q}”</div>}
            {items.map((it, i) => (
              <React.Fragment key={it.name + i}>
                {it.head && <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-subtle">{it.head}</div>}
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(it)}
                  className={cn('flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left', i === idx ? 'bg-brand-tint' : 'hover:bg-surface-hover')}
                >
                  <it.icon size={15} className="flex-none text-ink-muted" />
                  <span className={cn('whitespace-nowrap text-[13.5px] text-ink-strong', it.kind !== 'Action' && 'font-mono')}>{it.name}</span>
                  <span className="ellipsis flex-1 text-xs text-ink-muted">{it.desc}</span>
                  <span className="whitespace-nowrap text-[11.5px] text-ink-subtle">{it.kind}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
          <div className="flex gap-4 border-t border-line-subtle bg-surface-sunken px-4 py-2 text-[11.5px] text-ink-subtle">
            <span>Enter to open</span>
            <span>Up and down to move</span>
            <span>Search by name or ID</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

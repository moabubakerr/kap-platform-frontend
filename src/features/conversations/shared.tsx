import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { userByName } from '@/mocks/core';
import type { MsgPart } from '@/mocks/conversations';

/** Console users link to their page; anonymous Ask AI guests are plain text. */
export function UserRef({ name, base, className }: { name: string; base: string; className?: string }) {
  const u = userByName(name);
  const cls = cn('font-mono text-[12.5px]', className);
  if (!u) return <span className={cn(cls, 'text-ink-body')}>{name}</span>;
  return (
    <Link to={`${base}/users/${u.username}`} onClick={(e) => e.stopPropagation()} className={cls}>
      {name}
    </Link>
  );
}

/** Answer with numbered number chips (maroon = data point, outlined = computed). */
export function NumberedAnswer({ parts }: { parts: MsgPart[] }) {
  return (
    <div dir="auto" className="text-left text-[14.5px] leading-[1.75] text-ink-strong">
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : p.computed ? (
          <span key={i} className="whitespace-nowrap rounded-card border border-line bg-surface-sunken px-[5px] py-px font-semibold text-ink-strong">
            {p.v}
            <sup className="ml-0.5 text-[10px]">{p.n}</sup>
          </span>
        ) : (
          <span key={i} className="whitespace-nowrap rounded-card px-[5px] py-px font-semibold" style={{ background: '#F6E8EC', color: '#6B0F2B' }}>
            {p.v}
            <sup className="ml-0.5 text-[10px]">{p.n}</sup>
          </span>
        ),
      )}
    </div>
  );
}

import * as React from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Keys maroon, strings teal, numbers blue, literals amber, punctuation muted.
function tokenize(json: string) {
  const out: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(json))) {
    if (m.index > last) out.push(json.slice(last, m.index));
    if (m[1]) {
      out.push(
        <span key={k++} style={{ color: m[2] ? '#8A1538' : '#0F766E' }}>
          {m[1]}
        </span>,
      );
      if (m[2]) out.push(<span key={k++} className="text-ink-subtle">{m[2]}</span>);
    } else if (m[3]) out.push(<span key={k++} style={{ color: '#B7791F' }}>{m[3]}</span>);
    else if (m[4]) out.push(<span key={k++} style={{ color: '#2B6CB0' }}>{m[4]}</span>);
    else if (m[5]) out.push(<span key={k++} className="text-ink-subtle">{m[5]}</span>);
    last = re.lastIndex;
  }
  if (last < json.length) out.push(json.slice(last));
  return out;
}

export function JsonViewer({ value, className, maxHeight = 420 }: { value: unknown; className?: string; maxHeight?: number }) {
  const text = React.useMemo(() => (typeof value === 'string' ? value : JSON.stringify(value, null, 2)), [value]);
  return (
    <div className={cn('relative rounded-card border border-line-subtle bg-[#FCFBFA]', className)}>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text);
          toast.success('Copied');
        }}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm border border-line bg-surface px-2 py-1 text-[11.5px] text-ink-muted hover:text-brand"
      >
        <Copy size={12} />
        Copy
      </button>
      <pre className="overflow-auto p-3.5 pr-20 font-mono text-[12px] leading-[1.6] text-ink-body" style={{ maxHeight }}>
        {tokenize(text)}
      </pre>
    </div>
  );
}
